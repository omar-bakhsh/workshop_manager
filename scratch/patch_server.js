const fs = require('fs');
let src = fs.readFileSync('server.js', 'utf8');

const startMarker = '// تسجيل دخول (Check-in)';
const endMarker = '    } catch (error) {\r\n        console.error("Check-out Error:", error);\r\n        res.status(500).json({ message: "خطأ في تسجيل الانصراف" });\r\n    }\r\n});';

const startIndex = src.indexOf(startMarker);
if (startIndex !== -1) {
    const replacement = `// تسجيل دخول (Check-in)
app.post('/api/attendance/check-in', async (req, res) => {
    const { employee_id } = req.body;
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toISOString();
    try {
        const existing = await dbGet('SELECT * FROM attendance WHERE employee_id = ? AND date = ?', [employee_id, date]);
        if (existing) return res.status(400).json({ message: 'تم تسجيل الحضور مسبقاً لهذا اليوم' });
        const config = await dbAll("SELECT key, value FROM settings WHERE key IN ('work_start_time')");
        const startTimeStr = config.find(c => c.key === 'work_start_time')?.value || '08:00';
        const [h, m] = startTimeStr.split(':').map(Number);
        const workStartTime = new Date(now);
        workStartTime.setHours(h, m, 0, 0);
        let lateMinutes = 0;
        if (now > workStartTime) lateMinutes = Math.floor((now - workStartTime) / 60000);
        await dbRun("INSERT INTO attendance (employee_id, date, check_in, late_minutes) VALUES (?, ?, ?, ?)", [employee_id, date, time, lateMinutes]);
        res.json({ message: 'تم تسجيل الحضور بنجاح', time, lateMinutes });
    } catch (error) { res.status(500).json({ message: error.message }); }
});

app.post('/api/attendance/check-out', async (req, res) => {
    const { employee_id } = req.body;
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toISOString();
    try {
        const existing = await dbGet('SELECT * FROM attendance WHERE employee_id = ? AND date = ?', [employee_id, date]);
        if (!existing) return res.status(400).json({ message: 'يجب تسجيل الحضور أولاً' });
        if (existing.check_out) return res.status(400).json({ message: 'تم تسجيل الانصراف مسبقاً' });
        const config = await dbAll("SELECT key, value FROM settings WHERE key IN ('work_end_time')");
        const endTimeStr = config.find(c => c.key === 'work_end_time')?.value || '17:00';
        const [h, m] = endTimeStr.split(':').map(Number);
        const workEndTime = new Date(now);
        workEndTime.setHours(h, m, 0, 0);
        const checkInTime = new Date(existing.check_in);
        const totalHours = ((now - checkInTime) / 3600000).toFixed(2);
        let overtimeMinutes = 0;
        if (now > workEndTime) overtimeMinutes = Math.floor((now - workEndTime) / 60000);
        await dbRun("UPDATE attendance SET check_out = ?, overtime_minutes = ?, total_hours = ? WHERE id = ?", [time, overtimeMinutes, totalHours, existing.id]);
        res.json({ message: 'تم تسجيل الانصراف بنجاح', time, overtimeMinutes, totalHours });
    } catch (error) { res.status(500).json({ message: error.message }); }
});`;

    const endMarkerPos = src.indexOf(endMarker, startIndex);
    if (endMarkerPos !== -1) {
        const finalContent = src.substring(0, startIndex) + replacement + src.substring(endMarkerPos + endMarker.length);
        fs.writeFileSync('server.js', finalContent);
        console.log('Successfully updated server.js');
    } else {
        // Try without \r
        const endMarkerAlt = endMarker.replace(/\r/g, '');
        const endMarkerPosAlt = src.indexOf(endMarkerAlt, startIndex);
        if (endMarkerPosAlt !== -1) {
             const finalContent = src.substring(0, startIndex) + replacement + src.substring(endMarkerPosAlt + endMarkerAlt.length);
             fs.writeFileSync('server.js', finalContent);
             console.log('Successfully updated server.js (LF)');
        } else {
            console.log('End marker not found');
        }
    }
} else {
    console.log('Start marker not found');
}
