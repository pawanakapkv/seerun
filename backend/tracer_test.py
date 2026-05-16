import gdb
import json

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
                    
                    if hex_addr not in self.visited_addrs:
                        if len(self.visited_addrs) >= self.MAX_HEAP_NODES:
                            return {"_type": "pointer", "data": hex_addr}
                        self.visited_addrs.add(hex_addr)
                        
                        target = v.dereference()
                        # Call parse_val on target; it will add it to heap if struct/array
                        # Wait, what if target is primitive? (e.g. int*)
                        self.parse_val(target, depth+1)
                        
                    return {"_type": "pointer", "data": hex_addr}
                except gdb.MemoryError:
                    return {"_type": "raw", "data": "UNINITIALIZED"}
                except:
                    return {"_type": "raw", "data": str(v)}

            # Struct / Class
            if t.code == gdb.TYPE_CODE_STRUCT:
                try:
                    addr = int(v.address) if v.address else None
                    if not addr:
                        # Inline parsing
                        fields_data = {}
                        for f in t.fields():
                            if not f.is_base_class:
                                try:
                                    fields_data[f.name] = self.parse_val(v[f], depth+1)
                                except:
                                    pass
                        return {"_type": "struct_inline", "fields": fields_data}

                    hex_addr = hex(addr)
                    if hex_addr not in self.visited_addrs:
                        if len(self.visited_addrs) >= self.MAX_HEAP_NODES:
                            return {"_type": "pointer", "data": hex_addr}
                        self.visited_addrs.add(hex_addr)
                        fields_data = {}
                        for f in t.fields():
                            if not f.is_base_class:
                                try:
                                    fields_data[f.name] = self.parse_val(v[f], depth+1)
                                except:
                                    pass
                        
                        # Get clear name
                        type_name = str(t)
                        if " " in type_name:
                            type_name = type_name.split()[0]
                            
                        self.heap[hex_addr] = {
                            "_type": "struct",
                            "name": type_name,
                            "fields": fields_data
                        }
                    return {"_type": "pointer", "data": hex_addr}
                except:
                    pass

            # Arrays and vectors
            if t.code == gdb.TYPE_CODE_ARRAY or str(t).startswith("std::vector"):
                try:
                    addr = int(v.address) if v.address else None
                    if not addr:
                        # Fallback inline
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
                            # Vector
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
