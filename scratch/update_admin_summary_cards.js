const fs = require('fs');
let adminContent = fs.readFileSync('admin.html', 'utf8');

const oldUpdateStats = 'function updateStats(activeEmployees) {';
const newUpdateStats = `function updateStats(activeEmployees) {
            // حساب الإحصائيات بناءً على البيانات المستوردة من إكسل والبرنامج
            const totalBaseSalaries = activeEmployees.reduce((sum, emp) => sum + (emp.base_salary || 0), 0);
            const totalExcelWithdrawals = activeEmployees.reduce((sum, emp) => sum + (emp.total_withdrawals || 0), 0);
            const totalExcelTarget = activeEmployees.reduce((sum, emp) => sum + (emp.target_amount || 0), 0);
            const totalIncome = activeEmployees.reduce((sum, emp) => sum + (emp.total_income || 0), 0);

            document.getElementById('totalSalaries').textContent = totalBaseSalaries.toLocaleString('en-US');
            document.getElementById('totalWithdrawals').textContent = totalExcelWithdrawals.toLocaleString('en-US');
            document.getElementById('totalTarget').textContent = totalExcelTarget.toLocaleString('en-US');
            document.getElementById('totalIncome').textContent = totalIncome.toLocaleString('en-US');
`;

// البحث عن دالة updateStats وتحديثها
const statsFunctionStart = adminContent.indexOf('function updateStats');
const statsFunctionEnd = adminContent.indexOf('}', statsFunctionStart + 50);

if (statsFunctionStart !== -1) {
    const originalFunction = adminContent.substring(statsFunctionStart, statsFunctionEnd + 1);
    adminContent = adminContent.replace(originalFunction, newUpdateStats + '        }');
}

// التأكد من وجود العناصر المعرفة في الـ HTML
if (!adminContent.includes('id="totalTarget"')) {
    adminContent = adminContent.replace('id="totalOrders"', 'id="totalTarget"');
    adminContent = adminContent.replace('إجمالي الطلبات', 'إجمالي التارقت (Excel)');
}

fs.writeFileSync('admin.html', adminContent, 'utf8');
console.log("✅ تمت تحديث الإحصائيات العلوية بنجاح!");
