const fs = require('fs');

// 1. Fix server.js (Update api/employee-stats/:id to include Excel data)
let server = fs.readFileSync('server.js', 'utf8');

// Find and replace the employee-stats endpoint to include net_remaining and total_withdrawals
const statsEndpoint = /app\.get\('\/api\/employee-stats\/:id'[\s\S]*?SELECT e\.name, e\.target, e\.base_salary, e\.hide_income, e\.section_id, s\.name AS section_name[\s\S]*?FROM employees e/;
if (statsEndpoint.test(server)) {
    server = server.replace(/SELECT e\.name, e\.target, e\.base_salary, e\.hide_income, e\.section_id, s\.name AS section_name/, 
                           "SELECT e.name, e.target, e.base_salary, e.hide_income, e.section_id, e.net_remaining, e.total_withdrawals, s.name AS section_name");
}

// Ensure api/employees returns correct fields
server = server.replace(/SELECT[\s\n]+e\.id,[\s\n]+e\.name,[\s\n]+e\.target,[\s\n]+e\.base_salary,[\s\n]+e\.bank_type,[\s\n]+e\.net_remaining,/,
                        "SELECT\n                e.id,\n                e.name,\n                e.target,\n                e.base_salary,\n                e.bank_type,\n                e.net_remaining,\n                e.total_withdrawals,");

fs.writeFileSync('server.js', server);
console.log('✅ server.js: Stats API updated.');

// 2. Fix admin.html (Include section_id in handleAddIncome)
let admin = fs.readFileSync('admin.html', 'utf8');

// Find handleAddIncome and add section_id
const handleAddIncomePattern = /async function handleAddIncome\(e\) \{[\s\S]*?const empId = document\.getElementById\('incomeEmpId'\)\.value;[\s\n\t]+const payload = \{[\s\n\t]+employee_id: parseInt\(empId\),[\s\n\t]+income: parseInt\(document\.getElementById\('incomeAmount'\)\.value\),[\s\n\t]+details: document\.getElementById\('incomeDetails'\)\.value[\s\n\t]+\};/;

const correctedHandleAddIncome = `async function handleAddIncome(e) {
            e.preventDefault();
            const empId = document.getElementById('incomeEmpId').value;
            const emp = employees.find(e => e.id == empId);
            const payload = {
                employee_id: parseInt(empId),
                section_id: emp ? emp.section_id : null,
                income: parseInt(document.getElementById('incomeAmount').value),
                details: document.getElementById('incomeDetails').value
            };`;

if (handleAddIncomePattern.test(admin)) {
    admin = admin.replace(handleAddIncomePattern, correctedHandleAddIncome);
}

fs.writeFileSync('admin.html', admin);
console.log('✅ admin.html: Add Income fix.');

// 3. Fix employee.html (Display Official Net Salary)
let employee = fs.readFileSync('employee.html', 'utf8');

// Update remainingBalance logic
employee = employee.replace(/const withdrawals = employeeData\.total_withdrawal \|\| 0;[\s\n\t]+const baseSalary = employeeData\.info\.base_salary \|\| 0;[\s\n\t]+const remainingSalary = baseSalary - withdrawals;/,
                            "const withdrawals = employeeData.total_withdrawal || 0;\n        const baseSalary = employeeData.info.base_salary || 0;\n        const officialNet = employeeData.info.net_remaining || (baseSalary - withdrawals);");

employee = employee.replace(/document\.getElementById\('remainingBalance'\)\.textContent = remainingSalary\.toLocaleString\('en-US'\);/,
                            "document.getElementById('remainingBalance').textContent = officialNet.toLocaleString('en-US');");

fs.writeFileSync('employee.html', employee);
console.log('✅ employee.html: Displaying official net.');
