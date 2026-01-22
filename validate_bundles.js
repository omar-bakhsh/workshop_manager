const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath);

db.get("SELECT id FROM inspection_bundles WHERE name = 'صيانة 10,000 كم'", (err, bundle) => {
    if (err) {
        console.error(err);
        return;
    }
    if (bundle) {
        console.log(`Bundle ID: ${bundle.id}`);
        db.all("SELECT service_description FROM inspection_bundle_items WHERE bundle_id = ?", [bundle.id], (err, items) => {
            if (err) console.error(err);
            else {
                console.log('Items:');
                items.forEach(i => console.log(`- ${i.service_description}`));
            }
            db.close();
        });
    } else {
        console.log('Bundle not found');
        db.close();
    }
});
