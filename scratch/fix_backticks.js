const fs = require('fs');
let src = fs.readFileSync('admin.html', 'utf8');

// Replace all instances of \` with `
// This fixes the issue where backticks were incorrectly escaped during file generation
src = src.split('\\`').join('`');

fs.writeFileSync('admin.html', src);
console.log('Fixed backtick escaping in admin.html');
