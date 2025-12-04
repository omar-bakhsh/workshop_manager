const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log("--- Users ---");
    db.all("SELECT * FROM users", (err, rows) => {
        if (err) console.error(err);
        else console.table(rows);
    });

    console.log("--- Employees ---");
    db.all("SELECT * FROM employees", (err, rows) => {
        if (err) console.error(err);
        else console.table(rows);
    });
});

db.close();
