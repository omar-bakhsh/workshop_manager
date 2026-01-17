const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./workshop.db');

db.all("SELECT * FROM inspection_terms", (err, rows) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log("Current Terms in DB:");
    rows.forEach(r => console.log(`- ${r.term}`));
    db.close();
});
