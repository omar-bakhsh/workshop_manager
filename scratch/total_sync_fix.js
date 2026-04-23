const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

// 1. إعدادات السيرفر الأساسية (المنفذ و Multer)
content = content.replace(/const PORT = \d+;/, "const PORT = 8080;");
if (!content.includes("const upload = multer")) {
    content = content.replace("const multer = require('multer');", "const multer = require('multer');\nconst upload = multer({ dest: 'uploads/' });");
}

// 2. كود المزامنة الشاملة (exceljs)
const comprehensiveSyncCode = `

// استيراد الرواتب والمزامنة الشاملة - النسخة الاحترافية
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

        let indices = { names: -1, basic: -1, target: -1, deposit: -1, withdrawals: -1 };
        rows.forEach((row, idx) => {
            const rowText = row.join(' ').toLowerCase();
            if (rowText.includes('الراتب') && rowText.includes('الأساسي')) indices.basic = idx;
            if (rowText.includes('التارقت')) indices.target = idx;
            if (rowText.includes('ايداع') && rowText.includes('مؤسسة')) indices.deposit = idx;
            if (rowText.includes('اجمالي') && rowText.includes('السحوبات')) indices.withdrawals = idx;
            if (indices.names === -1 && idx < 15) {
                const matches = row.filter(cell => {
                    const c = clean(cell);
                    return c && dbNamesClean.some(db => db.cleanName === c || db.cleanName.includes(c) || c.includes(db.cleanName));
                }).length;
                if (matches >= 2) indices.names = idx;
            }
        });

        if (indices.names === -1) indices.names = 0;
        if (indices.basic === -1) {
             if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
             return res.status(400).json({ message: "لم يتم العثور على صف الرواتب الأساسي." });
        }

        const getVal = (rowIdx, colIdx) => {
            if (rowIdx === -1 || !rows[rowIdx]) return 0;
            const val = rows[rowIdx][colIdx];
            let num = 0;
            if (val && typeof val === 'object' && val.result !== undefined) num = parseFloat(val.result);
            else num = parseFloat(val);
            return isNaN(num) ? 0 : num;
        };

        let updatedCount = 0;
        const namesRow = rows[indices.names];
        for (let i = 0; i < namesRow.length; i++) {
            const excelName = namesRow[i], cleanExcel = clean(excelName);
            if (!cleanExcel || cleanExcel === 'التاريخ' || cleanExcel.includes('الراتب')) continue;
            const match = dbNamesClean.find(db => db.cleanName === cleanExcel || db.cleanName.includes(cleanExcel) || cleanExcel.includes(db.cleanName));
            if (match) {
                await dbRun(\`UPDATE employees SET base_salary = ?, target_amount = ?, deposit_amount = ?, total_withdrawals = ? WHERE id = ?\`, 
                    [getVal(indices.basic, i), getVal(indices.target, i), getVal(indices.deposit, i), getVal(indices.withdrawals, i), match.id]);
                updatedCount++;
            }
        }
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.json({ message: \`تمت مزامنة بيانات \${updatedCount} موظف بنجاح (الرواتب، التارقت، الإيداع، السحوبات).\` });
    } catch (error) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.status(500).json({ message: "خطأ: " + error.message });
    }
});
`;

// الإضافة في نهاية الملف
content += comprehensiveSyncCode;
fs.writeFileSync('server.js', content, 'utf8');
console.log("✅ تم بناء السيرفر الشامل بنجاح!");
