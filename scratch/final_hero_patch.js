const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

// 1. Port
content = content.replace(/const PORT = \d+;/, "const PORT = 8080;");

// 2. Multer
if (!content.includes("const upload = multer")) {
    content = content.replace("const multer = require('multer');", "const multer = require('multer');\nconst upload = multer({ dest: 'uploads/' });");
}

// 3. GET Query - Include all fields
const oldQ = "e.base_salary,";
const newQ = "e.base_salary, e.target_amount, e.deposit_amount, e.total_withdrawals, e.remaining_salary, e.net_remaining,";
if (!content.includes("e.target_amount") && content.includes(oldQ)) {
    content = content.replace(oldQ, newQ);
}

// 4. PUT Route - Update all fields
const oldPu = "await dbRun(`UPDATE employees SET name = ?, section_id = ?, target = ?, base_salary = ?, hide_income = ? WHERE id = ?`, [name, section_id, target, base_salary, hide_income, id]);";
const newPu = "await dbRun(`UPDATE employees SET name = ?, section_id = ?, target = ?, base_salary = ?, target_amount = ?, deposit_amount = ?, total_withdrawals = ?, hide_income = ? WHERE id = ?`, [name, section_id, target, base_salary, target_amount || 0, deposit_amount || 0, total_withdrawals || 0, hide_income, id]);";
if (content.includes("const { name, section_id, target, base_salary, username, password, hide_income } = req.body;")) {
    content = content.replace("const { name, section_id, target, base_salary, username, password, hide_income } = req.body;", "const { name, section_id, target, base_salary, target_amount, deposit_amount, total_withdrawals, username, password, hide_income } = req.body;");
}
if (content.includes(oldPu)) content = content.replace(oldPu, newPu);

// 5. Last Update for Employee Dashboard
if (!content.includes("last_income_at")) {
    const oldB = 'total_withdrawal: totalWithdrawalRow.total_withdrawal,';
    content = content.replace(oldB, 'total_withdrawal: totalWithdrawalRow.total_withdrawal,\n                last_income_at: entries.length > 0 ? entries[0].created_at : null,\n                last_withdrawal_at: withdrawals.length > 0 ? withdrawals[0].created_at : null,');
}

// 6. SUPER PRECISION IMPORT ROUTE
const superSync = `
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
            if (txt.includes('سحوبات') || txt.includes('السحوبات')) ind.w = idx;
            if (txt.includes('الراتب') && (txt.includes('الأساسي') || txt.includes('الاساسي'))) ind.b = idx;
            if (txt.includes('الراتب') && txt.includes('المتبقي')) ind.r = idx;
            if (txt.includes('المتبقي') && txt.includes('الصافي')) ind.nr = idx;
            if (txt.includes('التارقت')) ind.t = idx;
            if (txt.includes('ايداع') && txt.includes('مؤسسة')) ind.d = idx;
            if (ind.n === -1 && idx < 10) {
                const m = row.filter(cell => {
                    const c = clean(cell);
                    return c && dbNamesClean.some(db => db.cleanName === c || db.cleanName.includes(c) || c.includes(db.cleanName));
                }).length;
                if (m >= 3) ind.n = idx;
            }
        });

        const getV = (rIdx, cIdx) => {
            if (rIdx === -1) return 0;
            const cell = worksheet.getRow(rIdx + 1).getCell(cIdx + 1);
            let val = 0;
            if (cell.value && typeof cell.value === 'object' && cell.value.result !== undefined) val = cell.value.result;
            else val = cell.value;
            const num = parseFloat(val);
            return isNaN(num) ? 0 : num;
        };

        let updated = 0;
        const namesRow = rows[ind.n];
        for (let i = 0; i < namesRow.length; i++) {
            const exName = namesRow[i], cEx = clean(exName);
            if (!cEx || cEx.includes('تاريخ') || cEx.includes('راتب') || cEx.includes('سحب')) continue;
            const m = dbNamesClean.find(db => db.cleanName === cEx || db.cleanName.includes(cEx) || cEx.includes(db.cleanName));
            if (m) {
                await dbRun(\`UPDATE employees SET 
                    base_salary = ?, target_amount = ?, deposit_amount = ?, 
                    total_withdrawals = ?, remaining_salary = ?, net_remaining = ? 
                    WHERE id = ?\`, 
                    [getV(ind.b, i), getV(ind.t, i), getV(ind.d, i), getV(ind.w, i), getV(ind.r, i), getV(ind.nr, i), m.id]);
                updated++;
            }
        }
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.json({ message: \`تمت المزامنة لـ \${updated} موظف بنجاح.\`, debug: { names: ind.n+1, salary: ind.b+1, withdrawals: ind.w+1 } });
    } catch (error) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.status(500).json({ message: "خطأ: " + error.message });
    }
});
`;

content += superSync;
fs.writeFileSync('server.js', content, 'utf8');
console.log("✅ تم بناء السيرفر النهائي والمثالي!");
