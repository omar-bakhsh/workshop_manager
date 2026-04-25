const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db.sqlite');

const migrations = [
    // 1. Add 'payment_method' to withdrawals
    "ALTER TABLE withdrawals ADD COLUMN payment_method TEXT DEFAULT 'cash'",
    
    // 2. Add attendance details
    "ALTER TABLE attendance ADD COLUMN late_minutes INTEGER DEFAULT 0",
    "ALTER TABLE attendance ADD COLUMN overtime_minutes INTEGER DEFAULT 0",
    "ALTER TABLE attendance ADD COLUMN total_hours REAL DEFAULT 0",
    
    // 3. Add workspace shift settings
    "INSERT OR IGNORE INTO settings (key, value) VALUES ('work_start_time', '08:00')",
    "INSERT OR IGNORE INTO settings (key, value) VALUES ('work_end_time', '17:00')",
    "INSERT OR IGNORE INTO settings (key, value) VALUES ('overtime_rate', '1.5')"
];

db.serialize(() => {
    migrations.forEach(sql => {
        db.run(sql, (err) => {
            if (err) console.log(`Migration error (${sql.substring(0,20)}...): ${err.message}`);
            else console.log(`Migration success: ${sql.substring(0,30)}`);
        });
    });
});

db.close();
