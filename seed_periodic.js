const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath);

const periodicBundles = [];
for (let km = 10000; km <= 160000; km += 10000) {
    periodicBundles.push({
        name: `صيانة ${km.toLocaleString()} كم`,
        icon: "🚗",
        items: [
            { service: `فحص وصيانة ${km.toLocaleString()} كم`, category: "كشف" }
        ]
    });
}

db.serialize(() => {
    periodicBundles.forEach(b => {
        db.run("INSERT OR IGNORE INTO inspection_bundles (name, icon) VALUES (?, ?)", [b.name, b.icon], function (err) {
            if (err) {
                console.error(`Error inserting bundle ${b.name}:`, err.message);
                return;
            }
            if (this.changes > 0) {
                const bundleId = this.lastID;
                console.log(`Added bundle: ${b.name} (ID: ${bundleId})`);
                b.items.forEach(item => {
                    db.run("INSERT INTO inspection_bundle_items (bundle_id, service_description, category) VALUES (?, ?, ?)",
                        [bundleId, item.service, item.category]);
                });
            } else {
                console.log(`Bundle already exists: ${b.name}`);
            }
        });
    });
});

setTimeout(() => {
    db.close();
    console.log('Done!');
}, 2000);
