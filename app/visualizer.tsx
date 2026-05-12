import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState, useMemo } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Modal,
    Alert,
} from "react-native";
import { WebView } from "react-native-webview";
import { shareTraceAsJSON, shareStepAsImage } from "../utils/share";
import { Share, FileJson, Camera, X, ArrowLeft } from "lucide-react-native";
import { BlurView } from "expo-blur";
import { useTheme } from "../context/ThemeContext";
import DataStructureVisualizer from '../components/DataStructureVisualizer';

interface TraceEvent {
  line?: number;
  func?: string;
  vars?: Record<string, any>;
  globs?: Record<string, any>;
  output?: string;
  error?: string;
}

const pyodideHtml = `
  <html>
    <head>
      <script src="https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js" onerror="window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', data: 'Network error: Failed to download Pyodide core.' }))"></script>
      <script>
        let initRetries = 0;
        async function init() {
          try {
              if (typeof loadPyodide === 'undefined') {
                  initRetries++;
                  if (initRetries > 200) {
                      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', data: 'Timeout: Pyodide failed to load after 20s.' }));
                      return;
                  }
                  setTimeout(init, 100);
                  return;
              }
              let pyodide = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/' });
              window.pyodide = pyodide;
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
          } catch (e) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', data: e.toString() }));
          }
        }
        init();

        function runPythonCode(code, user_input) {
          window.user_output = "";
          window.code_to_exec = code;
          window.user_input_data = user_input;
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'debug', data: 'Executing Python code within Pyodide VM...' }));
          let script = \`
import sys
import js
import builtins
import io
import json

# Override input
user_input_data = str(js.user_input_data)
input_lines = user_input_data.splitlines()
input_idx = 0

def mocked_input(prompt=""):
    global input_idx
    if input_idx < len(input_lines):
        val = input_lines[input_idx]
        input_idx += 1
        return val
    return ""

builtins.input = mocked_input

# Capture output
sys.stdout = io.StringIO()

MAX_STEPS = 1000
step_count = 0
trace_events_list = []

def jsonify_var(val, depth=0):
    if depth > 2:
        return {'_type': 'raw', 'data': str(val)[:50] + "..."}
    if isinstance(val, (int, float, bool, type(None))):
        return {'_type': 'primitive', 'data': val}
    elif isinstance(val, str):
        return {'_type': 'primitive', 'data': val[:100] + "..." if len(val) > 100 else val}
    elif isinstance(val, list):
        items = [jsonify_var(item, depth+1) for item in val[:20]]
        if len(val) > 20: items.append({'_type': 'raw', 'data': '...'})
        return {'_type': 'list', 'data': items}
    elif isinstance(val, tuple):
        items = [jsonify_var(item, depth+1) for item in val[:20]]
        if len(val) > 20: items.append({'_type': 'raw', 'data': '...'})
        return {'_type': 'tuple', 'data': items}
    elif isinstance(val, set):
        items = [jsonify_var(item, depth+1) for item in list(val)[:20]]
        if len(val) > 20: items.append({'_type': 'raw', 'data': '...'})
        return {'_type': 'set', 'data': items}
    elif isinstance(val, dict):
        d = {}
        for i, (k, v) in enumerate(val.items()):
            if i < 20: d[str(k)] = jsonify_var(v, depth+1)
        if len(val) > 20: d['...'] = {'_type': 'raw', 'data': '...'}
        return {'_type': 'dict', 'data': d}
    elif hasattr(val, "__dict__"):
        d = {}
        for i, (k, v) in enumerate(val.__dict__.items()):
            if i < 20: d[str(k)] = jsonify_var(v, depth+1)
        return {'_type': 'object', 'class_name': type(val).__name__, 'data': d}
    else:
        return {'_type': 'raw', 'data': str(val)[:50] + "..."}

def is_tracked_var(k, v):
    if k.startswith('_'): return False
    if k in ('js', 'builtins', 'sys', 'io', 'json', 'mocked_input', 'trace_calls', 'user_input_data', 'input_lines', 'input_idx', 'MAX_STEPS', 'step_count', 'trace_events_list', 'jsonify_var', 'code_lines_arr', 'line_str', 'is_tracked_var', 'func_name', 'locs', 'globs'): return False
    if type(v).__name__ in ('module', 'function', 'builtin_function_or_method', 'type'): return False
    return True

def trace_calls(frame, event, arg):
    global step_count
    if event == 'line':
        step_count += 1
        if step_count > MAX_STEPS:
            trace_events_list.append({'error': 'Execution limit automatically stopped at 1000 steps. Check your code for infinite loops!'})
            sys.settrace(None)
            return None
        try:
            code_lines_arr = str(js.code_to_exec).splitlines()
            if 0 <= frame.f_lineno - 1 < len(code_lines_arr):
                line_str = code_lines_arr[frame.f_lineno - 1].strip()
                if frame.f_code.co_name == '<module>':
                    if line_str.startswith('def ') or line_str.startswith('class ') or line_str.startswith('import ') or line_str.startswith('from ') or line_str.startswith('@'):
                        return trace_calls
        except Exception:
            pass
        
        try:
            func_name = frame.f_code.co_name
            if func_name == '<module>': func_name = 'Global Scope'
            
            locs = {}
            for k, v in frame.f_locals.items():
                if is_tracked_var(k, v):
                    locs[str(k)] = jsonify_var(v)
            
            globs = {}
            if func_name != 'Global Scope':
                for k, v in frame.f_globals.items():
                    if is_tracked_var(k, v):
                        globs[str(k)] = jsonify_var(v)
                locs = {k: v for k, v in locs.items() if k not in globs}
            
            output_so_far = sys.stdout.getvalue()
            if len(output_so_far) > 1000:
                output_so_far = output_so_far[:997] + "..."
                
            trace_events_list.append({
                'line': frame.f_lineno,
                'func': func_name,
                'vars': locs,
                'globs': globs if func_name != 'Global Scope' else None,
                'output': output_so_far
            })
        except Exception:
            pass
    return trace_calls

sys.settrace(trace_calls)

try:
    exec(str(js.code_to_exec), globals())
except Exception as e:
    trace_events_list.append({'error': str(e)})
finally:
    sys.settrace(None)
    final_out = sys.stdout.getvalue()
    if len(final_out) > 1000:
        final_out = final_out[:997] + "..."
    trace_events_list.append({'line': -1, 'output': final_out, 'vars': {}})
    
    # Safely convert completely to JSON inside Python
    js.encoded_trace_json = json.dumps(trace_events_list)
\`;
          try {
              window.pyodide.runPython(script);
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'trace', data: JSON.parse(window.encoded_trace_json) }));
          } catch (e) {
              let errorTrace = [{'error': 'Runtime Error: ' + e.toString()}];
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'trace', data: errorTrace }));
          }
        }
      </script>
    </head>
    <body></body>
  </html>
`;

const jscppHtml = `
  <html>
    <head>
      <meta charset="utf-8">
      <script
        src="https://cdn.jsdelivr.net/npm/JSCPP@2.0.6/dist/JSCPP.es5.min.js"
        onerror="window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', data: 'CDN Error: Failed to download C++ engine (Check Network).' }))"
      ></script>
      <script>
        function postSafe(obj) {
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                window.ReactNativeWebView.postMessage(JSON.stringify(obj));
            } else {
                setTimeout(function() { postSafe(obj); }, 100);
            }
        }

        function logDebug(msg) {
            postSafe({ type: 'debug', data: msg });
        }

        window.onerror = function(msg, url, line, col, err) {
            postSafe({ type: 'error', data: 'WebView UI Crash: ' + msg + ' (Line ' + line + ')' });
            return false;
        };

        var _log = console.log, _warn = console.warn, _err = console.error;
        console.log = function() { logDebug('SYS LOG: ' + Array.prototype.join.call(arguments, ' ')); _log.apply(console, arguments); };
        console.warn = function() { logDebug('SYS WARN: ' + Array.prototype.join.call(arguments, ' ')); _warn.apply(console, arguments); };
        console.error = function() { logDebug('SYS ERR: ' + Array.prototype.join.call(arguments, ' ')); _err.apply(console, arguments); };

        var initRetries = 0;
        function init() {
            try {
                var engine = window.JSCPP || window.jscpp;
                if (!engine) {
                    initRetries++;
                    if (initRetries > 200) {
                        postSafe({ type: 'error', data: 'Timeout: C++ engine failed to load.' });
                        return;
                    }
                    setTimeout(init, 100);
                    return;
                }
                window.engineInstance = engine;
                postSafe({ type: 'ready' });
            } catch (e) {
                postSafe({ type: 'error', data: 'Init Error: ' + e.toString() });
            }
        }
        init();

        // =================================================================
        // C++ -> JSCPP Transpiler
        // JSCPP does NOT support: class, templates, STL containers.
        // This transpiler converts vector<T> to C-style arrays so the
        // most common educational algorithms work out of the box.
        // =================================================================
        function preprocessCpp(src) {
            var knownVectors = [];
            var knownQueues = [];
            var knownStacks = [];
            var constructors = {};

            function markVec(name) {
                if (name && knownVectors.indexOf(name) < 0) knownVectors.push(name);
                return name;
            }

            // 1. Strip only headers that JSCPP cannot handle (NOT iostream - it needs it for cout/cin)
            src = src.replace(/#include\\s*<vector>/g, '');
            src = src.replace(/#include\\s*<algorithm>/g, '');
            src = src.replace(/#include\\s*<stack>/g, '');
            src = src.replace(/#include\\s*<queue>/g, '');
            src = src.replace(/#include\\s*<map>/g, '');
            src = src.replace(/#include\\s*<set>/g, '');
            src = src.replace(/#include\\s*<string>/g, '');
            src = src.replace(/#include\\s*<bits\\/stdc\\+\\+\\.h>/g, '#include <iostream>');
            // KEEP 'using namespace std;' so JSCPP can resolve cout/cin/endl
            // KEEP 'std::' prefixes - JSCPP handles them natively

            // 2. Extract and Strip Constructors from structs/classes
            // This bypasses JSCPP's failure on member functions/constructors.
            src = src.replace(/(struct|class)\\s+(\\w+)\\s*\\{([^}]*)\\}/g, function(m, keyword, className, content) {
                var newContent = content;
                var ctorRegex = new RegExp('\\\\b' + className + '\\\\s*\\\\(([^)]*)\\\\)\\\\s*(?::\\\\s*([^\\\\{]+))?\\\\s*\\\\{([^}]*)\\\\}', 'g');
                
                newContent = newContent.replace(ctorRegex, function(cm, params, inits, body) {
                    var assignments = "";
                    if (inits) {
                        assignments = inits.split(',').map(function(s) {
                            var p = s.trim().split('(');
                            if (p.length < 2) return '';
                            var field = p[0].trim();
                            var val = p[1].split(')')[0].replace(/\\)$/, "").trim();
                            return "_obj->" + field + " = " + val + "; ";
                        }).join('');
                    }
                    var processedBody = body.replace(/\\bthis->/g, '_obj->');
                    // For simple PODs, we'll try to prefix assignments if they look like member writes
                    // but for the user's example, 'assignments' from inits is the key.
                    
                    constructors[className] = {
                        params: params,
                        logic: assignments + processedBody
                    };
                    return ""; // Strip constructor from struct body
                });
                return keyword + " " + className + " {" + newContent + "};";
            });

            // 3. Replace 'new Class(args)' with helper calls
            for (var className in constructors) {
                var ctor = constructors[className];
                var newRegex = new RegExp('new\\\\s+' + className + '\\\\s*\\\\(([^)]*)\\\\)', 'g');
                src = src.replace(newRegex, "___create_" + className + "($1)");
            }

            // 4. Inject global helper functions
            var helpers = "";
            for (var className in constructors) {
                var ctor = constructors[className];
                helpers += className + "* ___create_" + className + "(" + ctor.params + ") { " +
                           className + "* _obj = new " + className + "; " +
                           ctor.logic + 
                           " return _obj; }\\n";
            }
            src = helpers + "\\n" + src;

            // 5. Fix NULL and nullptr
            src = src.replace(/\\bNULL\\b/g, '0');
            src = src.replace(/\\bnullptr\\b/g, '0');

            // 6. Data Structure Declarations (vector, stack, queue)
            src = src.replace(/\\bvector\\s*<[^>]+>\\s+(\\w+)\\s*(?:\\(\\s*(\\d+)\\s*\\))?\\s*;/g, function(m, name, initN) {
                markVec(name);
                return 'int ' + name + '[1000]; int ' + name + '_sz = ' + (initN || '0') + ';';
            });
            src = src.replace(/\\bstack\\s*<[^>]+>\\s+(\\w+)\\s*;/g, function(m, name) {
                knownStacks.push(name);
                return 'int ' + name + '[1000]; int ' + name + '_sz = 0;';
            });
            src = src.replace(/\\bqueue\\s*<[^>]+>\\s+(\\w+)\\s*;/g, function(m, name) {
                knownQueues.push(name);
                return 'int ' + name + '[1000]; int ' + name + '_sz = 0; int ' + name + '_head = 0;';
            });

            // 7. Methods (push, pop, top, front, size, empty, etc.)
            src = src.replace(/\\b(\\w+)\\.(?:push_back|push)\\s*\\(([^;)]+)\\)/g, "$1[$1_sz++] = $2");
            src = src.replace(/\\b(\\w+)\\.pop\\s*\\(\\s*\\)/g, function(m, v) {
                if (knownQueues.indexOf(v) >= 0) return v + '_head++';
                return v + '_sz--';
            });
            src = src.replace(/\\b(\\w+)\\.pop_back\\s*\\(\\s*\\)/g, "$1_sz--");
            src = src.replace(/\\b(\\w+)\\.(?:top|back)\\s*\\(\\s*\\)/g, "$1[$1_sz - 1]");
            src = src.replace(/\\b(\\w+)\\.front\\s*\\(\\s*\\)/g, "$1[$1_head || 0]");
            src = src.replace(/\\b(\\w+)\\.size\\s*\\(\\s*\\)/g, "($1_sz - ($1_head || 0))");
            src = src.replace(/\\b(\\w+)\\.empty\\s*\\(\\s*\\)/g, "(($1_sz - ($1_head || 0)) == 0)");
            src = src.replace(/\\b(\\w+)\\.at\\s*\\(([^)]+)\\)/g, "$1[$2]");

            // 8. Function params & Call sites for vectors
            src = src.replace(/\\bvector\\s*<[^>]+>\\s*&?\\s*(\\w+)/g, 'int $1[], int $1_sz');
            for (var i = 0; i < knownVectors.length; i++) {
                var v = knownVectors[i];
                var re = new RegExp('(?<![={])\\\\b' + v + '\\\\b(?!_sz)(?!\\\\[)(?=\\\\s*[,)])', 'g');
                src = src.replace(re, v + ', ' + v + '_sz');
            }

            // 9. Functional stack frame markers
            src = src.replace(/^([ \\t]*)([\\w<>,:&*]+(?:[ \\t]+[\\w<>,:&*]+)*)[ \\t]+([a-zA-Z_]\\w*)[ \\t]*\\([^)]*\\)[ \\t]*(?:const[ \\t]*)?\\{/gm, function(m, indent, retType, funcName) {
                if (['if','while','for','switch','return'].indexOf(funcName) !== -1) return m;
                return m + '\\n' + indent + '    int ___func_marker_' + funcName + '___ = 1;';
            });

            // 10. Vector Initializer Lists & Memory Fixes
            src = src.replace(/\\bvector\\s*<[^>]+>\\s+(\\w+)\\s*(?:=\\s*)?\\{([^}]*)\\}\\s*;/g, function(m, name, elements) {
                markVec(name);
                var arr = elements.trim().split(',').map(function(s){ return s.trim(); }).filter(function(s){ return s; });
                var assignments = arr.map(function(val, i){ return name + "[" + i + "] = " + val + ";"; }).join(' ');
                return 'int ' + name + '[1000]; int ' + name + '_sz = ' + arr.length + '; ' + assignments;
            });

            // 11. Fix assignments and returns for transpiled containers
            for (var i = 0; i < knownVectors.length; i++) {
                var v = knownVectors[i];
                src = src.replace(new RegExp('\\\\b' + v + '\\\\s*=\\\\s*([^;]+);', 'g'), '$1;');
                src = src.replace(new RegExp('\\\\breturn\\\\s+' + v + '\\\\s*;', 'g'), 'return;');
            }

            return src;
        }

        function runCppCode(code, user_input) {
          try {
            var engine = window.engineInstance;
            if (!engine) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', data: 'C++ Engine not initialized yet.' }));
              return;
            }

            logDebug('Preprocessing C++ code...');
            var processedCode = preprocessCpp(code);
            logDebug('Processed Code Sample: ' + processedCode.substring(0, 200).replace(/\\n/g, ' '));
            logDebug('Compiling...');

            var outputBuffer = '';
            var config = {
              debug: true,
              stdio: {
                write: function(str) { outputBuffer += str; }
              }
            };

            var debugger_inst;
            try {
              debugger_inst = engine.run(processedCode, user_input, config);
            } catch (e) {
               window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', data: 'Compilation Error: ' + e.toString() }));
               return;
            }

            logDebug('Compilation OK, starting execution...');

            var trace_events_list = [];
            var MAX_STEPS = 1000;
            var step_count = 0;
            var last_line = -1;
            var last_vars_json = "";

            function extractVars(scope, isGlobal) {
                var res = {};
                if (!scope) return res;
                var vars = scope.variables || scope;
                var ignores = {'cin':1, 'cout':1, 'endl':1, 'cerr':1, 'main':1, 'std':1, 'ios':1, 'ios_base':1, 'NULL':1};
                for (var name in vars) {
                    if (name.startsWith('$')) continue;
                    if (isGlobal && ignores[name]) continue;
                    var v = vars[name];
                    var typeObj = v ? (v.t || v.type) : null;
                    if (typeObj) {
                        var tName = typeObj.type || typeObj.classic;
                        if (tName === 'function') continue;
                        var valObj = ('v' in v) ? v.v : ('value' in v ? v.value : v);
                        try { 
                            res[name] = jsonifyCppVar({ type: typeObj, v: valObj }, 0); 
                            // Fallback to hide function pointers in global scope
                            if (isGlobal && res[name] && res[name].data === '[ptr object]') {
                                delete res[name];
                            }
                        }
                        catch(e) { res[name] = { _type: 'raw', data: '[Err]' }; }
                    }
                }
                return res;
            }

            function jsonifyCppVar(v, depth) {
                if (depth > 5) return { _type: 'raw', data: '...' };
                var type = v.type;
                var val  = v.v;
                if (!type) return { _type: 'raw', data: String(val) };
                
                var tName = type.type || type.classic;
                if (tName === 'primitive') {
                    return { _type: 'primitive', data: val };
                } else if (tName === 'array' || (tName === 'pointer' && type.ptrType === 'array')) {
                    var items = [];
                    var arrTarget = Array.isArray(val) ? val : (val && val.target ? val.target : null);
                    var len = Array.isArray(arrTarget) ? Math.min(arrTarget.length, 20) : 0;
                    for (var i = 0; i < len; i++) {
                        var eleVal = arrTarget[i];
                        var eType = eleVal ? (eleVal.t || eleVal.type || type.eleType) : type.eleType;
                        var eVal  = eleVal ? (('v' in eleVal) ? eleVal.v : ('value' in eleVal ? eleVal.value : eleVal)) : null;
                        if (!eType) eType = { type: 'primitive', name: 'unknown' };
                        items.push(jsonifyCppVar({ type: eType, v: eVal }, depth + 1));
                    }
                    if (arrTarget && arrTarget.length > 20) items.push({ _type: 'raw', data: '...' });
                    return { _type: 'list', data: items };
                } else if (tName === 'struct' || tName === 'class') {
                    var d = {};
                    var count = 0;
                    var fields = val && val.v ? val.v : val;
                    for (var field in fields) {
                        if (count++ > 20) break;
                        var fVal = fields[field];
                        var fType = fVal ? (fVal.t || fVal.type) : null;
                        var fv = fVal ? (('v' in fVal) ? fVal.v : fVal) : null;
                        if (fType) {
                            d[field] = jsonifyCppVar({ type: fType, v: fv }, depth + 1);
                        } else {
                            d[field] = { _type: 'raw', data: String(fv) };
                        }
                    }
                    return { _type: 'object', class_name: type.name || 'struct', data: d };
                } else if (tName === 'pointer') {
                    return { _type: 'raw', data: '*' + (type.ptrType ? (type.ptrType.name || 'void') : 'void') };
                }
                return { _type: 'raw', data: String(val && val.target ? "[ptr object]" : val) };
            }

            var done = false;
            var absolute_step_count = 0;
            while (!done) {
                absolute_step_count++;
                if (absolute_step_count > 20000) {
                     throw new Error('Infinite execution loop detected: Exceeded 20000 AST operations.');
                }

                var node = debugger_inst.nextNode();
                while (!node || (!node.sLine && !node.line)) {
                    done = debugger_inst.next();
                    if (done) break;
                    node = debugger_inst.nextNode();
                }
                if (done) break;

                var currentLine = node.sLine || node.line;
                
                var scopeArray = debugger_inst.rt ? debugger_inst.rt.scope : [];
                
                var funcBorders = [];
                if (scopeArray && scopeArray.length > 1) {
                    for (var si = 1; si < scopeArray.length; si++) {
                        var sVars = scopeArray[si].variables || scopeArray[si];
                        if (sVars) {
                            for (var k in sVars) {
                                if (k.indexOf('___func_marker_') === 0) {
                                    var fnName = k.substring(15, k.length - 3);
                                    funcBorders.push({ index: si, name: fnName });
                                    break;
                                }
                            }
                        }
                    }
                }

                var frames = [];
                var frameStarts = [];
                if (funcBorders.length === 0) {
                    frameStarts.push({ startIndex: 1, name: 'main' });
                } else {
                    for (var b = 0; b < funcBorders.length; b++) {
                        var border = funcBorders[b];
                        var startIdx = border.index;
                        if (border.index - 1 > 0) {
                            if (b === 0) {
                                startIdx = border.index - 1;
                            } else if (border.index - 1 > funcBorders[b-1].index) {
                                startIdx = border.index - 1;
                            }
                        }
                        frameStarts.push({ startIndex: startIdx, name: border.name });
                    }
                }

                for (var f = 0; f < frameStarts.length; f++) {
                    var fStart = frameStarts[f].startIndex;
                    var fEnd = (f + 1 < frameStarts.length) ? frameStarts[f+1].startIndex : scopeArray.length;
                    
                    var fLocs = {};
                    for (var i = fStart; i < fEnd; i++) {
                        var cScopeVars = extractVars(scopeArray[i], false);
                        for (var k in cScopeVars) {
                            fLocs[k] = cScopeVars[k];
                        }
                    }
                    frames.push({ func: frameStarts[f].name, rawVars: fLocs });
                }

                // Attach size information to transpiled array variables for all frames individually
                for (var f = 0; f < frames.length; f++) {
                    var flocs = frames[f].rawVars;
                    for (var arrKey in flocs) {
                        var szKey = arrKey + '_sz';
                        if (flocs[szKey] !== undefined && flocs[arrKey] && flocs[arrKey]._type === 'list') {
                            var szVal = flocs[szKey].data;
                            if (typeof szVal === 'number' && szVal >= 0) {
                                flocs[arrKey].data = flocs[arrKey].data.slice(0, szVal);
                            }
                        }
                    }
                    var filteredFLocs = {};
                    for (var key in flocs) {
                        if (!key.endsWith('_sz') && key.indexOf('___func_marker_') !== 0) filteredFLocs[key] = flocs[key];
                    }
                    frames[f].vars = filteredFLocs;
                    delete frames[f].rawVars;
                }

                var globs = {};
                // In JSCPP 2.0, scopeArray[0] is the global scope
                if (scopeArray && scopeArray.length > 0) {
                    globs = extractVars(scopeArray[0], true);
                }
                var filteredGlobs = {};
                for (var gk in globs) {
                    if (!gk.endsWith('_sz')) filteredGlobs[gk] = globs[gk];
                }
                for (var gak in filteredGlobs) {
                    var gszKey = gak + '_sz';
                    if (globs[gszKey] !== undefined && filteredGlobs[gak] && filteredGlobs[gak]._type === 'list') {
                        var gszVal = globs[gszKey].data;
                        if (typeof gszVal === 'number' && gszVal >= 0) {
                            filteredGlobs[gak].data = filteredGlobs[gak].data.slice(0, gszVal);
                        }
                    }
                }

                for (var f = 0; f < frames.length; f++) {
                    for (var dk in filteredGlobs) {
                        if (frames[f].vars.hasOwnProperty(dk)) delete frames[f].vars[dk];
                    }
                }
                
                var currentFuncName = frames.length > 0 ? frames[frames.length - 1].func : 'main';
                var filteredLocs = frames.length > 0 ? frames[frames.length - 1].vars : {};
                var framesJsonStr = JSON.stringify(frames);

                var current_vars_json = framesJsonStr + "|" + JSON.stringify(filteredGlobs);

                if (currentLine !== last_line || current_vars_json !== last_vars_json) {
                    step_count++;
                    last_line = currentLine;
                    last_vars_json = current_vars_json;

                    trace_events_list.push({
                        line: currentLine,
                        func: currentFuncName,
                        vars: filteredLocs,
                        frames: frames,
                        globs: Object.keys(filteredGlobs).length > 0 ? filteredGlobs : null,
                        output: outputBuffer
                    });
                }

                done = debugger_inst.next();
                if (step_count >= MAX_STEPS) {
                    trace_events_list.push({ error: 'Execution limit hit (1000 steps).' });
                    break;
                }
            }

            logDebug('Execution finished. Steps: ' + step_count);
            trace_events_list.push({ line: -1, output: outputBuffer, vars: {} });
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'trace', data: trace_events_list }));

          } catch (e) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', data: 'Runtime Error: ' + e.toString() }));
          }
        }
      </script>
    </head>
    <body style="background: #1e1e1e;"></body>
  </html>
`;

// Define WebView constants OUTSIDE the component to prevent aggressive re-mounting
const ORIGIN_WHITELIST = ["*"];

const VariableViewer = ({ variable }: { variable: any }) => {
  const { theme, isDark, fontSize } = useTheme();
  const styles = createStyles(theme, isDark, fontSize);

  if (!variable) return <Text style={styles.varValue}>null</Text>;

  // For backward compatibility or if something wasn't structured format
  if (variable._type === undefined) {
    return (
      <Text style={styles.varValue}>
        {typeof variable === "string" ? `'${variable}'` : String(variable)}
      </Text>
    );
  }

  if (variable._type === "primitive") {
    const val = variable.data;
    if (val === null) return <Text style={styles.varValue}>None</Text>;
    return (
      <Text style={styles.varValue}>
        {typeof val === "string" ? `'${val}'` : String(val)}
      </Text>
    );
  }

  if (variable._type === "raw") {
    return <Text style={styles.varValue}>{String(variable.data)}</Text>;
  }

  if (
    variable._type === "list" ||
    variable._type === "tuple" ||
    variable._type === "set"
  ) {
    const items = variable.data || [];
    const getTypeColor = () => {
      if (variable._type === "tuple") return isDark ? "#C586C0" : "#7C3AED";
      if (variable._type === "set") return isDark ? "#4EC9B0" : "#059669";
      return isDark ? "#9CDCFE" : "#0284C7"; // list
    };
    const getBrackets = () => {
      if (variable._type === "tuple") return ["(", ")"];
      if (variable._type === "set") return ["{", "}"];
      return ["[", "]"];
    };
    return (
      <View style={styles.collapsibleContainer}>
        <Text
          style={{
            color: getTypeColor(),
            fontFamily: "monospace",
            fontSize: 12,
            marginRight: 4,
            marginBottom: 2,
          }}
        >
          {variable._type}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.arrayContainer}
        >
          <Text
            style={{
              color: isDark ? "#D4D4D4" : "#64748B",
              fontFamily: "monospace",
              alignSelf: "center",
              fontSize: 16,
            }}
          >
            {getBrackets()[0]}{" "}
          </Text>
          {items.map((item: any, idx: number) => (
            <View
              key={idx}
              style={[styles.arrayItem, { borderColor: getTypeColor() }]}
            >
              <View style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
                <VariableViewer variable={item} />
              </View>
              {variable._type !== "set" && (
                <Text style={styles.arrayItemIndex}>{idx}</Text>
              )}
            </View>
          ))}
          <Text
            style={{
              color: isDark ? "#D4D4D4" : "#64748B",
              fontFamily: "monospace",
              alignSelf: "center",
              fontSize: 16,
            }}
          >
            {" "}
            {getBrackets()[1]}
          </Text>
        </ScrollView>
      </View>
    );
  }

  if (variable._type === "dict" || variable._type === "object") {
    const isObj = variable._type === "object";
    const title = isObj ? `Object<${variable.class_name}>` : "dict";
    const dataMap = variable.data || {};
    const color = isObj ? (isDark ? "#DCDCAA" : "#7C3AED") : (isDark ? "#CE9178" : "#9B59B6");
    return (
      <View style={styles.dictMainContainer}>
        <Text
          style={{
            color: color,
            fontFamily: "monospace",
            fontSize: 12,
            marginBottom: 2,
          }}
        >
          {title}
        </Text>
        <View style={[styles.dictContainer, { borderColor: color }]}>
          {Object.entries(dataMap).map(([k, v], idx) => (
            <View key={idx} style={styles.dictRow}>
              <Text style={styles.dictKey}>{String(k)}</Text>
              <Text style={styles.dictSeparator}>: </Text>
              <View style={{ flexShrink: 1, paddingLeft: 4 }}>
                <VariableViewer variable={v} />
              </View>
            </View>
          ))}
          {Object.keys(dataMap).length === 0 && (
            <Text style={{ color: "#666", fontStyle: "italic" }}>empty</Text>
          )}
        </View>
      </View>
    );
  }

  return <Text style={styles.varValue}>{String(variable)}</Text>;
};

export default function VisualizerScreen() {
  const router = useRouter();
  const { theme, isDark, fontSize, increaseFontSize, decreaseFontSize } = useTheme();
  const styles = createStyles(theme, isDark, fontSize);
  const params = useLocalSearchParams();
  const [code, setCode] = useState("");
  const [inputs, setInputs] = useState("");
  const [language, setLanguage] = useState<"python" | "cpp">("python");

  // State for tracing
  const [traceLogs, setTraceLogs] = useState<TraceEvent[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(800); // ms per step
  const [isExecuting, setIsExecuting] = useState(true);
  const [isWebviewReady, setIsWebviewReady] = useState(false);
  const [isStateFullScreen, setIsStateFullScreen] = useState(false);
  const [showVisualPanel, setShowVisualPanel] = useState(true);
  const [isConsoleExpanded, setIsConsoleExpanded] = useState(false);
  const [expandedLine, setExpandedLine] = useState<'executed' | 'executing' | null>(null);
  const [breakpoints, setBreakpoints] = useState<Set<number>>(new Set());
  const [expectedOutput, setExpectedOutput] = useState("");
  const [timeComplexity, setTimeComplexity] = useState("");
  const [spaceComplexity, setSpaceComplexity] = useState("");
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const visualizerContentRef = useRef<View>(null);
  const [pinnedVars, setPinnedVars] = useState<Set<string>>(new Set());

  const webviewRef = useRef<WebView>(null);
  const codeScrollRef = useRef<ScrollView>(null);
  const stateScrollRef = useRef<ScrollView>(null);
  const [scrollViewHeight, setScrollViewHeight] = useState(0);
  const [stateViewHeight, setStateViewHeight] = useState(0);
  const lineOffsets = useRef<{[key: number]: {y: number, height: number}}>({});
  const varOffsets = useRef<{[key: string]: {y: number, height: number}}>({});
  const scopeOffsets = useRef<{[key: string]: number}>({});

  // Friendly error message mapper
  const friendlyError = (msg: string): string => {
    const m = String(msg);
    if (m.includes('cout does not exist') || m.includes('cin does not exist'))
      return '\u26A0\uFE0F Fix: Add "using namespace std;" at the top of your code.';
    if (m.includes('Parsing Failure') && (m.includes('ListNode') || m.includes('struct')))
      return '\u26A0\uFE0F Fix: JSCPP cannot parse struct constructors. Use a createNode() helper function instead.';
    if (m.includes(';;'))
      return '\u26A0\uFE0F Fix: Double semicolon detected. Your struct already ends with ";", do not add another.';
    if (m.includes('Infinite execution') || m.includes('20000'))
      return '\u26A0\uFE0F Fix: Infinite loop detected. Check your while/for loop exit condition.';
    if (m.includes('variable') && m.includes('does not exist'))
      return `\u26A0\uFE0F Fix: ${m} — Check spelling, scope, or add "using namespace std;".`;
    if (m.includes('Parsing Failure'))
      return `\u26A0\uFE0F Parsing Error: The C++ engine could not read your code.\n\nDetails: ${m}`;
    if (m.includes('Network error') || m.includes('CDN Error'))
      return '\u26A0\uFE0F Network Error: Could not load the C++ engine. Check your internet connection.';
    
    // Server-side GDB/GCC errors
    if (m.includes('Compilation Error:')) {
      // Try to extract the core GCC error message to make it cleaner
      const cleanErr = m.replace(/Compilation Error:\\n.*\/main\.cpp:\d+:\d+: (error|warning): /g, 'Syntax Error: ');
      return `\u26A0\uFE0F C++ Compilation Failed:\n\n${cleanErr}`;
    }

    // Fallback if no specific rule matched
    return `\u26A0\uFE0F Execution Error:\n\n${m}`;
  };

  const normalizeOutput = (str: string) => {
    if (!str) return "";
    // Trim spaces from the end of each individual line to prevent trailing space mismatch
    return str.split('\n').map(line => line.trim()).join('\n').trim();
  };

  useEffect(() => {
    if (params.code) setCode(params.code as string);
    if (params.inputData) setInputs(params.inputData as string);
    if (params.language) setLanguage(params.language as "python" | "cpp");
    if (params.expectedOutput) setExpectedOutput(params.expectedOutput as string);
    if (params.timeComplexity) setTimeComplexity(params.timeComplexity as string);
    if (params.spaceComplexity) setSpaceComplexity(params.spaceComplexity as string);
  }, [params]);

  // Reset ready state when language changes to prevent race conditions
  useEffect(() => {
    setIsWebviewReady(false);
    setIsExecuting(true);
  }, [language]);

  // Process message from WebView
  const handleMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      console.log("Webview message type:", msg.type);
      if (msg.type === "ready") {
        setIsWebviewReady(true);
      } else if (msg.type === "debug") {
        console.log("Webview DEBUG:", msg.data);
      } else if (msg.type === "trace") {
        const rawTrace = msg.data;
        let displayTrace = [];
        for (let i = 0; i < rawTrace.length; i++) {
          if (rawTrace[i].error || rawTrace[i].line === -1) {
            displayTrace.push(rawTrace[i]);
            continue;
          }

          let current = { ...rawTrace[i] };
          let nextVars = current.vars;
          let nextGlobs = current.globs;
          let nextFrames = current.frames;

          for (let j = i + 1; j < rawTrace.length; j++) {
            if (rawTrace[j].func !== current.func || rawTrace[j].line === -1) {
              break;
            }
            if (rawTrace[j].line !== current.line) {
              nextVars = rawTrace[j].vars;
              nextGlobs = rawTrace[j].globs;
              nextFrames = rawTrace[j].frames;
              break;
            }
          }

          current.vars = nextVars;
          current.globs = nextGlobs;
          if (nextFrames) current.frames = nextFrames;

          if (displayTrace.length > 0) {
            let prev = displayTrace[displayTrace.length - 1];
            let framesMatch = true;
            if (prev.frames && current.frames) {
              framesMatch =
                JSON.stringify(prev.frames) === JSON.stringify(current.frames);
            } else if (prev.frames || current.frames) {
              framesMatch = false;
            }
            if (
              prev.line === current.line &&
              JSON.stringify(prev.vars) === JSON.stringify(current.vars) &&
              framesMatch &&
              prev.func === current.func
            ) {
              continue;
            }
          }
          displayTrace.push(current);
        }
        setTraceLogs(displayTrace);
        setIsExecuting(false);
        if (displayTrace.length > 0) {
          setCurrentStep(0);
        }
      } else if (msg.type === "error") {
        setIsExecuting(false);
        setTraceLogs([{ error: msg.data }]);
        setCurrentStep(0);
      }
    } catch (e) {
      console.error("Error parsing message", e);
    }
  };

  useEffect(() => {
    const runRemoteCpp = async () => {
      try {
        const backendUrl = process.env.EXPO_PUBLIC_CPP_BACKEND_URL;
        if (!backendUrl) {
          console.warn("No EXPO_PUBLIC_CPP_BACKEND_URL provided, falling back to local JSCPP.");
          return false;
        }
        
        console.log(`Sending C++ code to remote backend: ${backendUrl}`);
        const response = await fetch(backendUrl + '/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: code, input: inputs || "" })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Simulate the format we expect from the WebView message
        handleMessage({ nativeEvent: { data: JSON.stringify(data) } });
        return true;
      } catch (e: any) {
        console.error("Remote C++ Execution Failed:", e);
        handleMessage({ nativeEvent: { data: JSON.stringify({ type: 'error', data: `Remote Execution Failed: ${e.message}\nFallback to JSCPP...` }) } });
        return false;
      }
    };

    if (isWebviewReady && code) {
      console.log(`Executing ${language} code now...`);
      
      if (language === "cpp" && process.env.EXPO_PUBLIC_CPP_BACKEND_URL) {
        runRemoteCpp(); // Do not fallback to JSCPP so we can see real fetch errors
      } else {
        let jsCode = "";
        if (language === "python") {
          jsCode = "runPythonCode(" + JSON.stringify(code) + ", " + JSON.stringify(inputs || "") + "); true;";
        } else {
          jsCode = "runCppCode(" + JSON.stringify(code) + ", " + JSON.stringify(inputs || "") + "); true;";
        }
        webviewRef.current?.injectJavaScript(jsCode);
      }
    }
  }, [isWebviewReady, code, inputs, language]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying && currentStep < traceLogs.length - 1) {
      timer = setTimeout(() => {
        setCurrentStep((prev) => {
          const nextStep = prev + 1;
          const nextTrace = traceLogs[nextStep];
          if (nextTrace && nextTrace.line && nextTrace.line > 0 && breakpoints.has(nextTrace.line)) {
            setIsPlaying(false);
          }
          return nextStep;
        });
      }, playbackSpeed);
    } else if (isPlaying && currentStep >= traceLogs.length - 1) {
      setIsPlaying(false);
    }
    return () => clearTimeout(timer);
  }, [isPlaying, currentStep, traceLogs, playbackSpeed, breakpoints]);

  // Auto-scroll logic to center the EXECUTED line (previous line)
  const scrollToActiveLine = () => {
    const prevLineNum = (currentStep > 0 && traceLogs[currentStep - 1] && !traceLogs[currentStep - 1].error)
      ? traceLogs[currentStep - 1].line : undefined;
    
    // Target the executed line if it exists, otherwise fallback to executing line
    const targetLine = prevLineNum || activeTrace?.line;
    
    if (!targetLine || targetLine < 1) return;
    
    const layout = lineOffsets.current[targetLine];
    
    if (layout && codeScrollRef.current && scrollViewHeight > 0) {
      // Align to top of section with a small margin for better readability
      const targetY = Math.max(0, layout.y - 10);
      
      codeScrollRef.current.scrollTo({
        y: targetY,
        animated: false,
      });
    }
  };

  useEffect(() => {
    scrollToActiveLine();
  }, [activeTrace?.line, currentStep, scrollViewHeight]);

  // Declare activeTrace early so it is available everywhere below
  const activeTrace =
    currentStep >= 0 && currentStep < traceLogs.length
      ? traceLogs[currentStep]
      : null;

  // Compute changed variables and change log purely during render (derived state)
  const { currentChangedVars, changeLog } = useMemo(() => {
    const vars = new Set<string>();
    const log: {name: string; from: string; to: string}[] = [];

    if (currentStep > 0 && traceLogs[currentStep] && traceLogs[currentStep - 1]) {
      const prev = traceLogs[currentStep - 1];
      const curr = traceLogs[currentStep];

      const summarize = (v: any): string => {
        if (!v) return 'undefined';
        if (v._type === 'primitive') return String(v.data);
        if (v._type === 'list') return `[${(v.data || []).map((i: any) => summarize(i)).join(', ')}]`;
        if (v._type === 'raw') return String(v.data);
        return JSON.stringify(v.data ?? v).slice(0, 30);
      };

      // Check locals
      if (curr.vars && prev.vars) {
        for (const k in curr.vars) {
          if (JSON.stringify(curr.vars[k]) !== JSON.stringify(prev.vars[k])) {
            vars.add(`local:${k}`);
            log.push({ name: k, from: summarize(prev.vars[k]), to: summarize(curr.vars[k]) });
          }
        }
      }

      // Check globals
      if (curr.globs && prev.globs) {
        for (const k in curr.globs) {
          if (JSON.stringify(curr.globs[k]) !== JSON.stringify(prev.globs[k])) {
            vars.add(`global:${k}`);
            log.push({ name: k, from: summarize(prev.globs[k]), to: summarize(curr.globs[k]) });
          }
        }
      }

      // Check frames (for C++)
      if (curr.frames && prev.frames) {
        curr.frames.forEach((f: any, idx: number) => {
          const pf = prev.frames[idx];
          if (pf) {
            for (const k in f.vars) {
              if (JSON.stringify(f.vars[k]) !== JSON.stringify(pf.vars[k])) {
                vars.add(`${f.func}:${k}`);
                log.push({ name: k, from: summarize(pf.vars[k]), to: summarize(f.vars[k]) });
              }
            }
          }
        });
      }
    }
    return { currentChangedVars: vars, changeLog: log };
  }, [currentStep, traceLogs]);

  // Auto-scroll variables panel to center changed variable
  useEffect(() => {
    if (currentChangedVars.size > 0 && stateScrollRef.current && stateViewHeight > 0) {
      const firstChanged = Array.from(currentChangedVars)[0];
      const layout = varOffsets.current[firstChanged];
      if (layout) {
        // Align to top of variables section
        const targetY = Math.max(0, layout.y - 10);
        stateScrollRef.current.scrollTo({ y: targetY, animated: false });
      }
    }
  }, [currentStep, stateViewHeight, currentChangedVars]);

  const toggleBreakpoint = (lineNum: number) => {
    setBreakpoints((prev) => {
      const next = new Set(prev);
      if (next.has(lineNum)) next.delete(lineNum);
      else next.add(lineNum);
      return next;
    });
  };

  const togglePin = (varKey: string) => {
    setPinnedVars(prev => {
      const next = new Set(prev);
      if (next.has(varKey)) next.delete(varKey);
      else next.add(varKey);
      return next;
    });
  };

  const getPinnedVarValue = (varKey: string) => {
    if (!activeTrace) return undefined;
    
    if (varKey.startsWith("local:")) {
      const name = varKey.split(":")[1];
      if (activeTrace.vars && name in activeTrace.vars) return activeTrace.vars[name];
    } else if (varKey.startsWith("global:")) {
      const name = varKey.split(":")[1];
      if (activeTrace.globs && name in activeTrace.globs) return activeTrace.globs[name];
    } else {
      const [funcName, name] = varKey.split(":");
      if (activeTrace.frames) {
        const frame = activeTrace.frames.find((f: any) => f.func === funcName);
        if (frame && frame.vars && name in frame.vars) {
          return frame.vars[name];
        }
      }
    }
    return undefined;
  };

  const handleStepNext = () => {
    if (currentStep < traceLogs.length - 1) setCurrentStep(currentStep + 1);
  };
  const handleStepPrev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const handlePlayPause = () => setIsPlaying(!isPlaying);

  const handleShareJSON = async () => {
    setShowShareMenu(false);
    setIsSharing(true);
    await shareTraceAsJSON(params.algorithm as string || "Algorithm", code, language, traceLogs, { time: timeComplexity, space: spaceComplexity });
    setIsSharing(false);
  };

  const handleShareImage = async () => {
    setShowShareMenu(false);
    setIsSharing(true);
    await shareStepAsImage(visualizerContentRef, currentStep + 1);
    setIsSharing(false);
  };

  return (
    <View style={styles.container}>
      {/* Hidden Webview for Execution */}
      <View style={{ width: 0, height: 0, position: "absolute", opacity: 0 }}>
        <WebView
          ref={webviewRef}
          key={language}
          source={{
            html: language === "python" ? pyodideHtml : jscppHtml,
            baseUrl: "https://localhost",
          }}
          onMessage={handleMessage}
          originWhitelist={ORIGIN_WHITELIST}
          javaScriptEnabled={true}
        />
      </View>

      {isExecuting ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#38BDF8" />
          <Text style={styles.loadingText}>Analyzing your code...</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* ---- Floating top bar ---- */}
          <View style={[styles.floatingTopBar, isStateFullScreen && styles.floatingTopBarCompact]}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
              <Text style={styles.backBtnText}>{"\u2190"}</Text>
            </TouchableOpacity>
            {!isStateFullScreen && (
              <View style={styles.topBarTitleContainer}>
                <Text style={styles.topBarTitle}>Dry Run</Text>
                {(timeComplexity || spaceComplexity) && (
                  <View style={styles.complexityBadgeRow}>
                    {timeComplexity ? (
                      <View style={[styles.complexityBadge, styles.timeBadge]}>
                        <Text style={styles.timeBadgeText}>⏱ {timeComplexity}</Text>
                      </View>
                    ) : null}
                    {spaceComplexity ? (
                      <View style={[styles.complexityBadge, styles.spaceBadge]}>
                        <Text style={styles.spaceBadgeText}>💾 {spaceComplexity}</Text>
                      </View>
                    ) : null}
                  </View>
                )}
              </View>
            )}
            <View style={styles.topBarRight}>
              <TouchableOpacity 
                style={styles.headerIconBtn} 
                onPress={decreaseFontSize} 
                activeOpacity={0.7}
              >
                <Text style={styles.headerIconText}>A-</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.headerBtn} 
                onPress={increaseFontSize} 
                activeOpacity={0.7}
              >
                <Text style={styles.headerIconText}>A+</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.headerShareBtn} 
                onPress={() => setShowVisualPanel(!showVisualPanel)} 
                activeOpacity={0.7}
              >
                <Text style={{fontSize: 16, color: theme.text}}>{showVisualPanel ? "👁️" : "🙈"}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.headerShareBtn} 
                onPress={() => setShowShareMenu(true)} 
                activeOpacity={0.7}
              >
                <Share size={20} color="#38BDF8" />
              </TouchableOpacity>
            </View>
          </View>

          {/* mainLayout fills remaining space. Controls always float on top. */}
          <View style={styles.mainLayout} ref={visualizerContentRef} collapsable={false}>

            {/* Visual Panel */}
            {showVisualPanel && !isStateFullScreen && activeTrace && (activeTrace.vars || activeTrace.globs) && (
              <DataStructureVisualizer 
                vars={{ ...(activeTrace.globs || {}), ...(activeTrace.vars || {}) }} 
                theme={theme} 
              />
            )}

            {/* Full code view — kept mounted, toggled via display:none */}
            <View style={[styles.codeContainer, isStateFullScreen && { display: 'none' }]}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeader}>Code</Text>
                <Text style={[styles.sectionHeader, { color: '#38BDF8' }]}>
                  {currentStep + 1} / {traceLogs.length}
                </Text>
              </View>
              <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, {
                  width: `${traceLogs.length > 0 ? ((currentStep + 1) / traceLogs.length) * 100 : 0}%`
                }]} />
              </View>
              <ScrollView 
                ref={codeScrollRef}
                style={styles.codeScroll} 
                contentContainerStyle={{ paddingVertical: 8, paddingBottom: 24 }}
                onLayout={(e) => setScrollViewHeight(e.nativeEvent.layout.height)}
              >
                {(code || "").split("\n").map((line, index) => {
                  const isErrorLine = activeTrace?.error && activeTrace?.line === index + 1;
                  const currentLineNum = activeTrace?.line;
                  const prevLineNum = (currentStep > 0 && traceLogs[currentStep - 1] && !traceLogs[currentStep - 1].error)
                      ? traceLogs[currentStep - 1].line : undefined;
                  const isCurrentLine = currentLineNum === index + 1;
                  const isPrevLine = prevLineNum === index + 1 && !isCurrentLine;
                  return (
                    <View 
                      key={index} 
                      style={[styles.codeLine, isPrevLine && styles.prevLine, isCurrentLine && styles.activeLine, isErrorLine && styles.errorLine]}
                      onLayout={(e) => {
                        const { y, height } = e.nativeEvent.layout;
                        lineOffsets.current[index + 1] = { y, height };
                        const prevLineNum = (currentStep > 0 && traceLogs[currentStep - 1] && !traceLogs[currentStep - 1].error)
                          ? traceLogs[currentStep - 1].line : undefined;
                        const targetLine = prevLineNum || activeTrace?.line;
                        if (targetLine === index + 1) {
                          scrollToActiveLine();
                        }
                      }}
                    >
                      <TouchableOpacity 
                        style={styles.lineNumberContainer} 
                        onPress={() => toggleBreakpoint(index + 1)} 
                        activeOpacity={0.8}
                      >
                        {breakpoints.has(index + 1) && <View style={styles.breakpointDot} />}
                        <Text style={[styles.lineNumber, isPrevLine && { color: '#8aa1bf' }, breakpoints.has(index + 1) && styles.lineNumberBreakpoint]}>{index + 1}</Text>
                      </TouchableOpacity>
                      <Text style={[styles.codeText, { color: theme.text }]}>{line}</Text>
                    </View>
                  );
                })}
              </ScrollView>
            </View>

            {/* Mini code strip — kept mounted, toggled via display:none */}
            <View style={[styles.miniCodeContainer, !isStateFullScreen && { display: 'none' }]}>
              {(() => {
                const currentLineNum = activeTrace?.line;
                const prevLineNum = (currentStep > 0 && traceLogs[currentStep - 1] && !traceLogs[currentStep - 1].error)
                    ? traceLogs[currentStep - 1].line : undefined;
                const hasPrev = !!(prevLineNum && prevLineNum > 0 && prevLineNum !== currentLineNum);
                const hasCurrent = !!(currentLineNum && currentLineNum > 0);
                const actualExpanded = !hasPrev ? 'executing' : !hasCurrent ? 'executed' : expandedLine;
                return (
                  <View style={styles.miniCodeStrip}>
                    {hasPrev && (
                      actualExpanded === 'executed' ? (
                        <TouchableOpacity style={styles.miniCodePillExpanded} onPress={() => setExpandedLine(null)} activeOpacity={0.8}>
                          <View style={styles.miniCodePillHeader}>
                            <Text style={styles.miniCodePillLabel}>{"\u2713"} Executed</Text>
                            <Text style={styles.miniCodeCollapseHint}>tap to split {"\u21D4"}</Text>
                          </View>
                          <View style={[styles.miniCodePillLine, styles.prevLine]}>
                            <Text style={[styles.lineNumber, { color: '#8aa1bf', width: 26 }]}>{prevLineNum}</Text>
                            <Text style={[styles.miniCodePillText, { fontSize: 13, color: theme.text }]}>{(code || "").split("\n")[prevLineNum! - 1]?.trim()}</Text>
                          </View>
                        </TouchableOpacity>
                      ) : actualExpanded === 'executing' ? (
                        <TouchableOpacity style={styles.miniCodeTab} onPress={() => setExpandedLine('executed')} activeOpacity={0.8}>
                          <Text style={styles.miniCodeTabLabel}>{"\u2713"}</Text>
                          <Text style={styles.miniCodeTabLineNum}>{prevLineNum}</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity style={styles.miniCodePill} onPress={() => setExpandedLine('executed')} activeOpacity={0.8}>
                          <View style={styles.miniCodePillHeader}>
                            <Text style={styles.miniCodePillLabel}>Executed</Text>
                            <Text style={styles.miniCodeExpandHint}>{"\u21D4"}</Text>
                          </View>
                          <View style={[styles.miniCodePillLine, styles.prevLine]}>
                            <Text style={[styles.lineNumber, { color: '#8aa1bf', width: 22 }]}>{prevLineNum}</Text>
                            <Text style={[styles.miniCodePillText, { color: theme.text }]}>{(code || "").split("\n")[prevLineNum! - 1]?.trim()}</Text>
                          </View>
                        </TouchableOpacity>
                      )
                    )}
                    {hasPrev && hasCurrent && !actualExpanded && <View style={styles.miniCodeDivider} />}
                    {hasCurrent && (
                      actualExpanded === 'executing' ? (
                        <TouchableOpacity style={styles.miniCodePillExpanded} onPress={() => setExpandedLine(null)} activeOpacity={0.8}>
                          <View style={styles.miniCodePillHeader}>
                            <Text style={[styles.miniCodePillLabel, { color: '#34D399' }]}>{"\u25B6"} Executing</Text>
                            <Text style={styles.miniCodeCollapseHint}>tap to split {"\u21D4"}</Text>
                          </View>
                          <View style={[styles.miniCodePillLine, styles.activeLine]}>
                            <Text style={[styles.lineNumber, { width: 26 }]}>{currentLineNum}</Text>
                            <Text style={[styles.miniCodePillText, { fontSize: 13, color: theme.text }]}>{(code || "").split("\n")[currentLineNum! - 1]?.trim()}</Text>
                          </View>
                        </TouchableOpacity>
                      ) : actualExpanded === 'executed' ? (
                        <TouchableOpacity style={[styles.miniCodeTab, { borderColor: '#064E3B' }]} onPress={() => setExpandedLine('executing')} activeOpacity={0.8}>
                          <Text style={[styles.miniCodeTabLabel, { color: '#34D399' }]}>{"\u25B6"}</Text>
                          <Text style={styles.miniCodeTabLineNum}>{currentLineNum}</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity style={[styles.miniCodePill, { flex: 1.4 }]} onPress={() => setExpandedLine('executing')} activeOpacity={0.8}>
                          <View style={styles.miniCodePillHeader}>
                            <Text style={[styles.miniCodePillLabel, { color: '#34D399' }]}>Executing</Text>
                            <Text style={styles.miniCodeExpandHint}>{"\u21D4"}</Text>
                          </View>
                          <View style={[styles.miniCodePillLine, styles.activeLine]}>
                            <Text style={[styles.lineNumber, { width: 22 }]}>{currentLineNum}</Text>
                            <Text style={[styles.miniCodePillText, { color: theme.text }]}>{(code || "").split("\n")[currentLineNum! - 1]?.trim()}</Text>
                          </View>
                        </TouchableOpacity>
                      )
                    )}
                    {!hasCurrent && !hasPrev && (
                      <Text style={[styles.miniCodePillLabel, { color: '#64748B', alignSelf: 'center', flex: 1, textAlign: 'center' }]}>
                        {"\u2713"} All lines executed
                      </Text>
                    )}
                  </View>
                );
              })()}
            </View>

            {/* Variables panel */}
            <View style={[styles.stateContainer, isStateFullScreen && { flex: 1 }]}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeader}>Variables</Text>
                <TouchableOpacity onPress={() => setIsStateFullScreen(!isStateFullScreen)} style={styles.iconBtn}>
                  <Text style={[styles.iconBtnText, { color: theme.accentLight }]}>{isStateFullScreen ? "\u2199 Collapse" : "\u2197 Expand"}</Text>
                </TouchableOpacity>
              </View>
              <ScrollView 
                ref={stateScrollRef}
                style={styles.stateScroll} 
                contentContainerStyle={{ padding: 12, paddingBottom: isStateFullScreen ? 120 : 40 }}
                onLayout={(e) => setStateViewHeight(e.nativeEvent.layout.height)}
              >
                {pinnedVars.size > 0 && (
                  <View style={[styles.scopeContainer, { borderColor: 'rgba(252, 211, 77, 0.3)', borderWidth: 1, backgroundColor: 'rgba(252, 211, 77, 0.05)' }]}>
                    <Text style={[styles.scopeHeaderText, { color: '#FCD34D' }]}>📌 Pinned Variables (Watch)</Text>
                    {Array.from(pinnedVars).map(varKey => {
                      const val = getPinnedVarValue(varKey);
                      const displayName = varKey.split(":")[1];
                      return (
                        <TouchableOpacity 
                          key={`watch-${varKey}`}
                          activeOpacity={0.7}
                          onLongPress={() => togglePin(varKey)}
                          style={styles.varRow}
                        >
                          <View style={styles.varNameContainer}><Text style={styles.varName}>{displayName}</Text></View>
                          <View style={styles.varValueContainer}>
                            {val !== undefined ? (
                              <VariableViewer variable={val} />
                            ) : (
                              <Text style={{ color: '#64748B', fontStyle: 'italic', fontSize: 13 }}>Out of scope</Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
                {activeTrace?.frames && activeTrace.frames.length > 0 ? (
                  activeTrace.frames.map((frame, frameIdx) => (
                    <View 
                      key={`frame-${frameIdx}-${frame.func}`} 
                      style={styles.scopeContainer}
                      onLayout={(e) => {
                        scopeOffsets.current[frame.func] = e.nativeEvent.layout.y;
                      }}
                    >
                      <Text style={styles.scopeHeaderText}>Local Scope ({frame.func})</Text>
                      {Object.keys(frame.vars).length > 0 ? (
                        Object.entries(frame.vars).map(([name, value]) => {
                          const varKey = `${frame.func}:${name}`;
                          const isHighlighted = currentChangedVars.has(varKey);
                          return (
                            <TouchableOpacity 
                              key={name} 
                              activeOpacity={0.7}
                              onLongPress={() => togglePin(varKey)}
                              style={[styles.varRow, isHighlighted && styles.varRowHighlighted]}
                              onLayout={(e) => {
                                const { y, height } = e.nativeEvent.layout;
                                const absoluteY = (scopeOffsets.current[frame.func] || 0) + y;
                                varOffsets.current[varKey] = { y: absoluteY, height };
                              }}
                            >
                              <View style={styles.varNameContainer}>
                                <Text style={styles.varName}>
                                  {String(name)}
                                  {pinnedVars.has(varKey) && <Text style={{ fontSize: 10, color: '#FCD34D' }}> 📌</Text>}
                                </Text>
                              </View>
                              <View style={styles.varValueContainer}><VariableViewer variable={value} /></View>
                            </TouchableOpacity>
                          );
                        })
                      ) : (
                        <Text style={styles.emptyState}>No local variables tracked in {frame.func}.</Text>
                      )}
                    </View>
                  ))
                ) : (
                  <>
                    {activeTrace?.func && activeTrace.func !== "Global Scope" && (
                      <Text style={styles.scopeHeaderText}>Local Scope ({activeTrace.func})</Text>
                    )}
                    {!activeTrace || !activeTrace.vars || Object.keys(activeTrace.vars).length === 0 ? (
                      <Text style={styles.emptyState}>No local variables tracked.</Text>
                    ) : (
                      Object.entries(activeTrace.vars).map(([name, value]) => {
                        const varKey = `local:${name}`;
                        const isHighlighted = currentChangedVars.has(varKey);
                        return (
                          <TouchableOpacity 
                            key={name} 
                            activeOpacity={0.7}
                            onLongPress={() => togglePin(varKey)}
                            style={[styles.varRow, isHighlighted && styles.varRowHighlighted]}
                            onLayout={(e) => {
                              const { y, height } = e.nativeEvent.layout;
                              // Top-level local vars in Python are not nested in a scopeContainer
                              varOffsets.current[varKey] = { y, height };
                            }}
                          >
                            <View style={styles.varNameContainer}>
                              <Text style={styles.varName}>
                                {String(name)}
                                {pinnedVars.has(varKey) && <Text style={{ fontSize: 10, color: '#FCD34D' }}> 📌</Text>}
                              </Text>
                            </View>
                            <View style={styles.varValueContainer}><VariableViewer variable={value} /></View>
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </>
                )}
                {activeTrace?.globs && Object.keys(activeTrace.globs).length > 0 && (
                  <View 
                    style={styles.globalsContainer}
                    onLayout={(e) => {
                      scopeOffsets.current['global'] = e.nativeEvent.layout.y;
                    }}
                  >
                    <Text style={styles.scopeHeaderText}>Global Scope</Text>
                    {Object.entries(activeTrace.globs).map(([name, value]) => {
                      const varKey = `global:${name}`;
                      const isHighlighted = currentChangedVars.has(varKey);
                      return (
                        <TouchableOpacity 
                          key={name} 
                          activeOpacity={0.7}
                          onLongPress={() => togglePin(varKey)}
                          style={[styles.varRow, isHighlighted && styles.varRowHighlighted]}
                          onLayout={(e) => {
                            const { y, height } = e.nativeEvent.layout;
                            const absoluteY = (scopeOffsets.current['global'] || 0) + y;
                            varOffsets.current[varKey] = { y: absoluteY, height };
                          }}
                        >
                          <View style={styles.varNameContainer}>
                            <Text style={styles.varName}>
                              {String(name)}
                              {pinnedVars.has(varKey) && <Text style={{ fontSize: 10, color: '#FCD34D' }}> 📌</Text>}
                            </Text>
                          </View>
                          <View style={styles.varValueContainer}><VariableViewer variable={value} /></View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
                {activeTrace?.error && (
                  <Text style={styles.errorText}>{friendlyError(activeTrace.error)}</Text>
                )}
                {/* Change Log */}
                {changeLog.length > 0 && (
                  <View style={styles.changeLogContainer}>
                    <Text style={styles.changeLogTitle}>CHANGES THIS STEP</Text>
                    {changeLog.map((entry, i) => (
                      <View key={i} style={styles.changeLogRow}>
                        <Text style={styles.changeLogName}>{entry.name}</Text>
                        <Text style={styles.changeLogFrom}>{entry.from}</Text>
                        <Text style={styles.changeLogArrow}>{' \u2192 '}</Text>
                        <Text style={styles.changeLogTo}>{entry.to}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            </View>

            {/* Console â€” hidden in fullscreen */}
            {!isStateFullScreen && (
              <View style={styles.outputContainer}>
                <TouchableOpacity style={styles.sectionHeaderRow} onPress={() => setIsConsoleExpanded(!isConsoleExpanded)}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Text style={styles.sectionHeader}>Console</Text>
                    {expectedOutput && currentStep === traceLogs.length - 1 && activeTrace && !activeTrace.error && (
                      <View style={[
                        styles.diffBadge, 
                        normalizeOutput(String(activeTrace.output)) === normalizeOutput(expectedOutput) ? styles.diffBadgePass : styles.diffBadgeFail
                      ]}>
                        <Text style={styles.diffBadgeText}>
                          {normalizeOutput(String(activeTrace.output)) === normalizeOutput(expectedOutput) ? '✅ PASS' : '❌ FAIL'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.iconBtnText}>{isConsoleExpanded ? "\u25B2" : "\u25BC"}</Text>
                </TouchableOpacity>
                {isConsoleExpanded && (
                  <ScrollView style={styles.outputScroll} contentContainerStyle={{ padding: 12, paddingBottom: 20 }}>
                    <Text style={styles.outputText}>{activeTrace?.output ? String(activeTrace.output) : "> "}</Text>
                    {expectedOutput && currentStep === traceLogs.length - 1 && activeTrace && !activeTrace.error && normalizeOutput(String(activeTrace.output)) !== normalizeOutput(expectedOutput) && (
                      <View style={styles.diffContainer}>
                        <Text style={styles.diffHeader}>Expected Output:</Text>
                        <Text style={styles.diffExpectedText}>{expectedOutput}</Text>
                      </View>
                    )}
                  </ScrollView>
                )}
              </View>
            )}
            
            {/* Controls — Floats in fullscreen, sits at bottom in normal view */}
          <View style={[
            styles.controlsBar,
            isStateFullScreen ? styles.controlsBarFloating : styles.controlsBarNormal,
            isStateFullScreen && styles.controlsBarCompact,
          ]}>
            {/* Speed buttons */}
            <View style={styles.speedBtnGroup}>
              {[{ label: '0.5x', ms: 1600 }, { label: '1x', ms: 800 }, { label: '2x', ms: 400 }, { label: '5x', ms: 160 }].map(s => (
                <TouchableOpacity
                  key={s.ms}
                  style={[styles.speedBtn, playbackSpeed === s.ms && styles.speedBtnActive]}
                  onPress={() => setPlaybackSpeed(s.ms)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.speedBtnText, playbackSpeed === s.ms && styles.speedBtnTextActive]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.navBtnGroup}>
              <TouchableOpacity 
                style={[styles.controlIconBtn, currentStep <= 0 && styles.controlBtnDisabled]} 
                onPress={handleStepPrev} 
                disabled={currentStep <= 0}
                activeOpacity={0.7}
              >
                <Text style={[styles.controlIconText, currentStep <= 0 && styles.disabledText]}>{"\u2190"}</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.controlIconBtnPlay, isPlaying && styles.controlBtnActive]} 
                onPress={handlePlayPause}
                activeOpacity={0.8}
              >
                <Text style={styles.controlIconTextPlay}>{isPlaying ? "\u2016" : "\u25B6"}</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.controlIconBtn, currentStep >= traceLogs.length - 1 && styles.controlBtnDisabled]} 
                onPress={handleStepNext} 
                disabled={currentStep >= traceLogs.length - 1}
                activeOpacity={0.7}
              >
                <Text style={[styles.controlIconText, currentStep >= traceLogs.length - 1 && styles.disabledText]}>{"\u2192"}</Text>
              </TouchableOpacity>
            </View>
          </View>
          </View>
        </View>
      )}
      {/* ---- Share Menu Modal ---- */}
      <Modal
        visible={showShareMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setShowShareMenu(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowShareMenu(false)}
        >
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.shareSheet}>
            <View style={styles.shareHeader}>
              <Text style={styles.shareTitle}>Share Dry Run</Text>
              <TouchableOpacity onPress={() => setShowShareMenu(false)}>
                <X size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <View style={styles.shareOptions}>
              <TouchableOpacity 
                style={styles.shareOption} 
                onPress={handleShareJSON}
                activeOpacity={0.8}
              >
                <View style={[styles.shareIconBox, { backgroundColor: 'rgba(56, 189, 248, 0.1)' }]}>
                  <FileJson size={24} color="#38BDF8" />
                </View>
                <View style={styles.shareTextContent}>
                  <Text style={styles.shareOptionTitle}>Export Full Trace</Text>
                  <Text style={styles.shareOptionDesc}>Save code and all steps as a .json file</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.shareOption} 
                onPress={handleShareImage}
                activeOpacity={0.8}
              >
                <View style={[styles.shareIconBox, { backgroundColor: 'rgba(244, 114, 182, 0.1)' }]}>
                  <Camera size={24} color="#F472B6" />
                </View>
                <View style={styles.shareTextContent}>
                  <Text style={styles.shareOptionTitle}>Save Step Snapshot</Text>
                  <Text style={styles.shareOptionDesc}>Save current variables as a .png image</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Global Sharing Overlay */}
      {isSharing && (
        <View style={styles.sharingOverlay}>
          <BlurView intensity={40} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          <ActivityIndicator size="large" color={theme.accentLight} />
          <Text style={styles.sharingText}>Generating Shareable Content...</Text>
        </View>
      )}
    </View>
  );
}

function createStyles(theme: any, isDark: boolean, fontSize: number = 14) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },

  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.background },
  loadingText: { color: theme.textMuted, marginTop: 16, fontSize: 16, fontWeight: "500" },
  
  mainLayout: { flex: 1, flexDirection: "column", paddingHorizontal: 12, paddingBottom: 8 },
  codeContainer: { flex: 2, backgroundColor: theme.card, borderRadius: 16, overflow: "hidden", marginBottom: 12, elevation: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0.3 : 0.1, shadowRadius: 8 },
  stateContainer: { flex: 1.5, backgroundColor: theme.card, borderRadius: 16, overflow: "visible", elevation: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0.3 : 0.1, shadowRadius: 8 },

  sectionHeader: {
    color: theme.textMuted,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  codeScroll: { flex: 1 },
  codeLine: { 
    flexDirection: "row", 
    paddingHorizontal: 12, 
    paddingVertical: 2,
    marginHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'transparent', // Maintain layout stability
  },
  
  // Execution progress bar
  progressBarTrack: {
    height: 2,
    backgroundColor: isDark ? '#1E293B' : '#E2E8F0',
    marginHorizontal: 12,
    marginBottom: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 2,
    backgroundColor: theme.accentLight,
    borderRadius: 2,
  },
  
  activeLine: { backgroundColor: isDark ? "#064E3B" : "#D1FAE5", borderColor: theme.accentLight },
  prevLine: { backgroundColor: isDark ? "#1E3A8A" : "#DBEAFE", borderColor: theme.accent },
  errorLine: { backgroundColor: isDark ? "#7F1D1D" : "#FEE2E2", borderColor: "#EF4444" },
  
  lineNumberContainer: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexDirection: 'row',
    marginRight: 12,
    position: 'relative',
  },
  breakpointDot: {
    position: 'absolute',
    left: 2,
    width: 8,
    height: 8,
    borderRadius: 8,
    backgroundColor: '#EF4444',
  },
  lineNumber: {
    color: theme.textMuted,
    width: 28,
    textAlign: "right",
    fontFamily: "monospace",
  },
  lineNumberBreakpoint: {
    color: '#EF4444',
    fontWeight: 'bold',
  },
  codeText: { color: theme.text, fontFamily: "monospace", fontSize: fontSize },
  
  stateScroll: { flex: 1, paddingHorizontal: 4 },
  emptyState: { color: theme.textMuted, fontStyle: "italic", marginLeft: 12 },
  
  varRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.cardBorder,
    marginHorizontal: 12,
    borderRadius: 12,
    paddingLeft: 12,
  },
  varRowHighlighted: {
    backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(14, 165, 233, 0.08)',
    borderLeftWidth: 4,
    borderLeftColor: theme.accentLight,
    paddingLeft: 8,
  },
  varName: { color: theme.accentLight, fontWeight: "bold", fontFamily: "monospace", fontSize: fontSize },
  varNameContainer: { flex: 1, paddingRight: 8, justifyContent: "center" },
  varValueContainer: { flex: 3 },
  varValue: { color: isDark ? "#34D399" : "#059669", fontFamily: "monospace", fontSize: fontSize },
  
  arrayContainer: { flexDirection: "row", paddingVertical: 4, flexWrap: "wrap" },
  arrayItem: {
    borderWidth: 1,
    borderColor: theme.cardBorder,
    backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
    borderRadius: 8,
    marginRight: 6,
    marginBottom: 6,
    alignItems: "center",
    minWidth: 44,
    overflow: "hidden",
  },
  arrayItemValue: {
    color: theme.text,
    fontFamily: "monospace",
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: fontSize,
  },
  arrayItemIndex: {
    color: theme.textMuted,
    fontSize: 10,
    backgroundColor: isDark ? "#0F172A" : "#F1F5F9",
    width: "100%",
    textAlign: "center",
    paddingVertical: 3,
    borderTopWidth: 1,
    borderTopColor: theme.cardBorder,
  },
  
  dictContainer: {
    borderWidth: 1,
    borderColor: theme.cardBorder,
    borderRadius: 12,
    padding: 10,
    backgroundColor: isDark ? "#1E293B" : "#F8FAFC",
    marginTop: 6,
  },
  dictRow: { flexDirection: "row", paddingVertical: 4 },
  dictKey: { color: theme.accentLight, fontFamily: "monospace" },
  dictSeparator: { color: theme.textMuted, fontFamily: "monospace", marginHorizontal: 6 },
  dictValue: { color: isDark ? "#F472B6" : "#DB2777", fontFamily: "monospace" },
  
  collapsibleContainer: { marginBottom: 6 },
  dictMainContainer: { marginBottom: 6 },
  
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingRight: 8,
  },
  iconBtn: { paddingHorizontal: 16, paddingVertical: 12 },
  iconBtnText: { color: theme.accentLight, fontSize: 13, fontWeight: "700", letterSpacing: 0.5 },
  
  miniCodeContainer: {
    backgroundColor: theme.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.2 : 0.05,
    shadowRadius: 4,
  },
  miniCodeStrip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 6,
  },
  // Default split pill
  miniCodePill: {
    flex: 1,
    minWidth: 0,
  },
  // Fully expanded pill (full row)
  miniCodePillExpanded: {
    flex: 1,
    minWidth: 0,
  },
  miniCodePillHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  miniCodePillLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: theme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  miniCodeExpandHint: { fontSize: 11, color: theme.textMuted },
  miniCodeCollapseHint: { fontSize: 9, color: theme.textMuted, fontWeight: '600', letterSpacing: 0.3 },
  miniCodePillLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  miniCodePillText: {
    color: theme.text,
    fontFamily: 'monospace',
    fontSize: 12,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  // Slim collapsed tab shown when the sibling is expanded
  miniCodeTab: {
    width: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.accent,
    backgroundColor: theme.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 2,
  },
  miniCodeTabLabel: {
    fontSize: 12,
    color: theme.textDim,
  },
  miniCodeTabLineNum: {
    fontSize: 9,
    color: theme.textMuted,
    fontFamily: 'monospace',
    fontWeight: '700',
  },
  miniCodeDivider: {
    width: 1,
    backgroundColor: theme.cardBorder,
    borderRadius: 1,
    alignSelf: 'stretch',
    marginVertical: 4,
  },
  
  errorText: { color: "#EF4444", marginTop: 12, fontWeight: "bold", marginHorizontal: 12 },
  
  scopeHeaderText: {
    color: theme.textMuted,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
    marginLeft: 12,
    marginTop: 8,
  },
  scopeContainer: {
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    overflow: "hidden",
  },
  globalsContainer: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: theme.cardBorder,
    paddingTop: 16,
  },
  
  outputContainer: {
    backgroundColor: theme.card,
    borderRadius: 12,
    margin: 12,
    marginTop: 'auto',
    marginBottom: 12,
  },
  outputScroll: { maxHeight: 180 },
  outputText: { color: theme.text, fontFamily: "monospace" },
  diffBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  diffBadgePass: { backgroundColor: '#064E3B' },
  diffBadgeFail: { backgroundColor: '#7F1D1D' },
  diffBadgeText: { color: '#F1F5F9', fontSize: 10, fontWeight: '800' },
  diffContainer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.cardBorder,
    paddingTop: 12,
  },
  diffHeader: {
    color: theme.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  diffExpectedText: {
    color: isDark ? "#34D399" : "#059669",
    fontFamily: 'monospace',
  },
  
  // ── Floating top bar ──
  floatingTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 52, // safe area offset
    paddingBottom: 10,
    backgroundColor: theme.background,
  },
  floatingTopBarCompact: {
    paddingTop: 52,
    paddingBottom: 6,
  },
  headerShareBtn: {
    width: 38,
    height: 38,
    borderRadius: 100,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 100,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  headerIconText: {
    color: theme.text,
    fontWeight: '700',
    fontSize: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 100,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    color: theme.text,
    fontSize: 18,
    fontWeight: '700',
  },
  topBarTitle: {
    color: theme.textDim,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  topBarRight: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepBadge: {
    color: theme.accentLight,
    fontSize: 14,
    fontWeight: '800',
  },
  stepBadgeDim: {
    color: theme.textMuted,
    fontWeight: '600',
  },


  controlsBar: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  controlsBarNormal: {
    backgroundColor: theme.background,
    paddingHorizontal: 24,
    paddingBottom: 28,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.cardBorder,
  },
  controlsBarFloating: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
    borderRadius: 100,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: isDark ? 0.5 : 0.1,
    shadowRadius: 15,
  },
  controlsBarCompact: {
    bottom: 16,
    gap: 16,
  },
  controlIconBtn: {
    width: 52,
    height: 52,
    borderRadius: 100,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  controlIconBtnPlay: {
    width: 64,
    height: 64,
    borderRadius: 100,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  controlBtnActive: { backgroundColor: theme.accentLight },
  controlBtnDisabled: { opacity: 0.3 },
  controlIconText: { color: theme.text, fontSize: 24, fontWeight: "600" },
  controlIconTextPlay: { color: "#FFFFFF", fontSize: 22, fontWeight: "800" },
  disabledText: { color: theme.textMuted },
  speedBtnGroup: { flexDirection: 'row', gap: 6, backgroundColor: theme.card, padding: 4, borderRadius: 12, borderWidth: 1, borderColor: theme.cardBorder },
  speedBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  speedBtnActive: { backgroundColor: theme.accent },
  speedBtnText: { color: theme.textMuted, fontSize: 11, fontWeight: '700' },
  speedBtnTextActive: { color: '#FFFFFF' },
  navBtnGroup: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  errorText: { color: '#F87171', padding: 16, textAlign: 'center', fontFamily: 'monospace', fontWeight: '700' },
  changeLogContainer: { marginTop: 12, padding: 12, backgroundColor: isDark ? "rgba(56, 189, 248, 0.05)" : "rgba(14, 165, 233, 0.02)", borderRadius: 12, borderLeftWidth: 3, borderLeftColor: theme.accentLight },
  changeLogTitle: { color: theme.accentLight, fontSize: 10, fontWeight: "800", marginBottom: 8, letterSpacing: 0.5 },
  changeLogRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  changeLogName: { color: theme.text, fontFamily: 'monospace', fontSize: 12, fontWeight: '700', marginRight: 6, minWidth: 60 },
  changeLogFrom: { color: '#F87171', fontFamily: 'monospace', fontSize: 12 },
  changeLogArrow: { color: theme.textMuted, fontSize: 12, fontWeight: '700' },
  changeLogTo: { color: isDark ? '#34D399' : '#059669', fontFamily: 'monospace', fontSize: 12, fontWeight: '700' },
  
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  // Share Menu Styles
  shareSheet: {
    backgroundColor: theme.card,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 60,
    borderTopWidth: 1,
    borderColor: theme.accent,
  },
  shareHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  shareTitle: { color: theme.text, fontSize: 20, fontWeight: '800', letterSpacing: 0.5 },
  shareOptions: { gap: 16 },
  shareOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.inputBg, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: theme.cardBorder },
  shareIconBox: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  shareTextContent: { flex: 1 },
  shareOptionTitle: { color: theme.text, fontSize: 16, fontWeight: '700' },
  shareOptionDesc: { color: theme.textMuted, fontSize: 12, marginTop: 2 },
  sharingOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
  sharingText: { color: theme.accentLight, marginTop: 16, fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  });
}
