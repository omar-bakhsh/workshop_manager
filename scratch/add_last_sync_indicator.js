const fs = require('fs');

// 1. إضافة عمود last_sync_at في السيرفر وتحديثه عند المزامنة
let serverContent = fs.readFileSync('server.js', 'utf8');

// إضافة العمود في الاستعلام
if (serverContent.includes('e.net_remaining,')) {
    serverContent = serverContent.replace('e.net_remaining,', 'e.net_remaining, e.last_sync_at,');
}

// تحديث العمود عند المزامنة
const syncUpdateLine = 'remaining_salary = ?, net_remaining = ?';
const newSyncUpdateLine = 'remaining_salary = ?, net_remaining = ?, last_sync_at = CURRENT_TIMESTAMP';

if (serverContent.includes(syncUpdateLine)) {
    serverContent = serverContent.split(syncUpdateLine).join(newSyncUpdateLine);
}

fs.writeFileSync('server.js', serverContent, 'utf8');


// 2. تحديث admin.html لإظهار وقت المزامنة
let adminContent = fs.readFileSync('admin.html', 'utf8');

const oldNameCell = '<td style="font-weight:700;">${emp.name}</td>';
const newNameCell = `<td style="font-weight:700;">
                                        \${emp.name}
                                        <div style="font-size:10px; color:#94a3b8; font-weight:400; margin-top:2px;">
                                            \${emp.last_sync_at ? '🔄 ' + new Date(emp.last_sync_at).toLocaleString('ar-SA', {hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit'}) : 'لم تتم المزامنة'}
                                        </div>
                                    </td>`;

if (adminContent.includes(oldNameCell)) {
    adminContent = adminContent.replace(oldNameCell, newNameCell);
}

fs.writeFileSync('admin.html', adminContent, 'utf8');

console.log("✅ تمت إضافة مؤشر المزامنة وتحسين واجهة الإدارة!");
