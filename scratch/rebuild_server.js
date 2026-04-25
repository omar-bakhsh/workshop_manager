const fs = require('fs');

function rebuildServer() {
    let content = fs.readFileSync('server.js', 'utf8');

    // 1. Ensure requirements
    if (!content.includes("const xlsx = require('xlsx');")) {
        content = "const xlsx = require('xlsx');\n" + content;
    }
    if (!content.includes("const multer = require('multer');")) {
        content = "const multer = require('multer');\n" + content;
    }
    if (!content.includes("const upload = multer")) {
        content = content.replace("const multer = require('multer');", "const multer = require('multer');\nconst upload = multer({ dest: 'uploads/' });");
    }

    // 2. Advanced Salary Import Route
    const advancedImportRoute = `
// استيراد الرواتب من ملف Excel (النسخة المتقدمة)
app.post('/api/employees/import-salaries', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "الرجاء اختيار ملف Excel." });
    const filePath = req.file.path;
    try {
        const workbook = xlsx.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        
        if (data.length < 5) {
             throw new Error("الملف فارغ أو غير صحيح.");
        }

        const headerRow = data[0]; // الأسماء في الصف الأول
        let updatedCount = 0;
        let notFound = [];
        let importLog = [];

        // المطابقة تتم بناءً على الأسماء في الصف الأول
        // البيانات موجودة في الصفوف 33 وما بعدها (وفقاً لطلب المستخدم السابق)
        for (let col = 1; col < headerRow.length; col++) {
            let name = headerRow[col];
            if (!name) continue;
            
            const nameStr = name.toString().trim();
            if (nameStr.length < 2 || nameStr.includes('التاريخ')) continue;

            // استخراج القيم (الصف 33، 34، 35، 36، 37) - الاندكس يبدأ من 0
            const totalWithdrawals = parseFloat(data[32]?.[col]) || 0;
            const netRemaining = parseFloat(data[33]?.[col]) || 0;
            const baseSalary = parseFloat(data[34]?.[col]) || 0;
            const depositAmount = parseFloat(data[35]?.[col]) || 0;
            const bankInfo = data[36]?.[col] ? data[36][col].toString().trim() : '-';

            // البحث عن الموظف
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

        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.json({ 
            message: \`تم تحديث \${updatedCount} موظف بنجاح\`, 
            updatedCount,
            notFound 
        });
    } catch (error) {
        console.error("Import Salaries Error:", error);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.status(500).json({ message: "خطأ في معالجة ملف Excel: " + error.message });
    }
});
`;

    // Insert after employee functions
    const insertAfter = 'res.status(500).json({ message: "خطأ في جلب بيانات الموظف" });\n    }\n});';
    if (content.includes(insertAfter)) {
        content = content.replace(insertAfter, insertAfter + "\n" + advancedImportRoute);
    } else {
        // Fallback: append at the end before app.listen if possible
        content += "\n" + advancedImportRoute;
    }

    fs.writeFileSync('server.js', content, 'utf8');
    console.log('✅ server.js: Rebuilt with Advanced Import Route.');
}

rebuildServer();
