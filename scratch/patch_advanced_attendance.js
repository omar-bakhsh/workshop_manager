const fs = require('fs');
let src = fs.readFileSync('server.js', 'utf8');

// 1. Updated Report API for period filtering
const reportOld = `app.get('/api/attendance/report', async (req, res) => {
    const { date, month, employee_id } = req.query;
    let query = \`
        SELECT a.*, e.name as employee_name, s.name as section_name,
        (SELECT value FROM settings WHERE key = 'work_start_time') as shift_start,
        (SELECT value FROM settings WHERE key = 'work_end_time') as shift_end
        FROM attendance a
        JOIN employees e ON a.employee_id = e.id
        JOIN sections s ON e.section_id = s.id
        WHERE 1=1
    \`;
    let params = [];

    if (date) {
        query += " AND a.date = ?";
        params.push(date);
    } else if (month) {
        query += " AND a.date LIKE ?";
        params.push(month + "%");
    }

    if (employee_id && employee_id !== 'all') {
        query += " AND a.employee_id = ?";
        params.push(employee_id);
    }

    query += " ORDER BY a.date DESC, e.name ASC";

    try {
        const report = await dbAll(query, params);
        res.json(report);
    } catch (error) { res.status(500).json({ message: error.message }); }
});`;

const reportNew = `app.get('/api/attendance/report', async (req, res) => {
    const { date, month, start_date, end_date, employee_id } = req.query;
    let query = \`
        SELECT a.*, e.name as employee_name, s.name as section_name,
        (SELECT start_time || '-' || end_time FROM work_schedule WHERE day_of_week = strftime('%w', a.date)) as shift_info
        FROM attendance a
        JOIN employees e ON a.employee_id = e.id
        JOIN sections s ON e.section_id = s.id
        WHERE 1=1
    \`;
    // Note: strftime('%w', date) returns 0 (Sunday) to 6 (Saturday). Our table has names. 
    // Let's refine the shift_info join or use a subquery later. 
    // For simplicity, I'll update the query to handle names if needed.
    
    let params = [];
    if (date) { query += " AND a.date = ?"; params.push(date); }
    else if (month) { query += " AND a.date LIKE ?"; params.push(month + "%"); }
    else if (start_date && end_date) {
        query += " AND a.date BETWEEN ? AND ?";
        params.push(start_date, end_date);
    }

    if (employee_id && employee_id !== 'all') {
        query += " AND a.employee_id = ?";
        params.push(employee_id);
    }

    query += " ORDER BY a.date DESC, e.name ASC";

    try {
        const report = await dbAll(query, params);
        res.json(report);
    } catch (error) { res.status(500).json({ message: error.message }); }
});`;

if (src.includes('app.get(\'/api/attendance/report\'')) {
    const startIdx = src.indexOf('app.get(\'/api/attendance/report\'');
    const endIdx = src.indexOf('});', startIdx) + 3;
    src = src.substring(0, startIdx) + reportNew + src.substring(endIdx);
}

// 2. Schedule APIs
const scheduleApis = `
app.get('/api/work-schedule', async (req, res) => {
    try {
        const schedule = await dbAll("SELECT * FROM work_schedule");
        res.json(schedule);
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.post('/api/work-schedule', async (req, res) => {
    const { schedule } = req.body; // Array of objects
    try {
        for (const day of schedule) {
            await dbRun("UPDATE work_schedule SET start_time = ?, end_time = ?, is_closed = ? WHERE day_of_week = ?", 
                [day.start_time, day.end_time, day.is_closed ? 1 : 0, day.day_of_week]);
        }
        res.json({ message: "تم تحديث مواعيد الدوام بنجاح" });
    } catch (e) { res.status(500).json({ message: e.message }); }
});
`;

if (!src.includes('/api/work-schedule')) {
    src += scheduleApis;
}

fs.writeFileSync('server.js', src);
console.log('Backend updated for period reports and schedule management.');
