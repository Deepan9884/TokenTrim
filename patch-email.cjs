const fs = require('fs');
const file = 'E:/Projects/CampustoCarrer/backend/src/services/email.service.js';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes("require('dns').setDefaultResultOrder('ipv4first')")) {
  code = "require('dns').setDefaultResultOrder('ipv4first');\n" + code;
  fs.writeFileSync(file, code);
  console.log('Patched email.service.js to use IPv4 first.');
} else {
  console.log('Already patched.');
}
