const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

// 1. Port
content = content.replace(/const PORT = \d+;/, "const PORT = 8080;");

// 2. GET /api/employees - Query Update
const oldGetQuery = "e.base_salary,";
const newGetQuery = "e.base_salary, e.target_amount, e.deposit_amount, e.total_withdrawals, e.remaining_salary, e.net_remaining,";
if (!content.includes("e.target_amount") && content.includes(oldGetQuery)) {
    content = content.replace(oldGetQuery, newGetQuery);
}

// 3. PUT /api/employees/:id - Logic Update
const oldPutReq = "const { name, section_id, target, base_salary, username, password, hide_income } = req.body;";
const newPutReq = "const { name, section_id, target, base_salary, target_amount, deposit_amount, total_withdrawals, username, password, hide_income } = req.body;";
if (content.includes(oldPutReq)) content = content.split(oldPutReq).join(newPutReq);

const oldPutQuery = "UPDATE employees SET name = ?, section_id = ?, target = ?, base_salary = ?, hide_income = ? WHERE id = ?";
const newPutQuery = "UPDATE employees SET name = ?, section_id = ?, target = ?, base_salary = ?, target_amount = ?, deposit_amount = ?, total_withdrawals = ?, hide_income = ? WHERE id = ?";
if (content.includes(oldPutQuery)) content = content.split(oldPutQuery).join(newPutQuery);

const oldPutParams = "[name, section_id, target, base_salary, hide_income, id]";
const newPutParams = "[name, section_id, target, base_salary, target_amount, deposit_amount, total_withdrawals, hide_income, id]";
if (content.includes(oldPutParams)) content = content.split(oldPutParams).join(newPutParams);

// 4. GET /api/employee-stats/:id - Last Update Time
if (!content.includes("last_income_at")) {
    const oldBrief = 'total_withdrawal: totalWithdrawalRow.total_withdrawal,';
    content = content.replace(oldBrief, 'total_withdrawal: totalWithdrawalRow.total_withdrawal,\n                last_income_at: entries.length > 0 ? entries[0].created_at : null,\n                last_withdrawal_at: withdrawals.length > 0 ? withdrawals[0].created_at : null,');
}

// 5. Ensure Multer Upload is present
if (!content.includes("const upload = multer")) {
    content = content.replace("const multer = require('multer');", "const multer = require('multer');\nconst upload = multer({ dest: 'uploads/' });");
}

// 6. Master Import Route
const masterImportRoute = `
// استيراد الرواتب والمزامنة الشاملة (النسخة النهائية الكاملة)
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
            if (txt.includes('الراتب') && txt.includes('الأساسي')) ind.b = idx;
            if (txt.includes('الراتب') && txt.includes('المتبقي')) ind.r = idx;
            if (txt.includes('المتبقي') && txt.includes('الصافي')) ind.nr = idx;
            if (txt.includes('التارقت')) ind.t = idx;
            if (txt.includes('ايداع') && txt.includes('مؤسسة')) ind.d = idx;
            if (txt.includes('اجمالي') && txt.includes('السحوبات')) ind.w = idx;
            if (ind.n === -1 && idx < 15) {
                const m = row.filter(cell => {
                    const c = clean(cell);
                    return c && dbNamesClean.some(db => db.cleanName === c || db.cleanName.includes(c) || c.includes(db.cleanName));
                }).length;
                if (m >= 2) ind.n = idx;
            }
        });

        if (ind.n === -1) ind.n = 0;
        const getV = (rIdx, cIdx) => {
            if (rIdx === -1 || !rows[rIdx]) return 0;
            const v = rows[rIdx][cIdx];
            let n = 0;
            if (v && typeof v === 'object' && v.result !== undefined) n = parseFloat(v.result); else n = parseFloat(v);
            return isNaN(n) ? 0 : n;
        };

        let updated = 0;
        const namesRow = rows[ind.n];
        for (let i = 0; i < namesRow.length; i++) {
            const exName = namesRow[i], cEx = clean(exName);
            if (!cEx || cEx === 'التاريخ' || cEx.includes('الراتب')) continue;
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
        res.json({ message: \`تمت المزامنة الكاملة لـ \${updated} موظف بنجاح بكافة التفاصيل.\`, updated });
    } catch (error) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.status(500).json({ message: "خطأ: " + error.message });
    }
});
`;

if (!content.includes("import-salaries")) {
    content += masterImportRoute;
}

fs.writeFileSync('server.js', content, 'utf8');
console.log("✅ تمت عملية حقن الكود الشاملة والآمنة بنجاح!");
