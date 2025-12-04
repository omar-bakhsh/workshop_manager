const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.all(`SELECT id, name, section_id, hide_income FROM employees WHERE name LIKE '%faris%'`, (err, rows) => {
        if (err) {
            console.error(err.message);
        } else {
            console.log(JSON.stringify(rows, null, 2));
        }
    });
});

db.close();
