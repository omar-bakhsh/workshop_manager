const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath);
const logFile = path.join(__dirname, 'fix_db.log');

function log(msg) {
    fs.appendFileSync(logFile, msg + '\n');
    console.log(msg);
}

db.serialize(() => {
    log("Starting DB Fix...");
    
    // 1. Create inspection_technicians
    db.run(`CREATE TABLE IF NOT EXISTS inspection_technicians (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            inspection_id INTEGER NOT NULL,
            technician_id INTEGER NOT NULL,
            FOREIGN KEY (inspection_id) REFERENCES inspections(id),
            FOREIGN KEY (technician_id) REFERENCES employees(id)
        )`, (err) => {
            if(err) log("Error creating table: " + err.message);
            else log("Table inspection_technicians ensured.");
    });

    // 2. Add columns
    const cols = ['assigned_technician_id INTEGER', 'job_order_notes TEXT', 'car_defects_diagram TEXT', "status TEXT DEFAULT 'new'"];
    cols.forEach(col => {
        db.run(`ALTER TABLE inspections ADD COLUMN ${col}`, (err) => {
            if(err && !err.message.includes('duplicate column')) log("Error adding column " + col + ": " + err.message);
            else if(!err) log("Added column: " + col);
        });
    });
});

db.close(() => {
    log("DB Fix Complete");
});
