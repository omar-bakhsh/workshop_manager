const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

// إضافة إعداد upload بعد سطر require multer
if (!content.includes('const upload = multer')) {
    content = content.replace(
        "const multer = require('multer');",
        "const multer = require('multer');\nconst upload = multer({ dest: 'uploads/' });"
    );
    fs.writeFileSync('server.js', content, 'utf8');
    console.log('✅ تم إضافة إعداد upload');
} else {
    console.log('⚠️ upload موجود بالفعل');
}

// التحقق
const { execSync } = require('child_process');
try {
    execSync('node --check server.js', { stdio: 'pipe' });
    console.log('🎉 الملف صحيح!');
} catch(e) {
    console.log('❌ خطأ:', e.stderr?.toString());
}
