const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log("Checking tables...");
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
        if (err) console.error(err);
        else console.log("Tables:", tables.map(t => t.name));
    });

    console.log("Checking inspections columns...");
    db.all("PRAGMA table_info(inspections)", (err, cols) => {
        if (err) console.error(err);
        else console.log("Inspections Columns:", cols.map(c => c.name));
    });
    
    console.log("Checking inspection_technicians...");
    db.all("SELECT * FROM inspection_technicians LIMIT 1", (err, rows) => {
        if (err) console.log("inspection_technicians query error (Table might be missing):", err.message);
        else console.log("inspection_technicians OK");
    });
});

db.close();
