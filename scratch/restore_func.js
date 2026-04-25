const fs = require('fs');
let src = fs.readFileSync('admin.html', 'utf8');

const correctFunc = `
        async function loadAttendanceReport() {
            const startStr = document.getElementById('attendanceStartDate').value;
            const endStr = document.getElementById('attendanceEndDate').value;
            const monthStr = document.getElementById('attendanceMonthFilter').value;
            const employeeId = document.getElementById('attendanceEmployeeFilter').value;
            
            let url = \`/api/attendance/report?employee_id=\${employeeId}\`;
            if (startStr && endStr) url += \`&start_date=\${startStr}&end_date=\${endStr}\`;
            else if (monthStr) url += \`&month=\${monthStr}\`;

            try {
                const res = await fetch(url);
                const data = await res.json();
                const tbody = document.getElementById('attendanceTableBody');
                tbody.innerHTML = '';
                
                let stats = { absences: 0, lateMin: 0, overtimeMin: 0, earlyMin: 0 };

                data.forEach(item => {
                    const checkIn = item.check_in ? new Date(item.check_in).toLocaleTimeString('ar-SA', {hour:'2-digit', minute:'2-digit'}) : '---';
                    const checkOut = item.check_out ? new Date(item.check_out).toLocaleTimeString('ar-SA', {hour:'2-digit', minute:'2-digit'}) : '---';
                    
                    const shift = item.shift_info || '-';
                    const statusClass = item.check_out ? 'badge-success' : 'badge-warning';
                    const statusText = item.check_out ? 'انصرف' : 'نشط';

                    stats.lateMin += (item.late_minutes || 0);
                    stats.overtimeMin += (item.overtime_minutes || 0);
                    stats.earlyMin += (item.early_leaving_minutes || 0);

                    const tr = document.createElement('tr');
                    tr.innerHTML = \`
                        <td>\${item.date}</td>
                        <td>\${item.employee_name}</td>
                        <td>\${shift}</td>
                        <td>\${checkIn}</td>
                        <td>\${checkOut}</td>
                        <td style="color:\${item.late_minutes > 0 ? '#f59e0b' : 'inherit'}">\${item.late_minutes ? (item.late_minutes/60).toFixed(1)+'h' : '0'}</td>
                        <td style="color:\${item.early_leaving_minutes > 0 ? '#6366f1' : 'inherit'}">\${item.early_leaving_minutes ? (item.early_leaving_minutes/60).toFixed(1)+'h' : '0'}</td>
                        <td style="color:\${item.overtime_minutes > 0 ? '#10b981' : 'inherit'}">\${item.overtime_minutes ? (item.overtime_minutes/60).toFixed(1)+'h' : '0'}</td>
                        <td><span class="badge \${statusClass}">\${statusText}</span></td>
                    \`;
                    tbody.appendChild(tr);
                });

                document.getElementById('totalLateHours').textContent = (stats.lateMin / 60).toFixed(1) + 'h';
                document.getElementById('totalOvertimeHours').textContent = (stats.overtimeMin / 60).toFixed(1) + 'h';
                document.getElementById('totalEarlyLeavings').textContent = (stats.earlyMin / 60).toFixed(1) + 'h';
                document.getElementById('totalAbsences').textContent = stats.absences;

            } catch (e) { console.error(e); }
        }
`;

const insertPos = src.indexOf("function openAttendanceModal() {");
if (insertPos !== -1) {
    src = src.substring(0, insertPos) + correctFunc + "\n" + src.substring(insertPos);
    fs.writeFileSync('admin.html', src);
    console.log('Restored loadAttendanceReport');
} else {
    console.log('Insert parent not found');
}
