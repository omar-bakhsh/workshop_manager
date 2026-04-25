const fs = require('fs');
let src = fs.readFileSync('admin.html', 'utf8');

// The mess looks like this:
/*
1890:                 document.getElementById('totalAbsences').textContent = stats.absences;
1891: 
1892:             } catch (e) { console.error(e); }
1893:         }
*/

const mess = `                document.getElementById('totalAbsences').textContent = stats.absences;

            } catch (e) { console.error(e); }
        }`;

// We want to replace it with the REAL function at the RIGHT place or just remove this orphan.
// It seems this orphan is sitting inside another function or just in the middle of nowhere.
// Actually, it looks like it's BETWEEN quickEditBaseSalary and printAttendanceReport.

const orphanStart = src.indexOf("document.getElementById('totalAbsences').textContent = stats.absences;");
const orphanEnd = src.indexOf("}", orphanStart + 50) + 1;
const orphanFinalEnd = src.indexOf("}", orphanEnd + 1) + 1;

if (orphanStart !== -1) {
    src = src.substring(0, orphanStart) + "\n" + src.substring(orphanFinalEnd);
}

// Now ensure a CLEAN loadAttendanceReport exists once.
// I'll search for all "async function loadAttendanceReport" and remove them all except one.
const funcName = "async function loadAttendanceReport() {";
const parts = src.split(funcName);
if (parts.length > 2) {
    // Keep parts[0] and parts[parts.length-1] (the last one is likely the most complete one I added)
    // Actually, I'll just remove all of them and re-insert it at a known safe place (e.g. before printAttendanceReport).
    
    // I'll find the last closing brace of the previous function and insert there.
}

// SIMPLER: Replace the whole block between quickEditBaseSalary and printAttendanceReport
const startSearch = "async function quickEditBaseSalary";
const endSearch = "function printAttendanceReport";
const sIdx = src.indexOf(startSearch);
const eIdx = src.indexOf(endSearch);

if (sIdx !== -1 && eIdx !== -1) {
    const replacement = `async function quickEditBaseSalary(empId, empName, currentSalary) {
            const newSalary = prompt(\`تعديل الراتب الأساسي للموظف: \${empName}\`, currentSalary);
            if (!newSalary || isNaN(newSalary)) return;
            try {
                const emp = employees.find(e => e.id === empId);
                const res = await fetch(\`/api/employees/\${empId}\`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...emp, base_salary: parseInt(newSalary) })
                });
                if (res.ok) { alert('تم تحديث الراتب بنجاح'); loadData(); } else { alert('فشل في تحديث الراتب'); }
            } catch (e) { console.error(e); alert('خطأ في الاتصال بالخادم'); }
        }

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
    src = src.substring(0, sIdx) + replacement + src.substring(eIdx);
}

fs.writeFileSync('admin.html', src);
console.log('Cleanup complete');
