global.window = global;
require('C:/Users/Pawan/.gemini/antigravity/brain/121db9ac-00b8-4a43-9b53-66b79c54daec/scratch/JSCPP.es5.min.js');
const JSCPP = window.JSCPP || window.jscpp;
const code = `
#include <iostream>
using namespace std;
class vector_int {
public:
    int data[1000];
    int size_val;
    vector_int() { size_val = 0; }
    void push_back(int x) { data[size_val++] = x; }
    int size() { return size_val; }
};

int main() {
    vector_int v;
    v.push_back(55);
    cout << v.size() << " " << v.data[0] << endl;
    return 0;
}
`;
try {
    JSCPP.run(code,"",{stdio:{write:s=>process.stdout.write(s)}});
} catch (e) {
    console.error("ERR:", e.toString());
}
