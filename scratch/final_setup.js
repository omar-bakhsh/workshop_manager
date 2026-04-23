const fs = require('fs');
const { execSync } = require('child_process');

let content = fs.readFileSync('server.js', 'utf8');

// 1. إضافة multer و upload إذا لم يكونا موجودَين
if (!content.includes("const upload = multer")) {
    content = content.replace(
        "const multer = require('multer');",
        "const multer = require('multer');\nconst upload = multer({ dest: 'uploads/' });"
    );
    console.log("✅ تمت إضافة upload multer");
}

// 2. تغيير PORT إلى 8080
content = content.replace(/const PORT = \d+;/, 'const PORT = 8080;');
console.log("✅ تم تغيير المنفذ إلى 8080");

// 3. إضافة مسار import-salaries بعد مسار حذف الموظف
const insertAfterTarget = 'res.json({ message: "تم حذف الموظف وجميع بياناته بنجاح" });';
const insertAfterPos = content.indexOf(insertAfterTarget);

if (insertAfterPos === -1) {
    console.log("❌ لم يتم العثور على نقطة الإدراج");
    process.exit(1);
}

// نجد نهاية الـ route }); بعد هذه الرسالة
let searchFrom = insertAfterPos + insertAfterTarget.length;
let depth = 0;
let endPos = -1;
for (let i = searchFrom; i < content.length - 1; i++) {
    if (content[i] === '{') depth++;
    if (content[i] === '}') {
        if (depth === 0) {
            // ابحث عن }); بعده
            const slice = content.substring(i, i + 5);
            if (slice.includes('});') || slice.includes('}\n\n')) {
                endPos = content.indexOf('});', i) + 3;
                break;
            }
        }
        depth--;
    }
}

if (endPos === -1) {
    // طريقة بديلة: ابحث عن }); بعد الرسالة مباشرة
    endPos = content.indexOf('});', searchFrom) + 3;
}

const newRoute = `

// استيراد الرواتب من ملف Excel - الحل الجذري
app.post('/api/employees/import-salaries', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "الرجاء اختيار ملف Excel." });
    const filePath = req.file.path;
    try {
        console.log('\\n===== بدء استيراد الرواتب =====');
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });
        console.log('عدد الصفوف المقروءة: ' + rows.length);

        // طباعة محتوى كل صف للتشخيص
        rows.forEach((row, i) => {
            const first = row ? row.find(c => c !== null && c !== undefined && c !== '') : null;
            if (first !== null && first !== undefined) {
                console.log('  الصف ' + (i+1) + ': "' + String(first).trim() + '"');
            }
        });

        const namesRow = rows[0] || [];

        // البحث عن صف الراتب الأساسي
        let salaryRowIndex = 34; // الافتراضي: الصف 35
        for (let i = 0; i < rows.length; i++) {
            if (!rows[i]) continue;
            const rowText = rows[i].filter(c => c).map(c => String(c)).join(' ');
            if ((rowText.includes('الراتب') && rowText.includes('الأساسي'))) {
                salaryRowIndex = i;
                console.log('✅ وجد صف الراتب الأساسي في الصف رقم: ' + (i+1));
                break;
            }
        }

        const salariesRow = rows[salaryRowIndex] || [];
        console.log('سيتم استخدام الصف: ' + (salaryRowIndex + 1));

        const allEmployees = await dbAll("SELECT id, name FROM employees WHERE is_active = 1");
        console.log('الموظفون في البرنامج: ' + allEmployees.map(e => e.name).join(', '));

        let updatedCount = 0;
        let notFoundNames = [];

        for (let col = 0; col < namesRow.length; col++) {
            const excelName = namesRow[col] ? String(namesRow[col]).trim() : null;
            const salary = parseFloat(salariesRow[col]);
            if (!excelName || isNaN(salary) || salary <= 0) continue;

            const excelNameLower = excelName.toLowerCase();
            const match = allEmployees.find(emp => {
                const dbName = emp.name.toLowerCase();
                return dbName === excelNameLower || dbName.includes(excelNameLower) || excelNameLower.includes(dbName);
            });

            if (match) {
                await dbRun("UPDATE employees SET base_salary = ? WHERE id = ?", [salary, match.id]);
                updatedCount++;
                console.log('✅ تم تحديث: ' + match.name + ' <- ' + salary);
            } else {
                notFoundNames.push(excelName);
                console.log('⚠️ لم يتم العثور على: ' + excelName);
            }
        }

        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        console.log('===== انتهى: ' + updatedCount + ' موظف =====\\n');
        res.json({ message: 'تم تحديث ' + updatedCount + ' موظف بنجاح.', updatedCount, notFound: notFoundNames.length > 0 ? notFoundNames : undefined });
    } catch (error) {
        console.error("Import Salaries Error:", error);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.status(500).json({ message: "خطأ: " + error.message });
    }
});
`;

content = content.substring(0, endPos) + newRoute + content.substring(endPos);
fs.writeFileSync('server.js', content, 'utf8');
console.log("✅ تم إضافة مسار الاستيراد");

// التحقق النهائي
try {
    execSync('node --check server.js', { stdio: 'pipe' });
    console.log("🎉 الملف سليم 100%!");
} catch(e) {
    console.log("❌ خطأ:", e.stderr?.toString());
}
