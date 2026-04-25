const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./db.sqlite');

const columns = [
    { name: 'target_amount', type: 'REAL DEFAULT 0' },
    { name: 'deposit_amount', type: 'REAL DEFAULT 0' },
    { name: 'total_withdrawals', type: 'REAL DEFAULT 0' }
];

db.serialize(() => {
    columns.forEach(col => {
        db.run(`ALTER TABLE employees ADD COLUMN ${col.name} ${col.type}`, (err) => {
            if (err) console.log(`Column ${col.name} error: ${err.message}`);
            else console.log(`Column ${col.name} added.`);
        });
    });
});
db.close();
