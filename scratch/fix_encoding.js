const fs = require('fs');
const path = 'server.js';
let content = fs.readFileSync(path, 'utf8');

const target = `for (let i = 0; i < rows.length; i++) {
            if (rows[i][0] && rows[i][0].toString().includes('الراتب الأساسي')) {
                salaryRowIndex = i; break;
            }
        }`;

const replacement = `for (let i = 0; i < rows.length; i++) {
            const rowStr = rows[i].join(' ');
            if (rowStr.includes('الراتب')) {
                salaryRowIndex = i; break;
            }
        }`;

if (content.includes("الراتب الأساسي")) {
    content = content.replace(target, replacement);
    fs.writeFileSync(path, content, 'utf8');
    console.log("Success: File updated!");
} else {
    console.log("Error: Target string not found!");
    // Try a more flexible match
    const regex = /for \(let i = 0; i < rows\.length; i\+\+\) \{[\s\S]*?salaryRowIndex = i; break;[\s\S]*?\}[\s\S]*?\}/;
    if (regex.test(content)) {
        content = content.replace(regex, replacement);
        fs.writeFileSync(path, content, 'utf8');
        console.log("Success: File updated using regex!");
    } else {
        console.log("Regex also failed.");
    }
}
