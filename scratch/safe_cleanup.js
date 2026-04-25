const fs = require('fs');

// 1. admin.html: Hide Lifts button and add Chat button
let admin = fs.readFileSync('admin.html', 'utf8');
// Hide Lifts button
admin = admin.replace(/<button class="btn btn-info" onclick="window\.location\.href='lifts\.html'"[\s\S]*?<\/button>/, '<!-- Lifts Hidden -->');
// Add Chat Button in header (next to notifications)
const chatBtn = `
                <button class="btn btn-info" onclick="toggleAdminChat()" style="background-color: #8b5cf6; color: white;">
                    <span>💬</span>
                    <span>المحادثة</span>
                </button>`;
admin = admin.replace(/<div class="notification-wrapper"[\s\S]*?<\/div>/, (m) => m + chatBtn);
fs.writeFileSync('admin.html', admin);
console.log('✅ admin.html: Lifts hidden, Chat added.');

// 2. employee.html: Hide Lifts link and Ticker
let emp = fs.readFileSync('employee.html', 'utf8');
// Hide Lifts in navigation
emp = emp.replace(/<a href="lifts\.html"[\s\S]*?<\/a>/, '<!-- Lifts Hidden -->');
// Hide Lift Ticker
emp = emp.replace(/<div class="lift-ticker"[\s\S]*?<\/div>/, '<!-- Ticker Hidden -->');
// Stop the ticker script if it exists
// Look for setInterval that mentions lifts
emp = emp.replace(/setInterval\(\async\(\)[\s\S]*?fetch\('\/api\/lifts\/status'\)[\s\S]*?\}, 5000\);/, '/* Ticker Script Stopped */');

// Apply Sync logic for official net
emp = emp.replace(/const withdrawals = employeeData\.total_withdrawal \|\| 0;[\s\n\t]+const baseSalary = employeeData\.info\.base_salary \|\| 0;[\s\n\t]+const remainingSalary = baseSalary - withdrawals;/,
                            "const withdrawals = employeeData.total_withdrawal || 0;\n        const baseSalary = employeeData.info.base_salary || 0;\n        const officialNet = employeeData.info.net_remaining || (baseSalary - withdrawals);");

emp = emp.replace(/document\.getElementById\('remainingBalance'\)\.textContent = remainingSalary\.toLocaleString\('en-US'\);/,
                            "document.getElementById('remainingBalance').textContent = officialNet.toLocaleString('en-US');");

fs.writeFileSync('employee.html', emp);
console.log('✅ employee.html: Lifts hidden, Ticker stopped, Sync fixed.');

// 3. server.js: Update API for sync (without deleting everything)
let server = fs.readFileSync('server.js', 'utf8');
// Add missing fields to employee-stats
server = server.replace(/SELECT e\.name, e\.target, e\.base_salary, e\.hide_income, e\.section_id, s\.name AS section_name/, 
                           "SELECT e.name, e.target, e.base_salary, e.hide_income, e.section_id, e.net_remaining, e.total_withdrawals, s.name AS section_name");

// Add missing fields to employees list
server = server.replace(/e\.net_remaining,[\s\n\t]+e\.hide_income,/, "e.net_remaining, e.total_withdrawals, e.hide_income,");

fs.writeFileSync('server.js', server);
console.log('✅ server.js: APIs updated for Sync.');
