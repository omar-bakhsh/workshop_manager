const fs = require('fs');
let src = fs.readFileSync('server.js', 'utf8');

// 1. Update Check-out to include early leaving
const checkOutOld = `        await dbRun("UPDATE attendance SET check_out = ?, overtime_minutes = ?, total_hours = ? WHERE id = ?", [time, overtimeMinutes, totalHours, existing.id]);`;
const checkOutNew = `        let earlyLeavingMinutes = 0;
        if (now < workEndTime) {
            earlyLeavingMinutes = Math.floor((workEndTime - now) / 60000);
        }
        await dbRun("UPDATE attendance SET check_out = ?, overtime_minutes = ?, total_hours = ?, early_leaving_minutes = ? WHERE id = ?", 
            [time, overtimeMinutes, totalHours, earlyLeavingMinutes, existing.id]);`;

if (src.includes(checkOutOld)) {
    src = src.replace(checkOutOld, checkOutNew);
}

// 2. Update Attendance Report API to support Month and Employee filters
const reportOld = `app.get('/api/attendance/report', async (req, res) => {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    try {
        const report = await dbAll(\`
            SELECT a.*, e.name as employee_name, s.name as section_name
            FROM attendance a
            JOIN employees e ON a.employee_id = e.id
            JOIN sections s ON e.section_id = s.id
            WHERE a.date = ?
        \`, [targetDate]);
        res.json(report);
    } catch (error) { res.status(500).json({ message: error.message }); }
});`;

const reportNew = `app.get('/api/attendance/report', async (req, res) => {
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

if (src.includes('app.get(\'/api/attendance/report\'')) {
    // Replace the block from app.get to the closing });
    const startIdx = src.indexOf('app.get(\'/api/attendance/report\'');
    const endIdx = src.indexOf('});', startIdx) + 3;
    src = src.substring(0, startIdx) + reportNew + src.substring(endIdx);
}

fs.writeFileSync('server.js', src);
console.log('Server.js updated for advanced reporting');
