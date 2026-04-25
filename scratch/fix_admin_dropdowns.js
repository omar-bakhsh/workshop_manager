const fs = require('fs');
const path = 'admin.html';
let content = fs.readFileSync(path, 'utf8');

// Use a more flexible search
const target = /function renderSections\(\) \{[\s\n]+const container = document\.getElementById\('sectionsContainer'\);[\s\n]+container\.innerHTML = '';/;
const replacement = `function renderSections() {
            // تحديث قوائم الأقسام
            const drop1 = document.getElementById('empSection');
            const drop2 = document.getElementById('editEmpSection');
            if (drop1 && sections) drop1.innerHTML = sections.map(s => \`<option value="\${s.id}">\${s.name}</option>\`).join('');
            if (drop2 && sections) drop2.innerHTML = sections.map(s => \`<option value="\${s.id}">\${s.name}</option>\`).join('');

            const container = document.getElementById('sectionsContainer');
            container.innerHTML = '';`;

if (target.test(content)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(path, content);
    console.log('Successfully updated admin.html');
} else {
    console.log('Could not find target in admin.html');
}
