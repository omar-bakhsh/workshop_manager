const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

// تنظيف أي تكرار أو أخطاء في مسار الرسائل
const messageRouteFixed = `// إرسال رسالة
app.post('/api/messages', async (req, res) => {
    const { employee_id, sender, message } = req.body;
    if (!message) return res.status(400).json({ message: "الرسالة فارغة" });
    try {
        await dbRun(\`INSERT INTO messages (employee_id, sender, message) VALUES (?, ?, ?)\`, [employee_id, sender, message]);
        res.json({ message: "تم إرسال الرسالة بنجاح" });
    } catch (error) {
        console.error("Post Message Error:", error);
        res.status(500).json({ message: "خطأ في إرسال الرسالة" });
    }
});`;

// استبدال الجزء التالف بالكامل
// سنبحث عن بداية مسار الرسائل حتى بداية مسار الرواتب
const startMarker = "app.post('/api/messages'";
const endMarker = "// استيراد الرواتب من ملف Excel - الحل الجذري";

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx > -1 && endIdx > -1) {
    content = content.substring(0, startIdx) + messageRouteFixed + "\n\n" + content.substring(endIdx);
    fs.writeFileSync('server.js', content, 'utf8');
    console.log("✅ تم إصلاح هيكلة الكود بنجاح!");
} else {
    console.log("❌ فشل في تحديد موقع الكود.");
}
