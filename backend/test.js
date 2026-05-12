const code = `
#include <iostream>
using namespace std;

int orig_val[100]; int orig_nxt[100];
int clone_val[100]; int clone_nxt[100];

int cloneList(int head) {
    for (int i = 0; i < 100; i++) {
        if (orig_val[i] == 0 && orig_nxt[i] == 0) break;
        clone_val[i] = orig_val[i];
        clone_nxt[i] = orig_nxt[i];
    }
    return head;
}

int main() {
    orig_val[1] = 10; orig_nxt[1] = 2;
    orig_val[2] = 20; orig_nxt[2] = 3;
    orig_val[3] = 30; orig_nxt[3] = -1;
    int head = 1;

    int p = head;
    cout << "Original: ";
    while (p != -1) { cout << orig_val[p] << " "; p = orig_nxt[p]; }
    
    int cloned_head = cloneList(head);
    
    cout << "\nClone: ";
    int q = cloned_head;
    while (q != -1) { cout << clone_val[q] << " "; q = clone_nxt[q]; }
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
      console.log("Last Step:", d.data[d.data.length-1]);
    } else {
      console.log(d);
    }
}).catch(console.error);
