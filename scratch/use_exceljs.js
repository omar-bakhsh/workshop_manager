const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const newRoute = `// استيراد الرواتب باستخدام exceljs - الخيار الأكثر دقة
app.post('/api/employees/import-salaries', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "الرجاء اختيار ملف Excel." });
    const filePath = req.file.path;
    const ExcelJS = require('exceljs');
    
    try {
        console.log('\\n===== بدء الاستيراد باستخدام ExcelJS =====');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        const worksheet = workbook.worksheets[0];
        
        let rows = [];
        worksheet.eachRow({ includeEmpty: true }, (row) => {
            rows.push(Array.isArray(row.values) ? row.values.slice(1) : []); 
        });

        const allEmployees = await dbAll("SELECT id, name FROM employees WHERE is_active = 1");
        const clean = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9\\u0600-\\u06FF]/g, '');
        const dbNamesClean = allEmployees.map(e => ({ id: e.id, name: e.name, cleanName: clean(e.name) }));

        let namesRowIndex = -1;
        let salaryRowIndex = -1;

        rows.forEach((row, idx) => {
            const rowText = row.join(' ').toLowerCase();
            if (rowText.includes('الراتب') && rowText.includes('الأساسي')) salaryRowIndex = idx;
            if (namesRowIndex === -1 && idx < 15) {
                const matches = row.filter(cell => {
                    const c = clean(cell);
                    return c && dbNamesClean.some(db => db.cleanName === c || db.cleanName.includes(c) || c.includes(db.cleanName));
                }).length;
                if (matches >= 2) namesRowIndex = idx;
            }
        });

        if (namesRowIndex === -1) namesRowIndex = 0;
        if (salaryRowIndex === -1) {
            rows.forEach((row, idx) => {
               if (row.join(' ').includes('الراتب') && !row.join(' ').includes('المتبقي')) salaryRowIndex = idx;
            });
        }

        if (salaryRowIndex === -1) {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            return res.status(400).json({ message: "فشل البرنامج في تحديد صف الرواتب الأساسي." });
        }

        const namesRow = rows[namesRowIndex];
        const salariesRow = rows[salaryRowIndex];
        let updatedCount = 0;
        let notFoundNames = [];

        for (let i = 0; i < namesRow.length; i++) {
            const excelName = namesRow[i];
            const cleanExcel = clean(excelName);
            if (!cleanExcel || cleanExcel === 'التاريخ' || cleanExcel.includes('الراتب')) continue;

            const salaryRaw = salariesRow[i];
            let salary = 0;
            if (salaryRaw && typeof salaryRaw === 'object' && salaryRaw.result !== undefined) {
                salary = parseFloat(salaryRaw.result);
            } else {
                salary = parseFloat(salaryRaw);
            }

            if (isNaN(salary) || salary <= 0) continue;

            const match = dbNamesClean.find(db => db.cleanName === cleanExcel || db.cleanName.includes(cleanExcel) || cleanExcel.includes(db.cleanName));
            if (match) {
                await dbRun("UPDATE employees SET base_salary = ? WHERE id = ?", [salary, match.id]);
                updatedCount++;
                console.log(\`✅ \${match.name} -> \${salary}\`);
            } else {
                notFoundNames.push(String(excelName));
            }
        }

        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        let msg = \`تم تحديث \${updatedCount} موظف.\`;
        if (notFoundNames.length > 0) msg += \` لم يتم العثور على: \${notFoundNames.join(', ')}\`;
        res.json({ message: msg, updatedCount, notFound: notFoundNames });
    } catch (error) {
        console.error("ExcelJS Import Error:", error);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.status(500).json({ message: "خطأ في قراءة ملف الإكسل: " + error.message });
    }
});`;

// استبدال المسار القديم بالكامل
const startMarker = "app.post('/api/employees/import-salaries'";
const endMarker = "res.status(500).json({ message: \"خطأ: \" + error.message });\r\n    }\r\n});"; 
// سنبحث عن نهاية المسار بدقة أكبر

const startIdx = content.indexOf(startMarker);
// سنجد نهاية المسار بالبحث عن }); بعد المسار
let endIdx = content.indexOf("});", startIdx + 100);

if (startIdx > -1 && endIdx > -1) {
    content = content.substring(0, startIdx) + newRoute + content.substring(endIdx + 3);
    fs.writeFileSync('server.js', content, 'utf8');
    console.log("✅ تم الانتقال إلى exceljs بنجاح!");
} else {
    console.log("❌ فشل تحديد موقع الكود القديم.");
    console.log("startIdx:", startIdx, "endIdx:", endIdx);
}
