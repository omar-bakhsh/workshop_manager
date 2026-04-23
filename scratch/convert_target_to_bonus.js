const fs = require('fs');

// 1. تحديث المسميات وحسابات الإدارة
let adminContent = fs.readFileSync('admin.html', 'utf8');

// تغيير مسمى العمود
adminContent = adminContent.replace('التارقت (Excel)', 'مكافأة التارقت');

// تحديث معادلة الراتب المتبقي
const oldAdminCalc = 'const remainingSalary = baseSalary - (totalWithdrawals + foundationDeposit);';
const newAdminCalc = '// الراتب المتبقي = (الأساسي + مكافأة التارقت) - (سحوبات الإكسل + إيداع المؤسسة)\n                    const foundationDeposit = emp.deposit_amount || 0;\n                    const bonusTarget = emp.target_amount || 0;\n                    const remainingSalary = (baseSalary + bonusTarget) - (totalWithdrawals + foundationDeposit);';

if (adminContent.includes(oldAdminCalc)) adminContent = adminContent.replace(oldAdminCalc, newAdminCalc);

fs.writeFileSync('admin.html', adminContent, 'utf8');


// 2. تحديث حسابات صفحة الموظف
let empContent = fs.readFileSync('employee.html', 'utf8');

// تغيير المسمى في البطاقة
empContent = empContent.replace('إجمالي التارقت', 'مكافأة التارقت (Bonus)');

const oldEmpCalc = 'const remainingSalary = baseSalary - (excelWithdrawals + foundationDeposit);';
const newEmpCalc = '// الراتب المتبقي = (الأساسي + مكافأة التارقت) - (سحوبات الإكسل + إيداع المؤسسة)\n        const bonusTarget = employeeData.target_amount || 0;\n        const foundationDeposit = employeeData.deposit_amount || 0;\n        const remainingSalary = (baseSalary + bonusTarget) - (excelWithdrawals + foundationDeposit);';

if (empContent.includes(oldEmpCalc)) empContent = empContent.replace(oldEmpCalc, newEmpCalc);

fs.writeFileSync('employee.html', empContent, 'utf8');

console.log("✅ تم تحويل التارقت إلى مكافأة (Bonus) وتحديث كافة الحسابات!");
