const fs = require('fs');
let c = fs.readFileSync('server.js', 'utf8');

const oldLogic = /let updatedCount = 0;[\s\S]*?res\.json\(\{ message: `تم تحديث \$\{updatedCount\} موظف بنجاح`, notFound \}\);/;
const newLogic = `let updatedCount = 0;
        let notFound = [];
        let importLog = [];

        for (let col = 0; col < headerRow.length; col++) {
            let name = headerRow[col];
            if (!name) continue;
            
            const nameStr = name.toString().trim();
            if (nameStr.length < 2 || nameStr.includes('التاريخ') || nameStr.toLowerCase().includes('date')) continue;

            // استخراج القيم (الصف 33، 34، 35، 36، 37)
            const totalWithdrawals = parseFloat(data[32]?.[col]) || 0;
            const netRemaining = parseFloat(data[33]?.[col]) || 0;
            const baseSalary = parseFloat(data[34]?.[col]) || 0;
            const depositAmount = parseFloat(data[35]?.[col]) || 0;
            const bankInfo = data[36]?.[col] ? data[36][col].toString().trim() : '-';

            // البحث عن الموظف (مطابقة دقيقة أو جزئية)
            const emp = await dbGet("SELECT id, name FROM employees WHERE name LIKE ? AND is_active = 1", [\`%\${nameStr}%\`]);
            
            if (emp) {
                await dbRun(\`UPDATE employees SET 
                    base_salary = ?, bank_type = ?, net_remaining = ?, remaining_salary = ?,
                    total_withdrawals = ?, deposit_amount = ? 
                    WHERE id = ?\`, 
                    [baseSalary, bankInfo, netRemaining, netRemaining, totalWithdrawals, depositAmount, emp.id]);
                
                updatedCount++;
                importLog.push({ name: emp.name, excelName: nameStr, net: netRemaining });
            } else {
                notFound.push(nameStr);
            }
        }

        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.json({ 
            message: \`تم تحديث \${updatedCount} موظف بنجاح\`, 
            notFound, 
            details: importLog.slice(0, 5) // إرسال عينة للتحقق في الكونسول
        });`;

if (oldLogic.test(c)) {
    c = c.replace(oldLogic, newLogic);
    fs.writeFileSync('server.js', c);
    console.log('✅ Salary Import Logic Updated with Logging');
} else {
    console.log('❌ Pattern not found');
}
