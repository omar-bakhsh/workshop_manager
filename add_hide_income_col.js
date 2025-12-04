const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log("🚀 Starting Database Migration...");

    db.run(`ALTER TABLE employees ADD COLUMN hide_income INTEGER DEFAULT 0`, function (err) {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log("⚠️ Column 'hide_income' already exists.");
            } else {
                console.error("❌ Error adding column:", err.message);
            }
        } else {
            console.log("✅ Column 'hide_income' added successfully.");
        }
    });
});

db.close(() => {
    console.log("🏁 Migration finished.");
});
