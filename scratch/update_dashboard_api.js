const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const oldResponse = `            res.json({
                info,
                total_income: totalIncomeRow.total_income,
                total_withdrawal: totalWithdrawalRow.total_withdrawal,
                entries,
                withdrawals,
                absences,
                income_hidden: false
            });`;

const newResponse = `            res.json({
                info,
                total_income: totalIncomeRow.total_income,
                total_withdrawal: totalWithdrawalRow.total_withdrawal,
                last_income_at: entries.length > 0 ? entries[0].created_at : null,
                last_withdrawal_at: withdrawals.length > 0 ? withdrawals[0].created_at : null,
                entries,
                withdrawals,
                absences,
                income_hidden: false
            });`;

if (content.includes(oldResponse)) {
    content = content.replace(oldResponse, newResponse);
    fs.writeFileSync('server.js', content, 'utf8');
    console.log("✅ تم تحديث السيرفر لإرسال تواريخ التحديث!");
} else {
    // محاولة البحث عن جزء أصغر
    const oldBrief = 'total_withdrawal: totalWithdrawalRow.total_withdrawal,';
    if (content.includes(oldBrief)) {
        content = content.replace(oldBrief, 'total_withdrawal: totalWithdrawalRow.total_withdrawal,\n                last_income_at: entries.length > 0 ? entries[0].created_at : null,\n                last_withdrawal_at: withdrawals.length > 0 ? withdrawals[0].created_at : null,');
        fs.writeFileSync('server.js', content, 'utf8');
        console.log("✅ تم التحديث باستخدام الطريقة المختصرة!");
    } else {
        console.log("❌ فشل العثور على مكان التعديل.");
    }
}
