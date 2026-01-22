const fs = require('fs');
const path = require('path');

// قائمة الملفات HTML المطلوب تحديثها
const htmlFiles = [
    'admin.html',
    'employee.html',
    'inspector.html',
    'shortcuts_manager.html',
    'services_manager.html',
    'lifts.html',
    'income_report.html'
];

// الكود المطلوب إضافته في head
const toastIncludes = `    <link rel="stylesheet" href="toast.css">
    <script src="toast.js"></script>
    <script src="toast_helpers.js"></script>`;

console.log('🚀 بدء إضافة نظام Toast للصفحات...\n');

htmlFiles.forEach(filename => {
    const filePath = path.join(__dirname, filename);

    // التحقق من وجود الملف
    if (!fs.existsSync(filePath)) {
        console.log(`⚠️  تخطي ${filename} - الملف غير موجود`);
        return;
    }

    try {
        let content = fs.readFileSync(filePath, 'utf8');

        // التحقق من عدم وجود toast.css مسبقاً
        if (content.includes('toast.css')) {
            console.log(`✓  ${filename} - نظام Toast موجود مسبقاً`);
            return;
        }

        // البحث عن </head> وإضافة الكود قبله
        if (content.includes('</head>')) {
            content = content.replace('</head>', `${toastIncludes}\n</head>`);
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✅ ${filename} - تم إضافة نظام Toast بنجاح`);
        } else {
            console.log(`❌ ${filename} - لم يتم العثور على </head>`);
        }
    } catch (error) {
        console.log(`❌ ${filename} - خطأ: ${error.message}`);
    }
});

console.log('\n✨ انتهت العملية!');
console.log('\n📝 الخطوات التالية:');
console.log('1. افتح toast_demo.html لرؤية أمثلة حية');
console.log('2. اقرأ TOAST_GUIDE.md للتعليمات الكاملة');
console.log('3. استبدل alert() بـ showSuccess() أو showError()');
