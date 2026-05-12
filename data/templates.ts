export type TemplateAlgorithm = {
  name: string;
  python: { code: string; input: string };
  cpp: { code: string; input: string };
  time?: string;
  space?: string;
};

export const TEMPLATES: {
  category: string;
  emoji: string;
  items: TemplateAlgorithm[];
}[] = [
  {
    category: 'Linked List',
    emoji: '🔗',
    items: [
      {
        name: 'Find Middle',
        time: 'O(n)',
        space: 'O(1)',
        python: {
          input: '5\n10 20 30 40 50',
          code: `class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def build_list(nums):
    if not nums: return None
    head = ListNode(nums[0])
    curr = head
    for i in range(1, len(nums)):
        curr.next = ListNode(nums[i])
        curr = curr.next
    return head

def find_middle(head):
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
    return slow

n = int(input("Count: "))
nums = [int(x) for x in input("Numbers: ").split()]
head = build_list(nums)
mid = find_middle(head)
print("Middle:", mid.val if mid else "None")`
        },
        cpp: {
          input: '5\n10 20 30 40 50',
          code: `#include <iostream>
using namespace std;

class Node {
public:
    int data;
    Node* next;
    Node(int x) { data = x; next = NULL; }
};

Node* findMiddle(Node* head) {
    Node* slow = head;
    Node* fast = head;
    while (fast != NULL && fast->next != NULL) {
        slow = slow->next;
        fast = fast->next->next;
    }
    return slow;
}

int main() {
    int n; cout << "Count: "; cin >> n;
    Node* head = NULL;
    Node* curr = NULL;
    for (int i = 0; i < n; i++) {
        int v; cin >> v;
        Node* node = new Node(v);
        if (head == NULL) { head = node; curr = head; }
        else { curr->next = node; curr = node; }
    }
    Node* mid = findMiddle(head);
    cout << "Middle: " << (mid ? mid->data : -1) << endl;
    return 0;
}`
        }
      },
      {
        name: 'Clone List (with Random)',
        time: 'O(n)',
        space: 'O(1)',
        python: {
          input: '5\n10 20 30 40 50',
          code: `class Node:
    def __init__(self, val=0, next=None, random=None):
        self.val = val
        self.next = next
        self.random = random

def clone_list(head):
    if not head: return None
    # 1. Weave
    curr = head
    while curr:
        nn = Node(curr.val, curr.next)
        curr.next = nn
        curr = nn.next
    
    # 2. Random
    curr = head
    while curr:
        if curr.random:
            curr.next.random = curr.random.next
        curr = curr.next.next
        
    # 3. Unweave
    curr = head
    cloned_head = head.next
    while curr:
        copy = curr.next
        curr.next = copy.next
        if copy.next:
            copy.next = copy.next.next
        curr = curr.next
        
    return cloned_head

# Demo harness
head = Node(1)
head.next = Node(2)
head.next.next = Node(3)
head.random = head.next.next
head.next.random = head

print("Cloning list...")
cloned = clone_list(head)
print("Cloned head val:", cloned.val)`
        },
        cpp: {
          input: '5\n10 20 30 40 50',
          code: `#include <iostream>
#include <unordered_map>
using namespace std;

class Node {
public:
    int data;
    Node* next;
    Node* random;
    Node(int x) { data = x; next = random = NULL; }
};

Node* cloneLinkedList(Node* head) {
    unordered_map<Node*, Node*> mp;
    Node *curr = head;
    while (curr != NULL) {
        mp[curr] = new Node(curr->data);
        curr = curr->next;
    }
    curr = head;
    while (curr != NULL) {
        mp[curr]->next = mp[curr->next];
        mp[curr]->random = mp[curr->random];
        curr = curr->next;
    }
    return mp[head];
}

void printList(Node* head) {
    while (head != NULL) {
        cout << head->data << "(";
        if(head->random) cout << head->random->data << ")";
        else cout << "null)";
        if(head->next != NULL) cout << " -> ";
        head = head->next;
    }
    cout << endl;
}

int main() {
    Node* head = new Node(1);
    head->next = new Node(2);
    head->next->next = new Node(3);
    head->random = head->next->next;
    head->next->random = head;
    
    cout << "Original:\\n";
    printList(head);
    
    Node* cloned = cloneLinkedList(head);
    cout << "\\nCloned:\\n";
    printList(cloned);
    return 0;
}`
        }
      },
      {
        name: 'Reverse List',
        time: 'O(n)',
        space: 'O(1)',
        python: {
          input: '5\n1 2 3 4 5',
          code: `class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def build_list(nums):
    if not nums: return None
    head = ListNode(nums[0])
    curr = head
    for i in range(1, len(nums)):
        curr.next = ListNode(nums[i])
        curr = curr.next
    return head

def reverse_list(head):
    prev = None
    curr = head
    while curr:
        nxt = curr.next
        curr.next = prev
        prev = curr
        curr = nxt
    return prev

n = int(input("Count: "))
nums = [int(x) for x in input("Numbers: ").split()]
head = build_list(nums)
rev = reverse_list(head)
print("Reversed:", end=" ")
while rev:
    print(rev.val, end=" ")
    rev = rev.next`
        },
        cpp: {
          input: '5\n1 2 3 4 5',
          code: `#include <iostream>
using namespace std;

class Node {
public:
    int data;
    Node* next;
    Node(int x) { data = x; next = NULL; }
};

Node* reverseList(Node* head) {
    Node* prev = NULL;
    Node* curr = head;
    while (curr != NULL) {
        Node* nextTemp = curr->next;
        curr->next = prev;
        prev = curr;
        curr = nextTemp;
    }
    return prev;
}

int main() {
    int n; cout << "Count: "; cin >> n;
    Node* head = NULL;
    Node* curr = NULL;
    for (int i = 0; i < n; i++) {
        int v; cin >> v;
        Node* node = new Node(v);
        if (head == NULL) { head = node; curr = head; }
        else { curr->next = node; curr = node; }
    }
    
    Node* rev = reverseList(head);
    cout << "Reversed: ";
    while (rev != NULL) {
        cout << rev->data << " ";
        rev = rev->next;
    }
    cout << endl;
    return 0;
}`
        }
      }
    ]
  },
  {
    category: 'Arrays',
    emoji: '📊',
    items: [
      {
        name: 'Binary Search',
        time: 'O(log n)',
        space: 'O(1)',
        python: {
          input: '6\n2 4 6 8 10 12\n8',
          code: `def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = left + (right - left) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1

n = int(input("Count: "))
arr = [int(x) for x in input("Array: ").split()]
target = int(input("Target: "))
idx = binary_search(arr, target)
print("Found at index:", idx)`
        },
        cpp: {
          input: '6\n2 4 6 8 10 12\n8',
          code: `#include <iostream>
using namespace std;

int binarySearch(int arr[], int n, int target) {
    int left = 0;
    int right = n - 1;
    while (left <= right) {
        int mid = left + (right - left) / 2;
        if (arr[mid] == target) return mid;
        else if (arr[mid] < target) left = mid + 1;
        else right = mid - 1;
    }
    return -1;
}

int main() {
    int n; cout << "Count: "; cin >> n;
    int arr[100];
    cout << "Array: ";
    for(int i=0; i<n; i++) cin >> arr[i];
    int target; cout << "Target: "; cin >> target;
    
    int idx = binarySearch(arr, n, target);
    cout << "Found at index: " << idx << endl;
    return 0;
}`
        }
      },
      {
        name: 'Two Sum',
        time: 'O(n)',
        space: 'O(n)',
        python: {
          input: '4\n2 7 11 15\n9',
          code: `def two_sum(nums, target):
    num_map = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in num_map:
            return [num_map[complement], i]
        num_map[num] = i
    return []

n = int(input("Count: "))
nums = [int(x) for x in input("Array: ").split()]
target = int(input("Target: "))
ans = two_sum(nums, target)
print("Indices:", ans)`
        },
        cpp: {
          input: '4\n2 7 11 15\n9',
          code: `#include <iostream>
#include <unordered_map>
using namespace std;

int main() {
    int n; cout << "Count: "; cin >> n;
    int nums[100];
    for(int i=0; i<n; i++) cin >> nums[i];
    int target; cout << "Target: "; cin >> target;
    
    unordered_map<int, int> numMap;
    int ans[2] = {-1, -1};
    
    for (int i = 0; i < n; i++) {
        int complement = target - nums[i];
        if (numMap.count(complement)) {
            ans[0] = numMap[complement];
            ans[1] = i;
            break;
        }
        numMap[nums[i]] = i;
    }
    
    cout << "Indices: [" << ans[0] << ", " << ans[1] << "]\\n";
    return 0;
}`
        }
      },
      {
        name: "Kadane's Alg (Max Subarray)",
        time: 'O(n)',
        space: 'O(1)',
        python: {
          input: '9\n-2 1 -3 4 -1 2 1 -5 4',
          code: `def max_subarray(nums):
    max_so_far = float('-inf')
    curr_max = 0
    for num in nums:
        curr_max = max(num, curr_max + num)
        max_so_far = max(max_so_far, curr_max)
    return max_so_far

n = int(input("Count: "))
nums = [int(x) for x in input("Array: ").split()]
print("Max sum:", max_subarray(nums))`
        },
        cpp: {
          input: '9\n-2 1 -3 4 -1 2 1 -5 4',
          code: `#include <iostream>
#include <algorithm>
using namespace std;

int maxSubArray(int nums[], int n) {
    int max_so_far = nums[0];
    int curr_max = nums[0];
    for(int i = 1; i < n; i++) {
        curr_max = max(nums[i], curr_max + nums[i]);
        max_so_far = max(max_so_far, curr_max);
    }
    return max_so_far;
}

int main() {
    int n; cout << "Count: "; cin >> n;
    int nums[100];
    for(int i=0; i<n; i++) cin >> nums[i];
    
    int result = maxSubArray(nums, n);
    cout << "Max sum: " << result << endl;
    return 0;
}`
        }
      }
    ]
  },
  {
    category: 'Trees',
    emoji: '🌲',
    items: [
      {
        name: 'Inorder Traversal',
        time: 'O(n)',
        space: 'O(h)',
        python: {
          input: '',
          code: `class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def inorder(root):
    res = []
    def dfs(node):
        if not node: return
        dfs(node.left)
        res.append(node.val)
        dfs(node.right)
    dfs(root)
    return res

root = TreeNode(1)
root.right = TreeNode(2)
root.right.left = TreeNode(3)

print("Inorder:", inorder(root))`
        },
        cpp: {
          input: '',
          code: `#include <iostream>
using namespace std;

class TreeNode {
public:
    int val;
    TreeNode* left;
    TreeNode* right;
    TreeNode(int x) { val = x; left = NULL; right = NULL; }
};

void inorder(TreeNode* root) {
    if (root == NULL) return;
    inorder(root->left);
    cout << root->val << " ";
    inorder(root->right);
}

int main() {
    TreeNode* root = new TreeNode(1);
    root->right = new TreeNode(2);
    root->right->left = new TreeNode(3);
    
    cout << "Inorder: ";
    inorder(root);
    cout << endl;
    return 0;
}`
        }
      },
      {
        name: 'Lowest Common Ancestor',
        time: 'O(h)',
        space: 'O(h)',
        python: {
          input: '',
          code: `class TreeNode:
    def __init__(self, val=0):
        self.val = val
        self.left = None
        self.right = None

def lowest_common_ancestor(root, p, q):
    if not root or root.val == p or root.val == q:
        return root
    
    left = lowest_common_ancestor(root.left, p, q)
    right = lowest_common_ancestor(root.right, p, q)
    
    if left and right:
        return root
    return left if left else right

root = TreeNode(3)
root.left = TreeNode(5)
root.right = TreeNode(1)
root.left.left = TreeNode(6)
root.left.right = TreeNode(2)
root.left.right.left = TreeNode(7)
root.left.right.right = TreeNode(4)

lca = lowest_common_ancestor(root, 5, 4)
print("LCA of 5 and 4 is:", lca.val)`
        },
        cpp: {
          input: '',
          code: `#include <iostream>
using namespace std;

class TreeNode {
public:
    int val;
    TreeNode* left;
    TreeNode* right;
    TreeNode(int x) { val = x; left = NULL; right = NULL; }
};

TreeNode* lowestCommonAncestor(TreeNode* root, int p, int q) {
    if (root == NULL || root->val == p || root->val == q) return root;
    TreeNode* left = lowestCommonAncestor(root->left, p, q);
    TreeNode* right = lowestCommonAncestor(root->right, p, q);
    
    if (left != NULL && right != NULL) return root;
    return left != NULL ? left : right;
}

int main() {
    TreeNode* root = new TreeNode(3);
    root->left = new TreeNode(5);
    root->right = new TreeNode(1);
    root->left->left = new TreeNode(6);
    root->left->right = new TreeNode(2);
    root->left->right->left = new TreeNode(7);
    root->left->right->right = new TreeNode(4);
    
    TreeNode* lca = lowestCommonAncestor(root, 5, 4);
    cout << "LCA of 5 and 4 is: " << lca->val << endl;
    return 0;
}`
        }
      }
    ]
  },
  {
    category: 'Sorting',
    emoji: '🔃',
    items: [
      {
        name: 'Merge Sort',
        time: 'O(n log n)',
        space: 'O(n)',
        python: {
          input: '7\n38 27 43 3 9 82 10',
          code: `def merge_sort(arr):
    if len(arr) <= 1: return arr
    mid = len(arr) // 2
    left = merge_sort(arr[:mid])
    right = merge_sort(arr[mid:])
    return merge(left, right)

def merge(left, right):
    res = []
    i = j = 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            res.append(left[i])
            i += 1
        else:
            res.append(right[j])
            j += 1
    res.extend(left[i:])
    res.extend(right[j:])
    return res

n = int(input("Count: "))
arr = [int(x) for x in input("Array: ").split()]
sorted_arr = merge_sort(arr)
print("Sorted:", sorted_arr)`
        },
        cpp: {
          input: '7\n38 27 43 3 9 82 10',
          code: `#include <iostream>
using namespace std;

void merge(int arr[], int l, int m, int r) {
    int n1 = m - l + 1;
    int n2 = r - m;
    int L[50], R[50];
    for (int i = 0; i < n1; i++) L[i] = arr[l + i];
    for (int j = 0; j < n2; j++) R[j] = arr[m + 1 + j];
    
    int i = 0, j = 0, k = l;
    while (i < n1 && j < n2) {
        if (L[i] <= R[j]) { arr[k] = L[i]; i++; }
        else { arr[k] = R[j]; j++; }
        k++;
    }
    while (i < n1) { arr[k] = L[i]; i++; k++; }
    while (j < n2) { arr[k] = R[j]; j++; k++; }
}

void mergeSort(int arr[], int l, int r) {
    if (l >= r) return;
    int m = l + (r - l) / 2;
    mergeSort(arr, l, m);
    mergeSort(arr, m + 1, r);
    merge(arr, l, m, r);
}

int main() {
    int n; cout << "Count: "; cin >> n;
    int arr[100];
    for(int i=0; i<n; i++) cin >> arr[i];
    
    mergeSort(arr, 0, n - 1);
    
    cout << "Sorted: ";
    for(int i=0; i<n; i++) cout << arr[i] << " ";
    cout << endl;
    return 0;
}`
        }
      },
      {
        name: 'Quick Sort',
        time: 'O(n log n)',
        space: 'O(log n)',
        python: {
          input: '6\n10 7 8 9 1 5',
          code: `def quick_sort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quick_sort(left) + middle + quick_sort(right)

n = int(input("Count: "))
arr = [int(x) for x in input("Array: ").split()]
print("Sorted:", quick_sort(arr))`
        },
        cpp: {
          input: '6\n10 7 8 9 1 5',
          code: `#include <iostream>
using namespace std;

void swap(int* a, int* b) {
    int t = *a; *a = *b; *b = t;
}

int partition(int arr[], int low, int high) {
    int pivot = arr[high];
    int i = (low - 1);
    for (int j = low; j <= high - 1; j++) {
        if (arr[j] < pivot) {
            i++;
            swap(&arr[i], &arr[j]);
        }
    }
    swap(&arr[i + 1], &arr[high]);
    return (i + 1);
}

void quickSort(int arr[], int low, int high) {
    if (low < high) {
        int pi = partition(arr, low, high);
        quickSort(arr, low, pi - 1);
        quickSort(arr, pi + 1, high);
    }
}

int main() {
    int n; cout << "Count: "; cin >> n;
    int arr[100];
    for(int i=0; i<n; i++) cin >> arr[i];
    
    quickSort(arr, 0, n - 1);
    cout << "Sorted: ";
    for(int i=0; i<n; i++) cout << arr[i] << " ";
    cout << endl;
    return 0;
}`
        }
      }
    ]
  },
  {
    category: 'Dynamic Programming',
    emoji: '💡',
    items: [
      {
        name: '0/1 Knapsack',
        time: 'O(nW)',
        space: 'O(W)',
        python: {
          input: '3\n4\n1 3 4\n1 4 5\n4',
          code: `n = int(input("Items: "))
W = int(input("Capacity: "))
weights = list(map(int, input("Weights: ").split()))
values = list(map(int, input("Values: ").split()))

dp = [0] * (W + 1)
for i in range(n):
    for w in range(W, weights[i] - 1, -1):
        dp[w] = max(dp[w], dp[w - weights[i]] + values[i])

print("Max Value:", dp[W])`
        },
        cpp: {
          input: '3\n4\n1 3 4\n1 4 5\n4',
          code: `#include <iostream>
#include <algorithm>
using namespace std;

int main() {
    int n; cin >> n;
    int W; cin >> W;
    int weights[100], values[100];
    for(int i=0; i<n; i++) cin >> weights[i];
    for(int i=0; i<n; i++) cin >> values[i];
    
    int dp[1000] = {0};
    
    for (int i = 0; i < n; i++) {
        for (int w = W; w >= weights[i]; w--) {
            dp[w] = max(dp[w], dp[w - weights[i]] + values[i]);
        }
    }
    cout << "Max Value: " << dp[W] << endl;
    return 0;
}`
        }
      },
      {
        name: 'Longest Common Subsequence',
        time: 'O(mn)',
        space: 'O(mn)',
        python: {
          input: 'AGGTAB\nGXTXAYB',
          code: `X = input("String 1: ")
Y = input("String 2: ")

m, n = len(X), len(Y)
dp = [[0] * (n + 1) for _ in range(m + 1)]

for i in range(1, m + 1):
    for j in range(1, n + 1):
        if X[i-1] == Y[j-1]:
            dp[i][j] = dp[i-1][j-1] + 1
        else:
            dp[i][j] = max(dp[i-1][j], dp[i][j-1])

print("LCS Length:", dp[m][n])`
        },
        cpp: {
          input: 'AGGTAB\nGXTXAYB',
          code: `#include <iostream>
#include <string>
#include <algorithm>
using namespace std;

int main() {
    string X, Y;
    cin >> X >> Y;
    int m = X.length(), n = Y.length();
    int dp[50][50] = {0};
    
    for (int i = 1; i <= m; i++) {
        for (int j = 1; j <= n; j++) {
            if (X[i-1] == Y[j-1]) {
                dp[i][j] = dp[i-1][j-1] + 1;
            } else {
                dp[i][j] = max(dp[i-1][j], dp[i][j-1]);
            }
        }
    }
    cout << "LCS Length: " << dp[m][n] << endl;
    return 0;
}`
        }
      }
    ]
  },
  {
    category: 'Stacks & Queues',
    emoji: '🥞',
    items: [
      {
        name: 'Valid Parentheses',
        time: 'O(n)',
        space: 'O(n)',
        python: {
          input: '{[()]}',
          code: `s = input("String: ")
stack = []
pairs = {')': '(', '}': '{', ']': '['}
valid = True
for ch in s:
    if ch in '({[':
        stack.append(ch)
    elif ch in ')}]':
        if not stack or stack[-1] != pairs[ch]:
            valid = False
            break
        stack.pop()

if stack: valid = False
print("Valid:", valid)`
        },
        cpp: {
          input: '{[()]}',
          code: `#include <iostream>
#include <string>
#include <stack>
using namespace std;

int main() {
    string s; cin >> s;
    stack<char> st;
    bool valid = true;
    
    for(int i=0; i<s.length(); i++) {
        char ch = s[i];
        if(ch == '(' || ch == '{' || ch == '[') {
            st.push(ch);
        } else {
            if(st.empty()) { valid = false; break; }
            char p = st.top(); st.pop();
            if(ch == ')' && p != '(') { valid = false; break; }
            if(ch == '}' && p != '{') { valid = false; break; }
            if(ch == ']' && p != '[') { valid = false; break; }
        }
    }
    if(!st.empty()) valid = false;

    cout << "Valid: " << (valid ? "True" : "False") << endl;
    return 0;
}`
        }
      }
    ]
  },
  {
    category: 'Graphs',
    emoji: '🕸️',
    items: [
      {
        name: 'BFS Traversal',
        time: 'O(V+E)',
        space: 'O(V)',
        python: {
          input: '4 4\n0 1\n0 2\n1 2\n2 3',
          code: `v, e = map(int, input("Nodes & Edges: ").split())
adj = [[] for _ in range(v)]
for _ in range(e):
    src, dest = map(int, input().split())
    adj[src].append(dest)
    adj[dest].append(src)

visited = [False] * v
queue = [0]
visited[0] = True
res = []

while queue:
    node = queue.pop(0)
    res.append(node)
    for neighbor in adj[node]:
        if not visited[neighbor]:
            visited[neighbor] = True
            queue.append(neighbor)

print("BFS:", res)`
        },
        cpp: {
          input: '4 4\n0 1\n0 2\n1 2\n2 3',
          code: `#include <iostream>
#include <vector>
#include <queue>
using namespace std;

int main() {
    int v, e; 
    cin >> v >> e;
    vector<int> adj[100];
    for (int i = 0; i < e; i++) {
        int src, dest; cin >> src >> dest;
        adj[src].push_back(dest);
        adj[dest].push_back(src);
    }
    
    bool visited[100] = {false};
    queue<int> q;
    
    visited[0] = true;
    q.push(0);
    
    cout << "BFS: ";
    while (!q.empty()) {
        int node = q.front();
        q.pop();
        cout << node << " ";
        
        for (int neighbor : adj[node]) {
            if (!visited[neighbor]) {
                visited[neighbor] = true;
                q.push(neighbor);
            }
        }
    }
    cout << endl;
    return 0;
}`
        }
      }
    ]
  }
];
