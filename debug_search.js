
const fs = require('fs');
const util = require('util');
const logFile = fs.createWriteStream('debug_output.txt', { flags: 'w' });
const logStdout = process.stdout;

console.log = function () {
  logFile.write(util.format.apply(null, arguments) + '\n');
  logStdout.write(util.format.apply(null, arguments) + '\n');
}
console.error = function () {
  logFile.write(util.format.apply(null, arguments) + '\n');
  logStdout.write(util.format.apply(null, arguments) + '\n');
}

console.log("Debug script starting...");
try {
    const sqlite3 = require('sqlite3').verbose();
    const path = require('path');
    const dbPath = path.join(__dirname, 'db.sqlite');
    console.log("Opening DB at:", dbPath);
    
    if (!fs.existsSync(dbPath)) {
        console.error("DB File not found!");
        process.exit(1);
    }

    const db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error("Error opening DB:", err.message);
        } else {
            console.log("DB Opened successfully");
            runTest();
        }
    });

    function runTest() {
        const query = "1";
        // Attempting the exact query from server.js
        const sql = `
            SELECT i.*, e.name as inspector_name
            FROM inspections i
            LEFT JOIN employees e ON i.inspector_id = e.id
            WHERE CAST(i.id AS TEXT) LIKE ? 
            OR i.customer_phone LIKE ? 
            OR i.plate_number LIKE ?
            ORDER BY i.created_at DESC
            LIMIT 20
        `;
        const params = [`%${query}%`, `%${query}%`, `%${query}%`];

        console.log("Executing query...");
        db.all(sql, params, (err, rows) => {
            if (err) {
                console.error("❌ SQL Error:", err.message);
            } else {
                console.log("✅ Success! Rows found:", rows ? rows.length : 0);
            }
        });
    }

} catch (e) {
    console.error("Exception:", e);
}
