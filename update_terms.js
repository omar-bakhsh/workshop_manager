const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./workshop.db');

const newTerms = [
    "يتم دفع كامل المبلغ قبل استلام السيارة.",
    "في حالة احتياج قطع غيار يبلغ صاحبها بما يحتاج ويعطى مهلة 5 أيام لتأمين القطع، وفي حال التأخير أو عدم استلام السيارة الجاهزة لأكثر من 3 أيام فالمركز غير مسؤول عن السيارة.",
    "المركز لا يتحمل مسؤولية تغيير زيت الجربكس أو تزويد (لا يوجد ضمان).",
    "المركز غير مسؤول عن القطع المستبدلة التي تترك في المركز لأكثر من 3 أيام.",
    "المركز غير مسؤول عن الأعطال التي تظهر ولم يتم الاتفاق على إصلاحها.",
    "المركز غير مسؤول عن كشف السيارة بعد 7 أيام من تاريخ الكشف.",
    "إقرار: أقر بأنني موافق على الإصلاحات والشروط والأجرة المذكورة، وعلى ذلك جرى التوقيع."
];

db.serialize(() => {
    // Clear old terms
    db.run("DELETE FROM inspection_terms", (err) => {
        if (err) {
            console.error("Error clearing terms:", err);
            return;
        }
        console.log("Cleared old terms.");

        // Insert new terms
        const stmt = db.prepare("INSERT INTO inspection_terms (term) VALUES (?)");
        newTerms.forEach(term => {
            stmt.run(term, (err) => {
                if (err) console.error("Error inserting term:", err);
            });
        });
        stmt.finalize(() => {
            console.log("✅ New terms updated successfully.");
            db.close();
        });
    });
});
