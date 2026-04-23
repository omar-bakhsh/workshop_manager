const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const superSyncRoute = `
// استيراد الرواتب والمزامنة الشاملة (النسخة الفائقة للدقة)
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

        let ind = { n: -1, b: -1, t: -1, d: -1, w: -1, r: -1, nr: -1 };
        rows.forEach((row, idx) => {
            const txt = row.join(' ').toLowerCase();
            // البحث عن الصفوف بناءً على مسمياتك في الملف (الصفوف 33-36)
            if (txt.includes('سحوبات') || txt.includes('السحوبات')) ind.w = idx;
            if (txt.includes('الراتب') && txt.includes('الأساسي')) ind.b = idx;
            if (txt.includes('الراتب') && txt.includes('المتبقي')) ind.r = idx;
            if (txt.includes('المتبقي') && txt.includes('الصافي')) ind.nr = idx;
            if (txt.includes('التارقت')) ind.t = idx;
            if (txt.includes('ايداع') && txt.includes('مؤسسة')) ind.d = idx;
            
            // تحديد صف الأسماء (عادة الصف الأول)
            if (ind.n === -1 && idx < 5) {
                const m = row.filter(cell => {
                    const c = clean(cell);
                    return c && dbNamesClean.some(db => db.cleanName === c || db.cleanName.includes(c) || c.includes(db.cleanName));
                }).length;
                if (m >= 3) ind.n = idx;
            }
        });

        const getV = (rIdx, cIdx) => {
            if (rIdx === -1 || !rows[rIdx]) return 0;
            const v = worksheet.getRow(rIdx + 1).getCell(cIdx + 1).value;
            let val = 0;
            if (v && typeof v === 'object') {
                if (v.result !== undefined) val = v.result;
                else if (v.richText) val = v.richText.map(t => t.text).join('');
                else val = v.value || 0;
            } else {
                val = v;
            }
            const num = parseFloat(val);
            return isNaN(num) ? 0 : num;
        };

        let updated = 0;
        const namesRow = rows[ind.n];
        for (let i = 0; i < namesRow.length; i++) {
            const exName = namesRow[i], cEx = clean(exName);
            if (!cEx || cEx === 'التاريخ' || cEx.includes('الراتب') || cEx.includes('سحوبات')) continue;
            const m = dbNamesClean.find(db => db.cleanName === cEx || db.cleanName.includes(cEx) || cEx.includes(db.cleanName));
            if (m) {
                const salary = getV(ind.b, i);
                const target = getV(ind.t, i);
                const deposit = getV(ind.d, i);
                const withdrawals = getV(ind.w, i);
                const remaining = getV(ind.r, i);
                const net = getV(ind.nr, i);

                await dbRun(\`UPDATE employees SET 
                    base_salary = ?, target_amount = ?, deposit_amount = ?, 
                    total_withdrawals = ?, remaining_salary = ?, net_remaining = ? 
                    WHERE id = ?\`, 
                    [salary, target, deposit, withdrawals, remaining, net, m.id]);
                updated++;
            }
        }
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.json({ 
            message: \`تمت المزامنة لـ \${updated} موظف. تم العثور على صف الأسماء في (\${ind.n + 1}) وصف السحوبات في (\${ind.w + 1}).\`,
            debug: { nameRow: ind.n+1, salaryRow: ind.b+1, withdrawalRow: ind.w+1 }
        });
    } catch (error) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.status(500).json({ message: "خطأ في معالجة الملف: " + error.message });
    }
});
`;

const startMarker = "// استيراد الرواتب والمزامنة الشاملة";
const endMarker = "});";
const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker, startIdx + 1000) + 3;

if (startIdx !== -1) {
    content = content.substring(0, startIdx) + superSyncRoute + content.substring(endIdx);
    fs.writeFileSync('server.js', content, 'utf8');
    console.log("✅ تم تحديث محرك المزامنة بنسخة فائقة الدقة!");
}
