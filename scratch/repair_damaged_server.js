const fs = require('fs');
let c = fs.readFileSync('server.js', 'utf8');

// Fix damaged sections-summary and insert inspection-stats
const damagedPattern = /app\.get\('\/api\/sections-summary'[^}]*FROM sections s\s+\/\/ جلب إحصائيات الموظف/;
const correctedBlock = `app.get('/api/sections-summary', async (req, res) => {
    try {
        const summary = await dbAll(\`
            SELECT
                s.id,
                s.name,
                COUNT(e.id) AS employee_count,
                COALESCE(SUM(e.target), 0) AS total_target,
                COALESCE(SUM(ent.income), 0) AS total_income
            FROM sections s
            LEFT JOIN employees e ON s.id = e.section_id AND e.is_active = 1
            LEFT JOIN entries ent ON e.id = ent.employee_id
            GROUP BY s.id
            ORDER BY s.id
        \`);
        res.json(summary);
    } catch (error) {
        console.error("Fetch Sections Summary Error:", error);
        res.status(500).json({ message: "خطأ في جلب ملخص الأقسام" });
    }
});

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
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// جلب إحصائيات الموظف`;

if (damagedPattern.test(c)) {
    c = c.replace(damagedPattern, correctedBlock);
    fs.writeFileSync('server.js', c);
    console.log('✅ REPAIR SUCCESSFUL');
} else {
    console.log('❌ PATTERN NOT FOUND');
}
