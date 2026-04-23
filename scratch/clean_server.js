const fs = require('fs');
let lines = fs.readFileSync('server.js', 'utf8').split('\n');

// حذف الأسطر الزائدة من 1373 إلى 1382 التي تسبب المشكلة
// (الترقيم في البرمجة يبدأ من 0 لذا نطرح 1)
lines.splice(1372, 10); 

fs.writeFileSync('server.js', lines.join('\n'), 'utf8');
console.log("✅ تم تنظيف الكود الزائد بنجاح!");
