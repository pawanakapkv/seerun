const code = `
#include <iostream>
using namespace std;

struct Node {
    int val;
    Node* left;
    Node* right;
    Node(int x) : val(x), left(NULL), right(NULL) {}
};

int main() {
    Node* root = new Node(10);
    root->left = new Node(5);
    root->right = new Node(20);
    root->left->left = new Node(2);
    
    // cyclic link
    root->left->right = root;

    cout << "Done" << endl;
    return 0;
}
`;

fetch('http://localhost:8080/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: code, input: '' })
}).then(r => r.json()).then(d => {
    if (d.data) {
      console.log("Total Steps:", d.data.length);
      const lastStep = d.data[d.data.length-1];
      console.log("Last Step Vars:", JSON.stringify(lastStep.vars, null, 2));
      console.log("Last Step Heap:", JSON.stringify(lastStep.heap, null, 2));
    } else {
      console.log(d);
    }
}).catch(console.error);
