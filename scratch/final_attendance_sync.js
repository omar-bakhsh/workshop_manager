const fs = require('fs');
let src = fs.readFileSync('server.js', 'utf8');

// 1. Correct the Shift Info mapping in the report query
const oldQueryPart = `(SELECT start_time || '-' || end_time FROM work_schedule WHERE day_of_week = strftime('%w', a.date)) as shift_info`;
const newQueryPart = `(SELECT CASE WHEN is_closed=1 THEN 'مغلق' ELSE start_time || '-' || end_time END FROM work_schedule WHERE day_of_week = 
            CASE strftime('%w', a.date) 
                WHEN '0' THEN 'Sunday' WHEN '1' THEN 'Monday' WHEN '2' THEN 'Tuesday' 
                WHEN '3' THEN 'Wednesday' WHEN '4' THEN 'Thursday' WHEN '5' THEN 'Friday' 
                WHEN '6' THEN 'Saturday' END) as shift_info`;

if (src.includes(oldQueryPart)) {
    src = src.replace(oldQueryPart, newQueryPart);
}

// 2. Update Check-in Logic to use dynamic schedule
const checkInNew = `// تسجيل دخول (Check-in)
app.post('/api/attendance/check-in', async (req, res) => {
    const { employee_id } = req.body;
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toISOString();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDayName = dayNames[now.getDay()];

    try {
        const schedule = await dbGet("SELECT * FROM work_schedule WHERE day_of_week = ?", [currentDayName]);
        if (schedule && schedule.is_closed) return res.status(400).json({ message: 'اليوم عطلة رسمية (مغلق)' });

        const existing = await dbGet('SELECT * FROM attendance WHERE employee_id = ? AND date = ?', [employee_id, date]);
        if (existing) return res.status(400).json({ message: 'تم تسجيل الحضور مسبقاً لهذا اليوم' });
        
        const startTimeStr = (schedule && schedule.start_time) || '08:00';
        const [h, m] = startTimeStr.split(':').map(Number);
        const workStartTime = new Date(now);
        workStartTime.setHours(h, m, 0, 0);

        let lateMinutes = 0;
        if (now > workStartTime) lateMinutes = Math.floor((now - workStartTime) / 60000);
        
        await dbRun("INSERT INTO attendance (employee_id, date, check_in, late_minutes) VALUES (?, ?, ?, ?)", [employee_id, date, time, lateMinutes]);
        res.json({ message: 'تم تسجيل الحضور بنجاح', time, lateMinutes });
    } catch (error) { res.status(500).json({ message: error.message }); }
});`;

const checkInOldStart = "// تسجيل دخول (Check-in)";
const checkInOldEnd = "    } catch (error) { res.status(500).json({ message: error.message }); }\r\n});";

const sIdx = src.indexOf(checkInOldStart);
const eIdx = src.indexOf(checkInOldEnd, sIdx) + checkInOldEnd.length;
if (sIdx !== -1 && eIdx !== -1) {
    src = src.substring(0, sIdx) + checkInNew + src.substring(eIdx);
}

// 3. Update Check-out Logic to use dynamic schedule
const checkOutNew = `// تسجيل خروج (Check-out)
app.post('/api/attendance/check-out', async (req, res) => {
    const { employee_id } = req.body;
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toISOString();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDayName = dayNames[now.getDay()];

    try {
        const schedule = await dbGet("SELECT * FROM work_schedule WHERE day_of_week = ?", [currentDayName]);
        const existing = await dbGet('SELECT * FROM attendance WHERE employee_id = ? AND date = ?', [employee_id, date]);
        if (!existing) return res.status(400).json({ message: 'يجب تسجيل الحضور أولاً' });
        if (existing.check_out) return res.status(400).json({ message: 'تم تسجيل الانصراف مسبقاً' });
        
        const endTimeStr = (schedule && schedule.end_time) || '17:00';
        const [h, m] = endTimeStr.split(':').map(Number);
        const workEndTime = new Date(now);
        workEndTime.setHours(h, m, 0, 0);

        const checkInTime = new Date(existing.check_in);
        const totalHours = ((now - checkInTime) / 3600000).toFixed(2);
        
        let overtimeMinutes = 0;
        if (now > workEndTime) overtimeMinutes = Math.floor((now - workEndTime) / 60000);
        
        let earlyLeavingMinutes = 0;
        if (now < workEndTime) earlyLeavingMinutes = Math.floor((workEndTime - now) / 60000);

        await dbRun("UPDATE attendance SET check_out = ?, overtime_minutes = ?, total_hours = ?, early_leaving_minutes = ? WHERE id = ?", 
            [time, overtimeMinutes, totalHours, earlyLeavingMinutes, existing.id]);
        res.json({ message: 'تم تسجيل الانصراف بنجاح', time, overtimeMinutes, totalHours });
    } catch (error) { res.status(500).json({ message: error.message }); }
});`;

// Replace check-out block
const checkOutOldStart = "app.post('/api/attendance/check-out'";
const csIdx = src.indexOf(checkOutOldStart);
const ceIdx = src.indexOf(checkInOldEnd, csIdx) + checkInOldEnd.length;
if (csIdx !== -1 && ceIdx !== -1) {
    src = src.substring(0, csIdx) + checkOutNew + src.substring(ceIdx);
}

fs.writeFileSync('server.js', src);
console.log('Server.js fully upgraded for dynamic work schedules and period reports.');
