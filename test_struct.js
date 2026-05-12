global.window = global;
require('C:/Users/Pawan/.gemini/antigravity/brain/121db9ac-00b8-4a43-9b53-66b79c54daec/scratch/JSCPP.es5.min.js');
const JSCPP = window.JSCPP || window.jscpp;

const code = `
#include <iostream>
using namespace std;

int* merge_sort(int arr[], int arr_sz) {
    int res[100];
    res[0] = 99;
    res[1] = 88;
    return res;
}

int main() {
    int v[100];
    v[0] = 55;
    
    int* x = merge_sort(v, 1);
    
    cout << x[0] << " " << x[1] << endl;
    return 0;
}
`;

try {
    const config = {
        debug: true,
        stdio: {
            write: s => process.stdout.write("OUT: " + s)
        }
    };
    JSCPP.run(code, "", config);
} catch (e) {
    console.error("ERR:", e.toString());
}
