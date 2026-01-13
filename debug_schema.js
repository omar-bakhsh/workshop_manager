
const fs = require('fs');
const util = require('util');
const logFile = fs.createWriteStream('debug_schema.txt', { flags: 'w' });
const logStdout = process.stdout;

console.log = function () {
  logFile.write(util.format.apply(null, arguments) + '\n');
  logStdout.write(util.format.apply(null, arguments) + '\n');
}

console.log("Checking Schema...");
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath);

db.all("PRAGMA table_info(inspections)", (err, rows) => {
    if (err) {
        console.error("Error:", err);
    } else {
        console.log("Columns in 'inspections':");
        rows.forEach(r => console.log(`- ${r.name} (${r.type})`));
    }
});
