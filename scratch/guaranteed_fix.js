const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

// 1. تغيير المنفذ
content = content.replace(/const PORT = \d+;/, "const PORT = 8080;");

// 2. إعداد multer للرفع
if (!content.includes("const upload = multer")) {
    content = content.replace("const multer = require('multer');", "const multer = require('multer');\nconst upload = multer({ dest: 'uploads/' });");
}

// 3. كود استيراد الرواتب (exceljs)
const salaryRouteCode = `

// استيراد الرواتب باستخدام exceljs - النسخة النهائية المستقرة
app.post('/api/employees/import-salaries', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "الرجاء اختيار ملف Excel." });
    const filePath = req.file.path;
    const ExcelJS = require('exceljs');
    try {
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

        let namesRowIndex = -1, salaryRowIndex = -1;
        for (let i = 0; i < rows.length; i++) {
            if (!rows[i]) continue;
            const rowText = rows[i].join(' ').toLowerCase();
            if (rowText.includes('الراتب') && rowText.includes('الأساسي')) salaryRowIndex = i;
            if (namesRowIndex === -1 && i < 15) {
                const matches = rows[i].filter(cell => {
                    const c = clean(cell);
                    return c && dbNamesClean.some(db => db.cleanName === c || db.cleanName.includes(c) || c.includes(db.cleanName));
                }).length;
                if (matches >= 2) namesRowIndex = i;
            }
        }

        if (namesRowIndex === -1) namesRowIndex = 0;
        if (salaryRowIndex === -1) {
            rows.forEach((row, idx) => {
               if (row.join(' ').includes('الراتب') && !row.join(' ').includes('المتبقي')) salaryRowIndex = idx;
            });
        }

        if (salaryRowIndex === -1) {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            return res.status(400).json({ message: "لم يتم العثور على صف الرواتب." });
        }

        const namesRow = rows[namesRowIndex], salariesRow = rows[salaryRowIndex];
        let updatedCount = 0, notFoundNames = [];

        for (let i = 0; i < namesRow.length; i++) {
            const excelName = namesRow[i], cleanExcel = clean(excelName);
            if (!cleanExcel || cleanExcel === 'التاريخ' || cleanExcel.includes('الراتب')) continue;
            const salaryRaw = salariesRow[i];
            let salary = (salaryRaw && typeof salaryRaw === 'object' && salaryRaw.result !== undefined) ? parseFloat(salaryRaw.result) : parseFloat(salaryRaw);
            if (isNaN(salary) || salary <= 0) continue;
            const match = dbNamesClean.find(db => db.cleanName === cleanExcel || db.cleanName.includes(cleanExcel) || cleanExcel.includes(db.cleanName));
            if (match) {
                await dbRun("UPDATE employees SET base_salary = ? WHERE id = ?", [salary, match.id]);
                updatedCount++;
            } else {
                notFoundNames.push(String(excelName));
            }
        }
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.json({ message: \`تم تحديث \${updatedCount} موظف بنجاح.\`, updatedCount, notFound: notFoundNames.length > 0 ? notFoundNames : undefined });
    } catch (error) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.status(500).json({ message: "خطأ: " + error.message });
    }
});
`;

// الإضافة في نهاية الملف تماماً
content += salaryRouteCode;

fs.writeFileSync('server.js', content, 'utf8');
console.log("✅ تم بناء السيرفر بنجاح من نسخة نظيفة!");
