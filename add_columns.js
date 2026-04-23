const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./workshop.db');

const columnsToAdd = [
    { name: 'status', type: 'TEXT DEFAULT "new"' },
    { name: 'job_order_notes', type: 'TEXT' },
    { name: 'car_defects_diagram', type: 'TEXT' }
];

db.serialize(() => {
    columnsToAdd.forEach(col => {
        db.run(`ALTER TABLE inspections ADD COLUMN ${col.name} ${col.type}`, (err) => {
            if (err && err.message.includes('duplicate column name')) {
                console.log(`✅ Column ${col.name} already exists.`);
            } else if (err) {
                console.error(`❌ Error adding ${col.name}:`, err.message);
            } else {
                console.log(`✅ Added column ${col.name}`);
            }
        });
    });
});

db.close();
