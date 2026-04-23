const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

// 1. استخراج كود الاستيراد بالكامل (من بدايته حتى علامة نهايته)
const startMarker = "// استيراد الرواتب باستخدام exceljs";
const startIdx = content.indexOf(startMarker);
if (startIdx === -1) {
    console.log("❌ لم يتم العثور على الكود!");
    process.exit(1);
}

// سنجد نهاية الكود بالبحث عن آخر }); تابعة له
let endIdx = content.indexOf("});", startIdx + 100) + 3;
const extractedRoute = content.substring(startIdx, endIdx);

// 2. حذفه من مكانه الحالي المتداخل
content = content.substring(0, startIdx) + content.substring(endIdx);

// 3. إضافته في نهاية الملف تماماً (قبل الاستماع للمنفذ)
const listenMarker = "app.listen";
const listenIdx = content.indexOf(listenMarker);

if (listenIdx !== -1) {
    content = content.substring(0, listenIdx) + extractedRoute + "\n\n" + content.substring(listenIdx);
    fs.writeFileSync('server.js', content, 'utf8');
    console.log("✅ تم نقل المسار إلى المكان الصحيح بنجاح!");
} else {
    // إضافة في نهاية الملف لو لم نجد listen
    content += "\n\n" + extractedRoute;
    fs.writeFileSync('server.js', content, 'utf8');
}
