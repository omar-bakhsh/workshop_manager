const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Starting database migration...');

db.serialize(() => {
    // 1. Create absences table if it doesn't exist
    db.run(`CREATE TABLE IF NOT EXISTS absences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        date DATE NOT NULL,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id)
    )`, (err) => {
        if (err) console.error('Error creating absences table:', err.message);
        else console.log('✅ Absences table checked/created.');
    });

    // 2. Add columns to withdrawals table
    const columnsToAdd = [
        { name: 'status', type: "TEXT DEFAULT 'approved'" },
        { name: 'admin_note', type: "TEXT" },
        { name: 'date', type: "DATE DEFAULT CURRENT_DATE" }
    ];

    columnsToAdd.forEach(col => {
        db.run(`ALTER TABLE withdrawals ADD COLUMN ${col.name} ${col.type}`, (err) => {
            if (err) {
                if (err.message.includes('duplicate column name')) {
                    console.log(`ℹ️ Column ${col.name} already exists in withdrawals.`);
                } else {
                    console.error(`❌ Error adding column ${col.name}:`, err.message);
                }
            } else {
                console.log(`✅ Added column ${col.name} to withdrawals.`);
            }
        });
    });
});

db.close(() => {
    console.log('🏁 Migration completed.');
});
