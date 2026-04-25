const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db.sqlite');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS work_schedule (
        id INTEGER PRIMARY KEY,
        day_of_week TEXT UNIQUE,
        start_time TEXT,
        end_time TEXT,
        is_closed INTEGER DEFAULT 0
    )`);

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    days.forEach(day => {
        const start = day === 'Friday' ? '' : '08:30';
        const end = day === 'Friday' ? '' : '17:30';
        const closed = day === 'Friday' ? 1 : 0;
        db.run("INSERT OR IGNORE INTO work_schedule (day_of_week, start_time, end_time, is_closed) VALUES (?, ?, ?, ?)", [day, start, end, closed]);
    });
});
db.close();
console.log("Work Schedule table initialized.");
