#include <iostream>
using namespace std;
struct Node { int val; Node* left; Node* right; Node(int x) : val(x), left(NULL), right(NULL) {} };
int main() { Node* root = new Node(10); root->left = new Node(5); root->right = new Node(20); root->left->left = new Node(2); root->left->right = root; return 0; }
