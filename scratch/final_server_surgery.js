const fs = require('fs');
let c = fs.readFileSync('server.js', 'utf8');

// Fix work-schedule (restore missing get and fix broken post)
const brokenSectionStart = /app\.get\('\/api\/notifications'[\s\S]*?for \(const day of schedule\)/;
const fixedSection = `app.get('/api/notifications', async (req, res) => {
    try {
        const withdrawals = await dbGet("SELECT COUNT(*) as count FROM withdrawals WHERE status = 'pending'");
        const leaves = await dbGet("SELECT COUNT(*) as count FROM leave_requests WHERE status = 'pending'");
        res.json({ withdrawals: withdrawals.count, leaves: leaves.count, total: withdrawals.count + leaves.count });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.get('/api/work-schedule', async (req, res) => {
    try {
        const schedule = await dbAll("SELECT * FROM work_schedule");
        res.json(schedule);
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.post('/api/work-schedule', async (req, res) => {
    const { schedule } = req.body;
    try {
        for (const day of schedule)`;

if (brokenSectionStart.test(c)) {
    c = c.replace(brokenSectionStart, fixedSection);
}

// Fix redundancy and syntax error in import-salaries
// 1. Remove the first 'const data' declaration that causes shadowing
const redundantData = /const sheetName = workbook\.SheetNames\[0\];[\s\S]*?if \(!data \|\| data\.length === 0\) return res\.status\(400\)\.json\(\{ message: 'الملف فارغ' \}\);/;
c = c.replace(redundantData, '');

// 2. Fix the loop variables and 'data' shadowing
c = c.replace(/const data = xlsx\.utils\.sheet_to_json\(sheet, \{ header: 1, range: 0, defval: "" \}\);/g, 'const currentData = xlsx.utils.sheet_to_json(sheet, { header: 1, range: 0, defval: "" });');
c = c.replace(/if \(!data \|\| data\.length === 0\)/, 'if (!currentData || currentData.length === 0)');
c = c.replace(/Math\.min\(data\.length, 40\)/, 'Math.min(currentData.length, 40)');
c = c.replace(/if \(!data\[i\]\)/, 'if (!currentData[i])');
c = c.replace(/for \(const cell of data\[i\]\)/, 'for (const cell of currentData[i])');
c = c.replace(/finalData = data;/, 'finalData = currentData;');

// Fix inspection stats if missing
if (!c.includes('/api/admin/inspection-stats')) {
    const insertAfter = "res.status(500).json({ message: \"خطأ في تحديث بيانات الموظف\" });\r\n    }\r\n});";
    const statsCode = `

// جلب إحصائيات الفحص للأدمن
app.get('/api/admin/inspection-stats', async (req, res) => {
    try {
        const query = \`
            SELECT e.name as inspector_name, COUNT(i.id) as total_inspections, SUM(i.final_amount) as total_value
            FROM inspections i
            JOIN employees e ON i.inspector_id = e.id
            GROUP BY i.inspector_id
            ORDER BY total_inspections DESC
        \`;
        const stats = await dbAll(query);
        res.json(stats);
    } catch (error) { res.status(500).json({ message: error.message }); }
});`;
    c = c.replace(insertAfter, insertAfter + statsCode);
}

fs.writeFileSync('server.js', c);
console.log('Final server.js surgery completed.');
