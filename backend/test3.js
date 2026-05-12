const code = `
#include <iostream>
using namespace std;

int orig_val[100]; int orig_nxt[100]; int orig_count = 0;
int clone_val[100]; int clone_nxt[100];

int createNode(int v) {
    orig_val[orig_count] = v;
    orig_nxt[orig_count] = -1;
    return orig_count++;
}

int cloneList(int head) {
    if (head == -1) return -1;
    for (int i = 0; i < orig_count; i++) {
        clone_val[i] = orig_val[i];
        clone_nxt[i] = orig_nxt[i];
    }
    return head;
}

int main() {
    int n; cout << "Count: "; cin >> n;
    int head = -1, curr = -1;
    for (int i = 0; i < n; i++) {
        int v; cin >> v;
        int node = createNode(v);
        if (head == -1) { head = node; curr = head; }
        else { orig_nxt[curr] = node; curr = node; }
    }
    int cloned_head = cloneList(head);
    cout << "Original: ";
    int p = head;
    while (p != -1) { cout << orig_val[p] << " "; p = orig_nxt[p]; }
    cout << "\\nClone: ";
    int q = cloned_head;
    while (q != -1) { cout << clone_val[q] << " "; q = clone_nxt[q]; }
    return 0;
}
`;

fetch('http://localhost:8080/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: code, input: '5\n10 20 30 40 50' })
}).then(r => r.json()).then(d => {
    if (d.data && d.data.length > 10) {
      console.log(JSON.stringify(d.data[10].globs.orig_val, null, 2));
    }
}).catch(console.error);
