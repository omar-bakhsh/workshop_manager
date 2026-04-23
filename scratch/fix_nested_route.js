const fs = require('fs');

let content = fs.readFileSync('server.js', 'utf8');

const regex = /res\.json\(\{ message: "تم حذف الموظف وجميع بياناته بنجاح" \}\);\s*\/\*?.*?استيراد الرواتب من ملف Excel[\s\S]*?app\.post\('\/api\/employees\/import-salaries'[\s\S]*?\n\}\);\s*\n\s*\}\s*catch\s*\(error\)\s*\{\s*console\.error\("Delete Employee Error:", error\);\s*res\.status\(500\)\.json\(\{ message: "خطأ في حذف الموظف" \}\);\s*\}\s*\}\);/m;

const replacement = `res.json({ message: "تم حذف الموظف وجميع بياناته بنجاح" });
    } catch (error) {
        console.error("Delete Employee Error:", error);
        res.status(500).json({ message: "خطأ في حذف الموظف" });
    }
});

// استيراد الرواتب من ملف Excel
app.post('/api/employees/import-salaries', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "الرجاء اختيار ملف Excel." });
    const filePath = req.file.path;
    try {
        const workbook = xlsx.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        // قراءة كمصفوفة ثنائية الأبعاد (صفوف وأعمدة)
        const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

        // البحث عن صف الراتب (يبحث في كل خلية عن كلمة "الراتب")
        let salaryRowIndex = -1;
        for (let i = 0; i < rows.length; i++) {
            if (rows[i] && rows[i].some(cell => cell && String(cell).includes('الراتب'))) {
                salaryRowIndex = i;
                break;
            }
        }
        // احتياطي: استخدام الصف 34 (رقم 35 في Excel) إذا لم يُعثر على النص
        if (salaryRowIndex === -1 && rows.length >= 35) salaryRowIndex = 34;

        if (salaryRowIndex === -1) {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            return res.status(400).json({ message: "لم يتم العثور على صف الرواتب في الملف." });
        }

        const namesRow = rows[0];           // الأسماء في الصف الأول
        const salariesRow = rows[salaryRowIndex]; // الرواتب في صف الرواتب

        // جلب جميع الموظفين للمطابقة الذكية
        const allEmployees = await dbAll("SELECT id, name FROM employees WHERE is_active = 1");

        let updatedCount = 0;
        let notFoundNames = [];

        for (let col = 1; col < namesRow.length; col++) {
            const excelName = namesRow[col] ? String(namesRow[col]).trim().toLowerCase() : null;
            const salary = parseFloat(salariesRow[col]);

            if (!excelName || isNaN(salary) || salary <= 0) continue;

            // مطابقة ذكية: تطابق كامل أو جزئي بتجاهل حالة الأحرف
            const match = allEmployees.find(emp => {
                const dbName = emp.name.toLowerCase();
                return dbName === excelName || dbName.includes(excelName) || excelName.includes(dbName);
            });

            if (match) {
                await dbRun("UPDATE employees SET base_salary = ? WHERE id = ?", [salary, match.id]);
                updatedCount++;
            } else {
                notFoundNames.push(namesRow[col]);
            }
        }

        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.json({
            message: "تم تحديث " + updatedCount + " موظف بنجاح.",
            updatedCount,
            notFound: notFoundNames
        });
    } catch (error) {
        console.error("Import Salaries Error:", error);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.status(500).json({ message: "خطأ في معالجة ملف Excel: " + error.message });
    }
});`;

if (regex.test(content)) {
    content = content.replace(regex, replacement);
    fs.writeFileSync('server.js', content, 'utf8');
    console.log("✅ Fixed overlapping route!");
} else {
    console.log("❌ Could not find the regex pattern to replace.");
}
