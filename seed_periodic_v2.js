const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath);

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

async function seedBundles() {
    console.log('🌱 جاري تحديث باقات الصيانة الدورية...');

    const commonItems = [
        { name: "تلييس المقاعد والأرضيات", code: "I", cat: "عام" },
        { name: "أحزمة الأمان وأقفالها", code: "I", cat: "كشف" },
        { name: "الإنارة والمساحات والسوائل", code: "I", cat: "كشف" },
        { name: "السيور", code: "I", cat: "كشف" },
        { name: "زيت الماكينة", code: "R", cat: "مكانيكا" },
        { name: "فلتر زيت الماكينة", code: "R", cat: "مكانيكا" },
        { name: "نظام التبريد", code: "I", cat: "كشف" },
        { name: "مواسير البنزين", code: "I", cat: "كشف" },
        { name: "مستوى سائل البطارية", code: "I", cat: "كشف" },
        { name: "خطوط الفرامل والخراطيم", code: "I", cat: "كشف" },
        { name: "فرامل اليد", code: "I", cat: "كشف" },
        { name: "وحدة كبح معززة", code: "I", cat: "كشف" },
        { name: "هوبات وأقمشة الفرامل", code: "I", cat: "كشف" },
        { name: "عجلة القيادة", code: "I", cat: "كشف" },
        { name: "نظام التعليق", code: "I", cat: "كشف" },
        { name: "جلود العكوس", code: "I", cat: "كشف" },
        { name: "نظام العادم", code: "I", cat: "كشف" },
        { name: "الاطارات", code: "I", cat: "كشف" },
        { name: "منظف الرواسب (بخاخات)", code: "F", cat: "خدمة سريعة" },
        { name: "عكس الاطارات", code: "R", cat: "خدمة سريعة" }
    ];

    const getPrefix = (code) => {
        switch (code) {
            case 'I': return 'كشف على';
            case 'C': return 'تنظيف';
            case 'T': return 'تربيط';
            case 'R': return 'غيار';
            case 'F': return 'إضافة';
            default: return '';
        }
    };

    try {
        await dbRun('BEGIN TRANSACTION');

        // Delete existing periodic bundles to avoid duplicates/conflicts
        await dbRun("DELETE FROM inspection_bundles WHERE name LIKE 'صيانة % كم'");

        for (let km = 10000; km <= 160000; km += 10000) {
            let items = [...commonItems];

            // فلتر الهواء
            if (km % 20000 === 0) items.push({ name: "فلتر الهواء", code: "R", cat: "مكانيكا" });
            else items.push({ name: "فلتر الهواء", code: "C", cat: "خدمة سريعة" });

            // البواجي
            if (km % 60000 === 0) items.push({ name: "البواجي", code: "R", cat: "مكانيكا" });

            // سائل الفرامل
            if (km % 40000 === 0) items.push({ name: "سائل الفرامل", code: "R", cat: "مكانيكا" });
            else items.push({ name: "سائل الفرامل", code: "I", cat: "كشف" });

            // المزاليج والصواميل (تربيط)
            if (km % 20000 === 0) items.push({ name: "المزاليج والصواميل (أسفل السيارة)", code: "T", cat: "مكانيكا" });

            // فلتر المكيف
            if (km % 20000 === 0) items.push({ name: "فلتر المكيف", code: "R", cat: "تكييف" });

            // فلتر البنزين
            if (km % 60000 === 0) items.push({ name: "فلتر البنزين", code: "R", cat: "مكانيكا" });

            // Construct Bundle
            const bundleName = `صيانة ${km.toLocaleString()} كم`;
            const result = await dbRun("INSERT INTO inspection_bundles (name, icon) VALUES (?, ?)", [bundleName, "🚗"]);
            const bundleId = result.lastID;

            for (const item of items) {
                const desc = `${getPrefix(item.code)} ${item.name}`;
                await dbRun("INSERT INTO inspection_bundle_items (bundle_id, service_description, category) VALUES (?, ?, ?)",
                    [bundleId, desc, item.cat]);
            }
            console.log(`✅ تم إضافة ${bundleName}`);
        }

        await dbRun('COMMIT');
        console.log('🎉 تم تحديث جميع الباقات بنجاح');
    } catch (error) {
        await dbRun('ROLLBACK');
        console.error('❌ خطأ:', error);
    } finally {
        db.close();
    }
}

seedBundles();
