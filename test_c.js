const JSCPP = require('JSCPP');

const code = `
void myMethod() {
    const char* ___func_marker___ = "myMethod";
    int a = 1;
}
int main() {
    myMethod();
    return 0;
}
`;

const config = { debug: true };
const debugger_inst = JSCPP.run(code, "", config);
let done = false;
while (!done) {
    var node = debugger_inst.nextNode();
    while (!node || (!node.sLine && !node.line)) {
        done = debugger_inst.next();
        if (done) break;
        node = debugger_inst.nextNode();
    }
    if (done) break;
    
    var scopeArray = debugger_inst.rt.scope;
    for (var si = 1; si < scopeArray.length; si++) {
        var sVars = scopeArray[si].variables || scopeArray[si];
        if (sVars && sVars['___func_marker___']) {
            console.log(JSON.stringify(sVars['___func_marker___'], (k, v) => (k === 'rt' || k === 'parent') ? undefined : v, 2));
            process.exit(0);
        }
    }
    done = debugger_inst.next();
}
