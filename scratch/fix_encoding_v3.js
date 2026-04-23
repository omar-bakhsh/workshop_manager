const fs = require('fs');
const path = 'server.js';
let content = fs.readFileSync(path, 'utf8');

const replacement = `// استيراد الرواتب من ملف Excel بتنسيق مخصص (الأسماء في صف 1، الرواتب في صف 35)
app.post('/api/employees/import-salaries', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "الرجاء اختيار ملف Excel." });
    const filePath = req.file.path;
    try {
        console.log('--- بدء محاولة استيراد متقدمة ---');
        const workbook = xlsx.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        
        // البحث عن صف الرواتب (الصف 35 غالباً)
        let salaryRowIndex = -1;
        for (let i = 0; i < rows.length; i++) {
            if (rows[i] && rows[i].some(cell => cell && cell.toString().includes('الراتب'))) {
                salaryRowIndex = i; break;
            }
        }
        if (salaryRowIndex === -1 && rows.length >= 35) salaryRowIndex = 34;

        if (salaryRowIndex === -1) {
            fs.unlinkSync(filePath);
            return res.status(400).json({ message: "لم يتم العثور على صف الرواتب." });
        }

        const namesRow = rows[0]; 
        const salariesRow = rows[salaryRowIndex];
        
        // جلب قائمة الموظفين من البرنامج للمقارنة الذكية
        const allEmployees = await dbAll("SELECT id, name FROM employees WHERE is_active = 1");
        
        let updatedCount = 0;
        let notFoundNames = [];

        for (let colIndex = 1; colIndex < namesRow.length; colIndex++) {
            const excelName = namesRow[colIndex]?.toString().trim().toLowerCase();
            const salary = parseFloat(salariesRow[colIndex]);

            if (excelName && !isNaN(salary) && salary > 0) {
                // محاولة مطابقة ذكية
                let targetEmployee = allEmployees.find(emp => {
                    const dbName = emp.name.toLowerCase();
                    // تطابق كامل أو جزئي أو احتواء
                    return dbName === excelName || dbName.includes(excelName) || excelName.includes(dbName);
                });

                if (targetEmployee) {
                    await dbRun("UPDATE employees SET base_salary = ? WHERE id = ?", [salary, targetEmployee.id]);
                    updatedCount++;
                    console.log(\`✅ تم التحديث: \${targetEmployee.name} بمبلغ \${salary}\`);
                } else {
                    notFoundNames.push(excelName);
                    console.log(\`⚠️ فشل المطابقة لـ: \${excelName}\`);
                }
            }
        }

        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.json({ 
            message: \`تم تحديث \${updatedCount} موظف. \${notFoundNames.length ? 'هناك أسماء لم يتم التعرف عليها.' : ''}\`, 
            updatedCount, 
            notFound: notFoundNames 
        });
    } catch (error) {
        console.error("Advanced Import Error:", error);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.status(500).json({ message: "حدث خطأ تقني أثناء المعالجة" });
    }
});`;

// Replace the entire function block
const regex = /\/\/ استيراد الرواتب من ملف Excel بتنسيق مخصص[\s\S]*?\}\);/g;
if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync(path, content, 'utf8');
    console.log("SUCCESS: Advanced Logic Applied");
} else {
    console.log("FAILED to find target block");
}
