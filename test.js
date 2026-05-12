const codeOrig = `
#include <iostream>
#include <vector>

void findErrorNums(std::vector<int>& nums, std::vector<int>& result) {
    int n = nums.size();
    int xZORy = 0;
    
    for (int i = 1; i <= n; i++) {
        xZORy ^= i;
        xZORy ^= nums[i - 1];
    }
    int set_bit = xZORy & ~(xZORy - 1);
    
    int grp_01 = 0;
    int grp_02 = 0;
    
    for (int i = 1; i <= n; i++) {
        if (nums[i - 1] & set_bit) grp_01 ^= nums[i - 1];
        else grp_02 ^= nums[i - 1];
        
        if (i & set_bit) grp_01 ^= i;
        else grp_02 ^= i;
    }

    for (int i = 0; i < n; i++) {
        if (nums[i] == grp_01) {
            result.push_back(grp_01);
            result.push_back(grp_02);
            return;
        }
    }
    result.push_back(grp_02);
    result.push_back(grp_01);
}

int main() {
    std::vector<int> data1 = {1, 2, 2, 4};
    std::cout << "Input: 1 2 2 4\\n";
    std::vector<int> res1;
    findErrorNums(data1, res1);
    std::cout << "Duplicate: " << res1[0] << ", Missing: " << res1[1] << "\\n\\n";

    std::vector<int> data2 = {1, 1};
    std::cout << "Input: 1 1\\n";
    std::vector<int> res2;
    findErrorNums(data2, res2);
    std::cout << "Duplicate: " << res2[0] << ", Missing: " << res2[1] << "\\n\\n";

    std::vector<int> data3 = {3, 2, 3, 4, 6, 5};
    std::cout << "Input: 3 2 3 4 6 5\\n";
    std::vector<int> res3;
    findErrorNums(data3, res3);
    std::cout << "Duplicate: " << res3[0] << ", Missing: " << res3[1] << "\\n";

    return 0;
}
`;

function preprocessCpp(src) {
    var knownVectors = [];
    function markVec(name) {
        if (name && knownVectors.indexOf(name) < 0) knownVectors.push(name);
        return name;
    }

    src = src.replace(/std::/g, '');
    src = src.replace(/#include\s*<vector>\s*\\n?/g, '');

    src = src.replace(
        /\bvector\s*<\s*(int|float|char)\s*>\s+(\w+)\s*(?:\(\s*(\d+)\s*\))?\s*;/g,
        function(m, type, name, initN) {
            markVec(name);
            return type + ' ' + name + '[1000]; int ' + name + '_sz = ' + (initN || '0') + ';';
        }
    );


    src = src.replace(
        /\bvector\s*<\s*(int|float|char)\s*>\s+(\w+)\s*\(\s*(\w+)\.begin\s*\(\)\s*(?:\+\s*(\w+))?\s*,\s*(?:\3\.begin\s*\(\)\s*\+\s*(\w+)|\3\.end\s*\(\))\s*\)\s*;/g,
        function(m, type, name, arr, fromOff, toOff) {
            markVec(name);
            var from = fromOff ? fromOff : '0';
            var to   = toOff   ? toOff   : (arr + '_sz');
            return type + ' ' + name + '[1000]; int ' + name + '_sz = 0;' +
                   ' for(int __i = ' + from + '; __i < ' + to + '; __i++) ' +
                   name + '[' + name + '_sz++] = ' + arr + '[__i];';
        }
    );

    src = src.replace(
        /\bvector\s*<\s*(int|float|char)\s*>\s+(\w+)\s*(?:=\s*)?\{([^}]*)\}\s*;/g,
        function(m, type, name, elements) {
            markVec(name);
            var els = elements.trim();
            var arr = els ? els.split(',') : [];
            var count = 0;
            var assignments = "";
            for (var i = 0; i < arr.length; i++) {
                var el = arr[i].trim();
                if (el) { assignments += name + "[" + count + "] = " + el + "; "; count++; }
            }
            return type + ' ' + name + '[1000]; int ' + name + '_sz = ' + count + '; ' + assignments;
        }
    );

    src = src.replace(
        /\bvector\s*<\s*(int|float|char)\s*>\s+(\w+)\s*=\s*([^;]+);/g,
        function(m, type, name, expr) {
            markVec(name);
            return type + ' ' + name + '[1000]; int ' + name + '_sz = 0; ' + expr + ';';
        }
    );

    src = src.replace(
        /\bvector\s*<\s*(int|float|char)\s*>\s+(\w+)\s*(?=\()/g,
        function(m, type, fname) { return 'void ' + fname; }
    );
    src = src.replace(
        /\bvector\s*<\s*(int|float|char)\s*>\s+(\w+)/g,
        function(m, type, name) {
            markVec(name);
            return type + ' ' + name + '[], int ' + name + '_sz';
        }
    );

    src = src.replace(/\b(\w+)\.size\s*\(\s*\)/g, function(m, v) { return v + '_sz'; });

    for (var vi = 0; vi < knownVectors.length; vi++) {
        var vname = knownVectors[vi];
        var re = new RegExp('(?<![={])\\b' + vname + '\\b(?!_sz)(?!\\[)(?=\\s*[,)])', 'g');
        src = src.replace(re, vname + ', ' + vname + '_sz');
    }

    for (var vi = 0; vi < knownVectors.length; vi++) {
        var vname = knownVectors[vi];
        var reAssign = new RegExp('\\b' + vname + '\\s*=\\s*([^;]+);', 'g');
        src = src.replace(reAssign, function(m, expr) { return expr + ';'; });
    }

    for (var ri = 0; ri < knownVectors.length; ri++) {
        var rv = knownVectors[ri];
        src = src.replace(new RegExp('\\breturn\\s+' + rv + '\\s*;', 'g'), 'return;');
    }
    return src;
}

global.window = global;
require('C:/Users/Pawan/.gemini/antigravity/brain/121db9ac-00b8-4a43-9b53-66b79c54daec/scratch/JSCPP.es5.min.js');
const engine = window.JSCPP || window.jscpp;

const transpiledCode = preprocessCpp(codeOrig);

var trace_events_list = [];
var MAX_STEPS = 50;
var step_count = 0;
var last_line = -1;

function extractVars(scope) {
    var res = {};
    if (!scope) return res;
    var vars = scope.variables || scope;
    for (var name in vars) {
        if (name.startsWith('$')) continue;
        var v = vars[name];
        var typeObj = v ? (v.t || v.type) : null;
        if (typeObj) {
            var valObj = ('v' in v) ? v.v : ('value' in v ? v.value : v);
            try { res[name] = jsonifyCppVar({ type: typeObj, v: valObj }, 0); }
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
    if (tName === 'primitive') return { _type: 'primitive', data: val };
    
    // In JSCPP 2.0, arrays might be typed as pointers with ptrType='array'
    if (tName === 'array' || (tName === 'pointer' && type.ptrType === 'array')) {
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
    }
    
    if (tName === 'pointer') {
         return { _type: 'raw', data: '*' + (type.ptrType ? (type.ptrType.name || 'void') : 'void') };
    }
    
    return { _type: 'raw', data: String(val && val.target ? "[ptr object]" : val) };
}

try {
    var config = { debug: true, stdio: { write: function(s){ process.stdout.write(s); } } };
    var debugger_inst = engine.run(transpiledCode, "", config);
    var done = false;
    while (!done) {
        var node = debugger_inst.nextNode();
        while (!node || (!node.sLine && !node.line)) {
            done = debugger_inst.next();
            if (done) break;
            node = debugger_inst.nextNode();
        }
        if (done) break;

        var currentLine = node.sLine || node.line;
        if (currentLine !== last_line) {
            step_count++;
            last_line = currentLine;
            var scopeArray = debugger_inst.rt ? debugger_inst.rt.scope : [];
            var currentScope = null;
            if (scopeArray && scopeArray.length > 0) {
                currentScope = scopeArray[scopeArray.length - 1];
            }
            if (!currentScope && step_count === 1) { console.log('NO SCOPE AT ALL'); }
            var locs = extractVars(currentScope);
            
            var filteredLocs = {};
            for (var k in locs) if (!k.endsWith('_sz')) filteredLocs[k] = locs[k];
            for (var arrKey in filteredLocs) {
                var szKey = arrKey + '_sz';
                if (locs[szKey] !== undefined && filteredLocs[arrKey]._type === 'list') {
                    var szVal = locs[szKey].data;
                    if (typeof szVal === 'number' && szVal >= 0) filteredLocs[arrKey].data = filteredLocs[arrKey].data.slice(0, szVal);
                }
            }

            trace_events_list.push({
                line: currentLine,
                func: (debugger_inst.src.scope && debugger_inst.src.scope.name) ? debugger_inst.src.scope.name : 'main',
                vars: filteredLocs
            });
        }
        done = debugger_inst.next();
        if (step_count >= MAX_STEPS) break;
    }
    console.log("FINAL TRACE:", JSON.stringify(trace_events_list.slice(-3), null, 2));
} catch (e) {
    console.error("EXC:", e.toString());
}

