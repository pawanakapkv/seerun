const srcOriginal = "int main() {\\n  std::vector<int> data = {38, 27, 43, 3, 9, 82, 10};\\n}";
let src = srcOriginal.replace(/std::/g, '');
const regex = /\bvector\s*<\s*(int|float|char)\s*>\s+(\w+)\s*=\s*\{([^}]*)\}\s*;/g;
console.log("Regex:", regex);
src = src.replace(regex, function(m, type, name, elements) {
    return '>>> MATCHED <<<';
});
console.log("Result:", src);
