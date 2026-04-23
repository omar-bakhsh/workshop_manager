const fs = require('fs');

// 1. تحديث الحسابات في admin.html
let adminContent = fs.readFileSync('admin.html', 'utf8');
const oldAdminCalc = 'const remainingSalary = baseSalary - totalWithdrawals;';
const newAdminCalc = '// الراتب المتبقي = الأساسي - (سحوبات الإكسل + إيداع المؤسسة)\n                    const foundationDeposit = emp.deposit_amount || 0;\n                    const remainingSalary = baseSalary - (totalWithdrawals + foundationDeposit);';

if (adminContent.includes(oldAdminCalc)) {
    adminContent = adminContent.replace(oldAdminCalc, newAdminCalc);
    fs.writeFileSync('admin.html', adminContent, 'utf8');
    console.log("✅ تم تحديث معادلة الراتب المتبقي في صفحة الإدارة!");
}

// 2. تحديث الحسابات في employee.html
let empContent = fs.readFileSync('employee.html', 'utf8');
const oldEmpCalc = 'const remainingSalary = baseSalary - excelWithdrawals;';
const newEmpCalc = '// الراتب المتبقي = الأساسي - (سحوبات الإكسل + إيداع المؤسسة)\n        const foundationDeposit = employeeData.deposit_amount || 0;\n        const remainingSalary = baseSalary - (excelWithdrawals + foundationDeposit);';

if (empContent.includes(oldEmpCalc)) {
    empContent = empContent.replace(oldEmpCalc, newEmpCalc);
    fs.writeFileSync('employee.html', empContent, 'utf8');
    console.log("✅ تم تحديث معادلة الراتب المتبقي في صفحة الموظف!");
}
