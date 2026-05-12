const fs = require('fs');
const content = fs.readFileSync('C:/Users/Pawan/OneDrive/Desktop/SeeRun/app/visualizer.tsx', 'utf8');
const startIndex = content.indexOf('const jscppHtml = `') + 19;
let endIndex = content.indexOf('`;', startIndex);
if (endIndex === -1) {
    // maybe there's a space or something
    endIndex = content.lastIndexOf('`;');
}
const html = content.substring(startIndex, endIndex);

// Make the HTML runnable locally (polyfilling React Native postMessage)
const runnableHtml = html.replace('</head>', `
<script>
  window.ReactNativeWebView = {
    postMessage: function(msg) {
        let p = document.createElement('p');
        p.innerText = "POSTMESSAGE: " + msg.substring(0, 100);
        document.body.appendChild(p);
        console.log("POSTMESSAGE:", msg);
    }
  };
</script>
</head>
`).replace('</body>', `
<script>
  setTimeout(() => {
    // Kick off execution using same logic RN uses
    const code = "class Solution { public: vector<int> findErrorNums(vector<int>& nums) { int n = nums.size(); int xZORy = 0; for (int i = 1; i <= n; i++) { xZORy ^= i; xZORy ^= nums[i - 1]; } int set_bit = xZORy & ~(xZORy - 1); int grp_01 = 0; int grp_02 = 0; int i = 1; for (int num : nums) { if (num & set_bit) { grp_01 ^= num; } else { grp_02 ^= num; } if (i & set_bit) { grp_01 ^= i; } else { grp_02 ^= i; } i++; } for(int num:nums){ if(num==grp_01){ return {grp_01,grp_02}; } } return {grp_02,grp_01}; } }; int main() { Solution s; vector<int> nums = {1, 2, 2, 4}; vector<int> res = s.findErrorNums(nums); return 0; }";
    runCppCode(code, "");
  }, 1000);
</script>
</body>
`);
fs.writeFileSync('C:/Users/Pawan/OneDrive/Desktop/SeeRun/test_jscpp_active.html', runnableHtml);
console.log('Done extraction.');
