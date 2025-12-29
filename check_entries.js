const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath);

const empId = process.argv[2];

if (!empId) {
    console.log('Please provide employee ID');
    process.exit(1);
}

db.all('SELECT * FROM entries WHERE employee_id = ?', [empId], (err, rows) => {
    if (err) {
        console.error(err);
    } else {
        console.log(`Entries for employee ${empId}:`, rows);
    }
    db.close();
});
