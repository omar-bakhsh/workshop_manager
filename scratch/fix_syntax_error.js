const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const target = "app.post('/api/messages', async (req, res) => {\n    const { employee_id, sender, message } = req.body;\n    if (!message) return res.status(400).json({ message: \"الرسالة فارغة\" });\n\n// استيراد الرواتب من ملف Excel - الحل الجذري";

const fixed = `// إرسال رسالة
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
});

// استيراد الرواتب من ملف Excel - الحل الجذري`;

if (content.includes("app.post('/api/messages', async (req, res) => {")) {
    // استبدال الجزء المكسور بالجزء السليم
    const startIdx = content.indexOf("app.post('/api/messages'");
    const endIdx = content.indexOf("// استيراد الرواتب من ملف Excel - الحل الجذري");
    
    if (startIdx > -1 && endIdx > -1) {
        content = content.substring(0, startIdx) + fixed + content.substring(endIdx + "// استيراد الرواتب من ملف Excel - الحل الجذري".length);
        fs.writeFileSync('server.js', content, 'utf8');
        console.log("✅ تم إصلاح تداخل المسارات بنجاح!");
    } else {
        console.log("⚠️ لم يتم العثور على الأجزاء المطلوبة بدقة.");
    }
} else {
    console.log("❌ لم يتم العثور على مسار الرسائل.");
}
