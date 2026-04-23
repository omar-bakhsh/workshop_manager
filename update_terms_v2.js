const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./workshop.db');

const newTerms = [
    "يتم دفع كامل المبلغ قبل استلام السيارة.",
    "في حالة احتياج لقطع الغيار يبلغ صاحبها بما يحتاج ويعطي مهلة خمسة أيام لتأمين القطع، وفي حالة تأخره عن تأمين القطع أو في حالة تم تجهيز السيارة ولم يستلمها العميل لأكثر من 3 أيام فإن المركز غير مسؤول عن السيارة أو عن أي مخالفات تصدر عليها.",
    "المركز لا يتحمل مسؤولية تغيير زيت الجيربكس أو تزويد ((لا يوجد ضمان)).",
    "المركز غير مسؤول عن القطع التي تم تغييرها وتركها في المركز عن مدة تزيد عن 3 أيام.",
    "المركز غير مسؤول عن الأعطال التي تظهر والتي لم يتم الاتفاق على إصلاحها.",
    "المركز غير مسؤول عن كشف السيارة بعد 7 أيام من تاريخ الكشف."
];

db.serialize(() => {
    // Clear old terms
    db.run("DELETE FROM inspection_terms", (err) => {
        if (err) {
            console.error("Error clearing terms:", err);
            return;
        }
        
        const stmt = db.prepare("INSERT INTO inspection_terms (term) VALUES (?)");
        newTerms.forEach(term => {
            stmt.run(term);
        });
        stmt.finalize(() => {
            console.log("✅ Terms updated successfully.");
            db.close();
        });
    });
});
