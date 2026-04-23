const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

// 1. Port 8080
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

// 4. PUT Route
if (content.includes("const { name, section_id, target, base_salary, username, password, hide_income } = req.body;")) {
    content = content.replace("const { name, section_id, target, base_salary, username, password, hide_income } = req.body;", "const { name, section_id, target, base_salary, target_amount, deposit_amount, total_withdrawals, username, password, hide_income } = req.body;");
}
const oldPu = "await dbRun(`UPDATE employees SET name = ?, section_id = ?, target = ?, base_salary = ?, hide_income = ? WHERE id = ?`, [name, section_id, target, base_salary, hide_income, id]);";
const newPu = "await dbRun(`UPDATE employees SET name = ?, section_id = ?, target = ?, base_salary = ?, target_amount = ?, deposit_amount = ?, total_withdrawals = ?, hide_income = ? WHERE id = ?`, [name, section_id, target, base_salary, target_amount || 0, deposit_amount || 0, total_withdrawals || 0, hide_income, id]);";
if (content.includes(oldPu)) content = content.replace(oldPu, newPu);

// 5. Dashboard Last Updates
if (!content.includes("last_income_at")) {
    const oldB = 'total_withdrawal: totalWithdrawalRow.total_withdrawal,';
    content = content.replace(oldB, 'total_withdrawal: totalWithdrawalRow.total_withdrawal,\n                last_income_at: entries.length > 0 ? entries[0].created_at : null,\n                last_withdrawal_at: withdrawals.length > 0 ? withdrawals[0].created_at : null,');
}

// 6. THE ULTRA SYNC ROUTE
const ultraSync = `
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
        worksheet.eachRow((row, rowNumber) => {
            const firstCell = String(row.getCell(1).value || '').trim();
            if (firstCell.includes('إجمالي السحوبات') || firstCell.includes('اجمالي السحوبات')) ind.w = rowNumber - 1;
            if (firstCell.includes('الراتب المتبقي')) ind.r = rowNumber - 1;
            if (firstCell.includes('الراتب الأساسي') || firstCell.includes('الراتب الاساسي')) ind.b = rowNumber - 1;
            if (firstCell.includes('ايداع مؤسسة') || firstCell.includes('إيداع مؤسسة')) ind.d = rowNumber - 1;
            if (firstCell.includes('المتبقي الصافي')) ind.nr = rowNumber - 1;
            if (firstCell.includes('التارقت') && rowNumber > 30) ind.t = rowNumber - 1;

            if (ind.n === -1 && rowNumber < 10) {
                let m = 0;
                row.eachCell(c => { if(clean(c.value) && dbNamesClean.some(db => db.cleanName === clean(c.value))) m++; });
                if (m >= 3) ind.n = rowNumber - 1;
            }
        });

        const getV = (rIdx, cIdx) => {
            if (rIdx === -1) return 0;
            const cell = worksheet.getRow(rIdx + 1).getCell(cIdx + 1);
            let val = 0;
            if (cell.value && typeof cell.value === 'object') val = cell.value.result !== undefined ? cell.value.result : (cell.value.value || 0);
            else val = cell.value;
            return isNaN(parseFloat(val)) ? 0 : parseFloat(val);
        };

        let updated = 0;
        const namesRow = worksheet.getRow(ind.n + 1);
        for (let i = 1; i <= namesRow.actualCellCount + 100; i++) {
            const cell = namesRow.getCell(i);
            const cEx = clean(cell.value);
            if (!cEx || cEx.includes('تاريخ')) continue;
            const m = dbNamesClean.find(db => db.cleanName === cEx || db.cleanName.includes(cEx) || cEx.includes(db.cleanName));
            if (m) {
                await dbRun(\`UPDATE employees SET base_salary=?, target_amount=?, deposit_amount=?, total_withdrawals=?, remaining_salary=?, net_remaining=? WHERE id=?\`, 
                    [getV(ind.b, i-1), getV(ind.t, i-1), getV(ind.d, i-1), getV(ind.w, i-1), getV(ind.r, i-1), getV(ind.nr, i-1), m.id]);
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

content += ultraSync;
fs.writeFileSync('server.js', content, 'utf8');
console.log("✅ تمت بناء السيرفر النهائي والمثالي!");
