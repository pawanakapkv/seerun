import gdb
import json
import sys
import os

trace_events = []
MAX_STEPS = 1000

class TracerState:
    def __init__(self):
        self.heap = {}
        self.visited_addrs = set()
        self.MAX_HEAP_NODES = 50

    def parse_val(self, v, depth=0):
        if depth > 10:
            return {"_type": "raw", "data": "..."}
        try:
            t = v.type.strip_typedefs()
            
            # Primitives
            if t.code in (gdb.TYPE_CODE_INT, gdb.TYPE_CODE_FLT, gdb.TYPE_CODE_BOOL):
                return {"_type": "primitive", "data": str(v)}
            
            # Strings
            if str(t).startswith("std::__cxx11::basic_string"):
                return {"_type": "primitive", "data": str(v).split('"')[1] if '"' in str(v) else str(v)}

            # Pointers
            if t.code == gdb.TYPE_CODE_PTR:
                try:
                    addr = int(v)
                    if addr == 0:
                        return {"_type": "pointer", "data": "0x0"}
                    hex_addr = hex(addr)
                    
                    # Only parse the target if we haven't seen this address yet
                    if hex_addr not in self.visited_addrs:
                        self.visited_addrs.add(hex_addr)  # Mark BEFORE recursing to prevent infinite loops
                        try:
                            target = v.dereference()
                            tt = target.type.strip_typedefs()
                            if tt.code == gdb.TYPE_CODE_STRUCT:
                                fields_data = {}
                                for f in tt.fields():
                                    if not f.is_base_class:
                                        try:
                                            fields_data[f.name] = self.parse_val(target[f], depth+1)
                                        except Exception:
                                            pass
                                type_name = str(tt)
                                if " " in type_name:
                                    type_name = type_name.split()[0]
                                # Handle nested class names like "Solution::Node"
                                if "::" in type_name:
                                    type_name = type_name.split("::")[-1]
                                self.heap[hex_addr] = {
                                    "_type": "struct",
                                    "name": type_name,
                                    "fields": fields_data
                                }
                        except Exception:
                            pass  # Could not dereference, but we still have the address
                    
                    # Always return a proper pointer type with the address
                    return {"_type": "pointer", "data": hex_addr}
                except Exception:
                    return {"_type": "raw", "data": str(v)}

            # Struct / Class
            if t.code == gdb.TYPE_CODE_STRUCT:
                try:
                    addr = int(v.address) if v.address else None
                    if not addr:
                        # Inline struct (by value, no heap address)
                        fields_data = {}
                        for f in t.fields():
                            if not f.is_base_class:
                                try:
                                    fields_data[f.name] = self.parse_val(v[f], depth+1)
                                except Exception:
                                    pass
                        return {"_type": "struct_inline", "fields": fields_data}

                    hex_addr = hex(addr)
                    if hex_addr not in self.visited_addrs:
                        self.visited_addrs.add(hex_addr)
                        fields_data = {}
                        for f in t.fields():
                            if not f.is_base_class:
                                try:
                                    fields_data[f.name] = self.parse_val(v[f], depth+1)
                                except Exception:
                                    pass
                        type_name = str(t)
                        if " " in type_name:
                            type_name = type_name.split()[0]
                        if "::" in type_name:
                            type_name = type_name.split("::")[-1]
                        self.heap[hex_addr] = {
                            "_type": "struct",
                            "name": type_name,
                            "fields": fields_data
                        }
                    return {"_type": "pointer", "data": hex_addr}
                except Exception:
                    pass

            # Arrays and vectors
            if t.code == gdb.TYPE_CODE_ARRAY or str(t).startswith("std::vector"):
                try:
                    addr = int(v.address) if v.address else None
                    if not addr:
                        return {"_type": "raw", "data": "[Array without address]"}
                        
                    hex_addr = hex(addr)
                    if hex_addr not in self.visited_addrs:
                        if len(self.visited_addrs) >= self.MAX_HEAP_NODES:
                            return {"_type": "pointer", "data": hex_addr}
                        self.visited_addrs.add(hex_addr)
                        
                        items = []
                        if t.code == gdb.TYPE_CODE_ARRAY:
                            try:
                                target_type = t.target()
                                lower, upper = t.range()
                                for i in range(lower, min(upper+1, lower+20)):
                                    items.append(self.parse_val(v[i], depth+1))
                            except:
                                pass
                        else:
                            try:
                                for i, child in enumerate(gdb.default_visualizer(v).children()):
                                    if i > 20:
                                        items.append({"_type": "raw", "data": "..."})
                                        break
                                    items.append(self.parse_val(child[1], depth+1))
                            except:
                                pass
                                
                        self.heap[hex_addr] = {
                            "_type": "array",
                            "data": items
                        }
                    return {"_type": "pointer", "data": hex_addr}
                except:
                    pass

            return {"_type": "raw", "data": str(v)}
        except Exception as e:
            return {"_type": "raw", "data": f"[Err: {e}]"}

def main():
    gdb.execute("set confirm off")
    gdb.execute("set pagination off")
    gdb.execute("break main")
    
    # Extract the working directory from the exe path passed to GDB
    # e.g., /tmp/run_12345/prog -> /tmp/run_12345
    exe_file = gdb.current_progspace().filename
    work_dir = os.path.dirname(exe_file)
    input_file = os.path.join(work_dir, "input.txt")
    trace_file = os.path.join(work_dir, "trace.json")

    try:
        gdb.execute("skip -gfi /usr/include/c++/*/*")
        gdb.execute("skip -gfi /usr/include/x86_64-linux-gnu/c++/*/*")
        gdb.execute("skip -gfi /usr/include/c++/*")
    except:
        pass

    # Run the program with stdin redirected
    try:
        gdb.execute(f"run < {input_file}")
    except gdb.error as e:
        print("Run error:", e)
        return

    step_count = 0
    while step_count < MAX_STEPS:
        try:
            frame = gdb.selected_frame()
            if not frame: break
            
            symtab_and_line = frame.find_sal()
            if not symtab_and_line or not symtab_and_line.symtab:
                # Outside of known code, step out
                try:
                    gdb.execute("step", to_string=True)
                    continue
                except:
                    break
                    
            filename = symtab_and_line.symtab.filename
            if "main.cpp" not in filename:
                try:
                    gdb.execute("finish", to_string=True)
                except:
                    gdb.execute("step", to_string=True)
                continue

            line_num = symtab_and_line.line
            func_name = frame.name() or "Global"
            
            block = frame.block()
            locs = {}
            globs = {}
            tracer_state = TracerState()
            
            while block:
                is_global_or_static = block.is_global or block.is_static
                for symbol in block:
                    # For global/static blocks, only parse variables from our main.cpp to avoid std:: bloat
                    if is_global_or_static:
                        if not symbol.is_variable: continue
                        if not symbol.symtab or "main.cpp" not in symbol.symtab.filename: continue
                        try:
                            val = symbol.value(frame)
                            globs[symbol.name] = tracer_state.parse_val(val)
                        except:
                            pass
                    else:
                        if symbol.is_argument or symbol.is_variable:
                            try:
                                val = symbol.value(frame)
                                locs[symbol.name] = tracer_state.parse_val(val)
                            except:
                                pass
                block = block.superblock
            
            trace_events.append({
                "line": line_num,
                "func": func_name,
                "vars": locs,
                "globs": globs,
                "heap": tracer_state.heap,
                "output": "" # We don't trace stdout sequentially in GDB as easily, we can capture it at end
            })
            
            gdb.execute("step", to_string=True)
            step_count += 1
        except gdb.error:
            break
        except Exception as e:
            print("Tracer loop error:", e)
            break

    # We cannot easily capture stdout during GDB execution unless we redirect it.
    # We will assume stdout is captured by the wrapper shell or ignored for now.
    
    with open(trace_file, "w") as f:
        json.dump(trace_events, f)
    
    gdb.execute("quit")

if __name__ == "__main__":
    main()
