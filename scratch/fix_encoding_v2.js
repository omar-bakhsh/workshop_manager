const fs = require('fs');
const path = 'server.js';
let content = fs.readFileSync(path, 'utf8');

// Regex to find the for loop even with whitespace differences
const regex = /for\s*\(let\s*i\s*=\s*0;\s*i\s*<\s*rows\.length;\s*i\+\+\)\s*\{\s*if\s*\(rows\[i\]\[0\]\s*&&\s*rows\[i\]\[0\]\.toString\(\)\.includes\(['"]الراتب الأساسي['"]\)\)\s*\{\s*salaryRowIndex\s*=\s*i;\s*break;\s*\}\s*\}/;

const replacement = `for (let i = 0; i < rows.length; i++) {
            const rowText = rows[i].join(' ');
            if (rowText.includes('الراتب')) {
                salaryRowIndex = i; break;
            }
        }`;

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync(path, content, 'utf8');
    console.log("CRITICAL SUCCESS: File updated using advanced regex!");
} else {
    console.log("Regex search failed. Trying generic match...");
    const genericRegex = /for\s*\(let\s*i\s*=\s*0;\s*i\s*<\s*rows\.length;\s*i\+\+\)\s*\{[\s\S]*?salaryRowIndex\s*=\s*i;\s*break;\s*\}\s*\}/;
    if (genericRegex.test(content)) {
        content = content.replace(genericRegex, replacement);
        fs.writeFileSync(path, content, 'utf8');
        console.log("CRITICAL SUCCESS: File updated using generic regex!");
    } else {
        console.log("FATAL ERROR: Could not find code even with generic regex.");
    }
}
