const fs = require('fs');
const code = fs.readFileSync('lib/pdf.worker.js', 'utf8');
const imports = code.match(/import\s+.*?from\s+['"].*?['"]|import\([^)]+\)/g);
console.log('Imports found:', imports);
