const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

// 1. استخراج كود الرواتب (الحل الجذري المعتمد على exceljs)
const salaryRouteStartMarker = "const filePath = req.file.path;";
const salaryRouteEndMarker = "res.json({ message: `تم تحديث ${updatedCount} موظف بنجاح.`, updatedCount, notFound: notFoundNames.length > 0 ? notFoundNames : undefined });";

const sIdx = content.indexOf(salaryRouteStartMarker);
const eIdx = content.indexOf(salaryRouteEndMarker);

let extractedSalaryRoute = "";
if (sIdx !== -1 && eIdx !== -1) {
    // نأخذ الكود من البداية حتى نهاية الـ catch الخاصة به
    const fullEnd = content.indexOf("});", eIdx) + 3;
    extractedSalaryRoute = `
// استيراد الرواتب باستخدام exceljs
app.post('/api/employees/import-salaries', upload.single('file'), async (req, res) => {
` + content.substring(sIdx, fullEnd);
    
    // حذف الكود من مكانه الخاطئ
    content = content.substring(0, sIdx - 50) + "\n" + content.substring(fullEnd + 1);
}

// 2. إصلاح القوس المكسور في مسار الحذف
// سنبحث عن التتابع المكسور: "نجاح" }); } catch
const brokenPart = 'نجاح" });\n\n\n    } catch (error) {';
if (content.includes(brokenPart)) {
    content = content.replace(brokenPart, 'نجاح" });\n    } catch (error) {');
    console.log("✅ تم إصلاح قوس مسار الحذف.");
}

// 3. وضع مسار الرواتب في نهاية الملف قبل listen
const listenPos = content.lastIndexOf("app.listen");
if (listenPos !== -1 && extractedSalaryRoute !== "") {
    content = content.substring(0, listenPos) + extractedSalaryRoute + "\n\n" + content.substring(listenPos);
    fs.writeFileSync('server.js', content, 'utf8');
    console.log("✅ تم نقل مسار الرواتب للمكان السليم.");
} else {
    fs.writeFileSync('server.js', content + "\n\n" + extractedSalaryRoute, 'utf8');
}
