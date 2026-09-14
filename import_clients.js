const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { dbRun, dbGet, dbAll, initDatabase } = require('./db');

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
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    console.log(`Reading Excel file: ${filePath}...`);
    const wb = xlsx.readFile(filePath);
    const firstSheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[firstSheetName];
    const rawData = xlsx.utils.sheet_to_json(sheet);

    console.log(`Found ${rawData.length} rows in sheet "${firstSheetName}".`);

    // Ensure database structure is ready
    await initDatabase();

    // Deduplicate and clean rows
    const clientMap = new Map();

    for (const row of rawData) {
        const nameKey = Object.keys(row).find(k => k.includes('اسم') || k.toLowerCase().includes('name'));
        const phoneKey = Object.keys(row).find(k => (k.includes('جوال') || k.includes('هاتف') || k.toLowerCase().includes('phone') || k.toLowerCase().includes('mobile')) && !k.includes('دولي'));
        const intlKey = Object.keys(row).find(k => k.includes('دولي') || k.toLowerCase().includes('intl'));

        const rawName = String(row[nameKey] || '').trim();
        const rawPhone = row[phoneKey];
        const rawIntl = row[intlKey];

        if (!rawPhone && !rawName) continue;

        const { phone, intl_phone } = normalizePhone(rawPhone, rawIntl);
        if (!phone && !rawName) continue;

        const dedupeKey = phone || ('name:' + rawName);

        if (!clientMap.has(dedupeKey)) {
            clientMap.set(dedupeKey, {
                name: rawName || 'عميل غير مسجل',
                phone: phone || '',
                intl_phone: intl_phone || ''
            });
        } else {
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

    let count = 0;
    for (const client of clientMap.values()) {
        try {
            await dbRun(`INSERT INTO clients (name, phone, intl_phone) VALUES (?, ?, ?)`,
                [client.name, client.phone, client.intl_phone]);
            count++;
        } catch (insertErr) {
            console.warn(`Could not insert client ${client.phone}:`, insertErr.message);
        }
    }

    console.log(`Successfully imported ${count} clients into database.`);
    return { totalRows: rawData.length, importedCount: count };
}

// Standalone execution: node import_clients.js [optional_excel_path]
if (require.main === module) {
    const customPath = process.argv[2] ? path.resolve(process.argv[2]) : excelPath;
    importClients(customPath)
        .then(res => {
            console.log('✅ Import complete:', res);
            process.exit(0);
        })
        .catch(err => {
            console.error('❌ Import failed:', err);
            process.exit(1);
        });
}

module.exports = {
    importClients,
    normalizePhone
};
