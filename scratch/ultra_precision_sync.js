const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const ultraSyncRoute = `
// استيراد الرواتب والمزامنة الشاملة (النسخة الذكية جداً)
app.post('/api/employees/import-salaries', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "الرجاء اختيار ملف Excel." });
    const filePath = req.file.path;
    const ExcelJS = require('exceljs');
    try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        const worksheet = workbook.worksheets[0];
        
        const allEmployees = await dbAll("SELECT id, name FROM employees WHERE is_active = 1");
        const clean = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9\\u0600-\\u06FF]/g, '');
        const dbNamesClean = allEmployees.map(e => ({ id: e.id, name: e.name, cleanName: clean(e.name) }));

        let ind = { n: -1, b: -1, t: -1, d: -1, w: -1, r: -1, nr: -1 };
        
        // البحث عن الصفوف بدقة في العمود A
        worksheet.eachRow((row, rowNumber) => {
            const firstCell = String(row.getCell(1).value || '').trim();
            if (firstCell.includes('إجمالي السحوبات') || firstCell.includes('اجمالي السحوبات')) ind.w = rowNumber - 1;
            if (firstCell.includes('الراتب المتبقي')) ind.r = rowNumber - 1;
            if (firstCell.includes('الراتب الأساسي') || firstCell.includes('الراتب الاساسي')) ind.b = rowNumber - 1;
            if (firstCell.includes('ايداع مؤسسة') || firstCell.includes('إيداع مؤسسة')) ind.d = rowNumber - 1;
            if (firstCell.includes('المتبقي الصافي')) ind.nr = rowNumber - 1;
            if (firstCell === 'التارقت' || firstCell.includes('التارقت')) {
                // التأكد من أنه ليس الصف الأصفر (38) بل الصف الذي يحتوي على البيانات
                if (ind.t === -1) ind.t = rowNumber - 1;
            }

            // البحث عن صف الأسماء (الصف رقم 1 عادة)
            if (ind.n === -1 && rowNumber < 10) {
                let matches = 0;
                row.eachCell(cell => {
                    const c = clean(cell.value);
                    if (c && dbNamesClean.some(db => db.cleanName === c)) matches++;
                });
                if (matches >= 3) ind.n = rowNumber - 1;
            }
        });

        const getV = (rIdx, cIdx) => {
            if (rIdx === -1) return 0;
            const cell = worksheet.getRow(rIdx + 1).getCell(cIdx + 1);
            let val = 0;
            if (cell.value && typeof cell.value === 'object') {
                val = cell.value.result !== undefined ? cell.value.result : (cell.value.value || 0);
            } else {
                val = cell.value;
            }
            const num = parseFloat(val);
            return isNaN(num) ? 0 : num;
        };

        let updated = 0;
        const namesRow = worksheet.getRow(ind.n + 1);
        namesRow.eachCell((cell, colNumber) => {
            const exName = cell.value, cEx = clean(exName);
            if (!cEx || cEx.includes('تاريخ')) return;
            const m = dbNamesClean.find(db => db.cleanName === cEx || db.cleanName.includes(cEx) || cEx.includes(db.cleanName));
            if (m) {
                const colIdx = colNumber - 1;
                dbRun(\`UPDATE employees SET 
                    base_salary = ?, target_amount = ?, deposit_amount = ?, 
                    total_withdrawals = ?, remaining_salary = ?, net_remaining = ? 
                    WHERE id = ?\`, 
                    [getV(ind.b, colIdx), getV(ind.t, colIdx), getV(ind.d, colIdx), 
                     getV(ind.w, colIdx), getV(ind.r, colIdx), getV(ind.nr, colIdx), m.id]);
                updated++;
            }
        });

        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.json({ message: \`تمت المزامنة لـ \${updated} موظف بنجاح (الأسماء: صف \${ind.n+1}، السحوبات: صف \${ind.w+1})\` });
    } catch (error) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.status(500).json({ message: "خطأ: " + error.message });
    }
});
`;

const startMarker = "// استيراد الرواتب والمزامنة الشاملة";
const endMarker = "});";
const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker, startIdx + 1000) + 3;

if (startIdx !== -1) {
    content = content.substring(0, startIdx) + ultraSyncRoute + content.substring(endIdx);
    fs.writeFileSync('server.js', content, 'utf8');
    console.log("✅ تم تحديث محرك المزامنة بنسخة الترا فائقة الدقة!");
}
