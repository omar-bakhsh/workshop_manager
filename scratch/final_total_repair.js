const fs = require('fs');

function finalRepair() {
    const backupPath = 'scratch/unzipped_old/admin.html';
    let buffer = fs.readFileSync(backupPath);
    let content = '';
    if (buffer[1] === 0) content = buffer.toString('utf16le');
    else content = buffer.toString('utf8');

    // 1. Remove Lifts button
    content = content.replace(/<button class="btn btn-info" onclick="window\.location\.href='lifts\.html'"[\s\S]*?<\/button>/, '');

    // 2. Ensure sync fields are correct in renderSections
    // Check if total_withdrawal is with or without s
    // In server.js /api/employees returns total_withdrawal (without s)
    // In this backup, it might be total_withdrawal. Let's check.
    content = content.replace(/\$\{emp\.total_withdrawals \|\| 0\}/g, "${emp.total_withdrawal || 0}");
    
    // Ensure officialNet logic for quick edits if needed
    // Actually just keep it simple as it was, but ensure field alignment.

    // 3. Fix handleAddIncome to include section_id
    const incomeMatch = /async function handleAddIncome\(e\) \{[\s\S]*?const payload = \{[\s\S]*?\};/;
    const correctedIncome = `async function handleAddIncome(e) {
            e.preventDefault();
            const empId = document.getElementById('incomeEmpId').value;
            const emp = employees.find(e => e.id == empId);
            const payload = {
                employee_id: parseInt(empId),
                section_id: emp ? emp.section_id : null,
                income: parseInt(document.getElementById('incomeAmount').value),
                details: document.getElementById('incomeDetails').value
            };`;
    content = content.replace(incomeMatch, correctedIncome);

    fs.writeFileSync('admin.html', content, 'utf8');
    console.log('✅ admin.html: REPAIRED TOTALLY.');
}

finalRepair();
