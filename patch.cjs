const fs = require('fs');
let code = fs.readFileSync('lib/pdf.worker.js', 'utf8');
code = code.replace('export{uc as WorkerMessageHandler};', '');
code = code.replace("if (typeof window === 'undefined') { globalThis.pdfjsWorker.WorkerMessageHandler.setup(); }", "");
fs.writeFileSync('lib/pdf.worker.js', code.trim());
console.log('Worker patched successfully.');
