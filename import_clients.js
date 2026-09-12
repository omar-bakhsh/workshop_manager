const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, 'db.sqlite');
const excelPath = path.join(__dirname, 'CLIENTS NO.xls');

// Normalize Saudi phone numbers to '05xxxxxxxx' and international '966xxxxxxxxx'
function normalizePhone(rawPhone, rawIntl) {
    let p = String(rawPhone || '').trim().replace(/\D/g, '');
    let intl = String(rawIntl || '').trim().replace(/\D/g, '');

    // Handle common formats:
    // e.g. 500369668 (9 digits) -> 0500369668
    if (p.length === 9 && p.startsWith('5')) {
        p = '0' + p;
    } else if (p.length === 12 && p.startsWith('9665')) {
        p = '0' + p.substring(3);
    } else if (p.length === 10 && p.startsWith('05')) {
        // already good
    } else if (!p && intl) {
        if (intl.startsWith('9665') && intl.length === 12) {
            p = '0' + intl.substring(3);
        } else if (intl.length === 9 && intl.startsWith('5')) {
            p = '0' + intl;
        }
    }

    if (!intl && p.startsWith('05') && p.length === 10) {
        intl = '966' + p.substring(1);
    } else if (intl && !intl.startsWith('966') && intl.startsWith('5')) {
        intl = '966' + intl;
    }

    return { phone: p, intl_phone: intl };
}

async function importClients(filePath = excelPath) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(filePath)) {
            return reject(new Error(`File not found: ${filePath}`));
        }

        console.log(`Reading Excel file: ${filePath}...`);
        const wb = xlsx.readFile(filePath);
        const firstSheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[firstSheetName];
        const rawData = xlsx.utils.sheet_to_json(sheet);

        console.log(`Found ${rawData.length} rows in sheet "${firstSheetName}".`);

        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) return reject(err);
        });

        db.serialize(() => {
            // Create table & indices
            db.run(`
                CREATE TABLE IF NOT EXISTS clients (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    phone TEXT NOT NULL,
                    intl_phone TEXT,
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            db.run(`CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);`);

            // Deduplicate and clean rows
            const clientMap = new Map();

            for (const row of rawData) {
                // Determine column keys dynamically (supports Arabic and standard English)
                const nameKey = Object.keys(row).find(k => k.includes('اسم') || k.toLowerCase().includes('name'));
                const phoneKey = Object.keys(row).find(k => (k.includes('جوال') || k.includes('هاتف') || k.toLowerCase().includes('phone') || k.toLowerCase().includes('mobile')) && !k.includes('دولي'));
                const intlKey = Object.keys(row).find(k => k.includes('دولي') || k.toLowerCase().includes('intl'));

                const rawName = String(row[nameKey] || '').trim();
                const rawPhone = row[phoneKey];
                const rawIntl = row[intlKey];

                if (!rawPhone && !rawName) continue;

                const { phone, intl_phone } = normalizePhone(rawPhone, rawIntl);
                if (!phone && !rawName) continue;

                // Deduplicate by phone if valid, otherwise by name
                const dedupeKey = phone || ('name:' + rawName);

                if (!clientMap.has(dedupeKey)) {
                    clientMap.set(dedupeKey, {
                        name: rawName || 'عميل غير مسجل',
                        phone: phone || '',
                        intl_phone: intl_phone || ''
                    });
                } else {
                    // If we have an existing entry with same phone, pick the longer / cleaner name
                    const existing = clientMap.get(dedupeKey);
                    if (rawName && rawName.length > existing.name.length && existing.name === 'عميل غير مسجل') {
                        existing.name = rawName;
                    } else if (rawName && rawName.length > existing.name.length && !existing.name.includes(rawName)) {
                        existing.name = rawName;
                    }
                    if (!existing.intl_phone && intl_phone) {
                        existing.intl_phone = intl_phone;
                    }
                }
            }

            console.log(`Prepared ${clientMap.size} unique client records. Inserting into database...`);

            db.run('BEGIN TRANSACTION');

            // Optional: check if we should update or insert
            const stmt = db.prepare(`
                INSERT INTO clients (name, phone, intl_phone)
                VALUES (?, ?, ?)
            `);

            let count = 0;
            for (const client of clientMap.values()) {
                stmt.run(client.name, client.phone, client.intl_phone);
                count++;
            }

            stmt.finalize();

            db.run('COMMIT', (err) => {
                if (err) {
                    console.error('Error committing transaction:', err);
                    db.close();
                    return reject(err);
                }

                console.log(`Successfully imported ${count} clients into db.sqlite.`);
                db.close((closeErr) => {
                    if (closeErr) return reject(closeErr);
                    resolve({ totalRows: rawData.length, importedCount: count });
                });
            });
        });
    });
}

if (require.main === module) {
    importClients()
        .then(res => {
            console.log('Import finished successfully:', res);
            process.exit(0);
        })
        .catch(err => {
            console.error('Import failed:', err);
            process.exit(1);
        });
}

module.exports = { importClients, normalizePhone };
