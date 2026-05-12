const fs = require('fs');
let code = fs.readFileSync('c:/Users/Pawan/OneDrive/Desktop/SeeRun/app/index.tsx', 'utf8');
const startMatch = code.indexOf('// ─── Template Data ────────────────────────────────────────────────────────────');
const endMatch = code.indexOf('// ─── Component ────────────────────────────────────────────────────────────────');
if (startMatch !== -1 && endMatch !== -1) {
  const newCode = code.slice(0, startMatch) + "import { TEMPLATES, TemplateAlgorithm } from '../data/templates';\n\n" + code.slice(endMatch);
  fs.writeFileSync('c:/Users/Pawan/OneDrive/Desktop/SeeRun/app/index.tsx', newCode);
  console.log('Successfully replaced template code!');
} else {
  console.log('Could not find start or end matches.', startMatch, endMatch);
}
