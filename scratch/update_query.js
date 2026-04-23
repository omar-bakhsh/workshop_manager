const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const oldQuery = 'e.base_salary,';
const newQuery = 'e.base_salary, e.target_amount, e.deposit_amount, e.total_withdrawals, e.remaining_salary, e.net_remaining,';

if (content.includes(oldQuery)) {
    content = content.replace(oldQuery, newQuery);
    fs.writeFileSync('server.js', content, 'utf8');
    console.log("✅ تم تحديث استعلام السيرفر بنجاح!");
} else {
    console.log("❌ تعذر العثور على حقل base_salary في الاستعلام.");
}
