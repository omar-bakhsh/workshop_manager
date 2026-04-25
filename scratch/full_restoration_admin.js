const fs = require('fs');
let src = fs.readFileSync('admin.html', 'utf8');

const scriptStartTag = "<script>";
const scriptEndTag = "</script>";
const sIdx = src.lastIndexOf(scriptStartTag);
const eIdx = src.lastIndexOf(scriptEndTag);

if (sIdx !== -1 && eIdx !== -1) {
    const existingScript = src.substring(sIdx + scriptStartTag.length, eIdx);
    
    const missingFunctions = `
        function openModal(id) {
            document.getElementById(id).style.display = 'flex';
            if (id === 'attendanceModal') {
                const now = new Date();
                document.getElementById('attendanceMonthFilter').value = now.toISOString().substring(0, 7);
                
                const select = document.getElementById('attendanceEmployeeFilter');
                if (select) {
                    select.innerHTML = '<option value="all">جميع الموظفين</option>';
                    employees.forEach(e => {
                        select.innerHTML += \\\`<option value="\${e.id}">\${e.name}</option>\\\`;
                    });
                }
                loadAttendanceReport();
            }
        }

        function closeModal(id) {
            document.getElementById(id).style.display = 'none';
        }

        function openAttendanceModal() {
            openModal('attendanceModal');
        }

        async function loadAttendanceReport() {
            const startStr = document.getElementById('attendanceStartDate').value;
            const endStr = document.getElementById('attendanceEndDate').value;
            const monthStr = document.getElementById('attendanceMonthFilter').value;
            const employeeId = document.getElementById('attendanceEmployeeFilter').value;
            
            let url = \\\`/api/attendance/report?employee_id=\${employeeId}\\\`;
            if (startStr && endStr) url += \\\`&start_date=\${startStr}&end_date=\${endStr}\\\`;
            else if (monthStr) url += \\\`&month=\${monthStr}\\\`;

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
                    const statusText = item.check_out ? 'انصراف' : 'نشط';

                    stats.lateMin += (item.late_minutes || 0);
                    stats.overtimeMin += (item.overtime_minutes || 0);
                    stats.earlyMin += (item.early_leaving_minutes || 0);

                    const tr = document.createElement('tr');
                    tr.innerHTML = \\\`
                        <td>\${item.date}</td>
                        <td>\${item.employee_name}</td>
                        <td>\${shift}</td>
                        <td>\${checkIn}</td>
                        <td>\${checkOut}</td>
                        <td style="color:\${item.late_minutes > 0 ? '#f59e0b' : 'inherit'}">\${item.late_minutes ? (item.late_minutes/60).toFixed(1)+'h' : '0'}</td>
                        <td style="color:\${item.early_leaving_minutes > 0 ? '#6366f1' : 'inherit'}">\${item.early_leaving_minutes ? (item.early_leaving_minutes/60).toFixed(1)+'h' : '0'}</td>
                        <td style="color:\${item.overtime_minutes > 0 ? '#10b981' : 'inherit'}">\${item.overtime_minutes ? (item.overtime_minutes/60).toFixed(1)+'h' : '0'}</td>
                        <td><span class="badge \${statusClass}">\${statusText}</span></td>
                    \\\`;
                    tbody.appendChild(tr);
                });

                document.getElementById('totalLateHours').textContent = (stats.lateMin / 60).toFixed(1) + 'h';
                document.getElementById('totalOvertimeHours').textContent = (stats.overtimeMin / 60).toFixed(1) + 'h';
                document.getElementById('totalEarlyLeavings').textContent = (stats.earlyMin / 60).toFixed(1) + 'h';
                document.getElementById('totalAbsences').textContent = stats.absences;

            } catch (e) { console.error(e); }
        }

        function printAttendanceReport() {
            const printWindow = window.open('', '_blank');
            const table = document.getElementById('attendanceTable').cloneNode(true);
            const kpis = document.querySelector('#attendanceModal .modal-body > div').cloneNode(true);
            
            printWindow.document.write(\\\`
                <html dir="rtl" lang="ar">
                <head>
                    <title>تقرير الحضور والانصراف</title>
                    <style>
                        body { font-family: 'Cairo', sans-serif; padding: 30px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 30px; }
                        th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: center; }
                        th { background: #f8fafc; }
                        .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; }
                        .badge-success { background: #dcfce7; color: #15803d; }
                        .badge-warning { background: #fef9c3; color: #a16207; }
                        h1 { text-align: center; margin-bottom: 20px; }
                        .kpi-row { display: flex; gap: 20px; justify-content: space-around; margin-bottom: 30px; }
                        .kpi-card { border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; text-align: center; flex: 1; }
                    </style>
                </head>
                <body>
                    <h1>📊 تقرير الحضور والانصراف - مركز Mazda</h1>
                    <div class="kpi-row">\${kpis.innerHTML}</div>
                    \${table.outerHTML}
                </body>
                </html>
            \\\`);
            printWindow.document.close();
            setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
        }

        function openIncomeModal(empId) {
            document.getElementById('incomeEmpId').value = empId;
            openModal('addIncomeModal');
        }

        function openWithdrawalModal(empId) {
            document.getElementById('withdrawalEmpId').value = empId;
            openModal('addWithdrawalModal');
        }

        function openEditModal(empId) {
            const emp = employees.find(e => e.id === empId);
            if (!emp) return;
            document.getElementById('editEmpId').value = emp.id;
            document.getElementById('editEmpName').value = emp.name;
            document.getElementById('editEmpSection').value = emp.section_id;
            document.getElementById('editEmpTarget').value = emp.target;
            document.getElementById('editEmpSalary').value = emp.base_salary;
            openModal('editEmployeeModal');
        }

        async function handleAddEmployee(e) {
            e.preventDefault();
            const payload = {
                name: document.getElementById('empName').value,
                section_id: parseInt(document.getElementById('empSection').value),
                target: parseInt(document.getElementById('empTarget').value),
                base_salary: parseInt(document.getElementById('empSalary').value)
            };
            try {
                const res = await fetch('/api/employees', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) { alert('تم الإضافة بنجاح'); closeModal('addEmployeeModal'); loadData(); e.target.reset(); }
            } catch { alert('خطأ في الاتصال'); }
        }

        async function handleEditEmployee(e) {
            e.preventDefault();
            const id = document.getElementById('editEmpId').value;
            const payload = {
                name: document.getElementById('editEmpName').value,
                section_id: parseInt(document.getElementById('editEmpSection').value),
                target: parseInt(document.getElementById('editEmpTarget').value),
                base_salary: parseInt(document.getElementById('editEmpSalary').value)
            };
            try {
                const res = await fetch(\\\`/api/employees/\${id}\\\`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) { alert('تم التحديث بنجاح'); closeModal('editEmployeeModal'); loadData(); }
            } catch { alert('خطأ في الاتصال'); }
        }

        async function handleAddIncome(e) {
            e.preventDefault();
            const empId = document.getElementById('incomeEmpId').value;
            const payload = {
                employee_id: parseInt(empId),
                income: parseInt(document.getElementById('incomeAmount').value),
                details: document.getElementById('incomeDetails').value
            };
            try {
                const res = await fetch('/api/entries', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) { alert('تم تسجيل الدخل'); closeModal('addIncomeModal'); loadData(); e.target.reset(); }
            } catch { alert('خطأ في الاتصال'); }
        }

        async function handleAddWithdrawal(e) {
            e.preventDefault();
            const empId = document.getElementById('withdrawalEmpId').value;
            const payload = {
                employee_id: parseInt(empId),
                amount: parseInt(document.getElementById('withdrawalAmount').value),
                reason: document.getElementById('withdrawalReason').value,
                payment_method: document.getElementById('withdrawalPaymentMethod').value
            };
            try {
                const res = await fetch('/api/withdrawals', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) { alert('تم تسجيل السحب'); closeModal('addWithdrawalModal'); loadData(); e.target.reset(); }
            } catch { alert('خطأ في الاتصال'); }
        }
    `;

    // Insert before init() call at the end
    const initCall = "init();";
    const insertPos = existingScript.indexOf(initCall);
    if (insertPos !== -1) {
        const newScript = existingScript.substring(0, insertPos) + missingFunctions + "\n" + existingScript.substring(insertPos);
        src = src.substring(0, sIdx + scriptStartTag.length) + newScript + src.substring(eIdx);
        fs.writeFileSync('admin.html', src);
        console.log('Restoration complete');
    } else {
        console.log('init() not found, appending to end of script');
        const newScript = existingScript + missingFunctions + "\n" + "init();";
        src = src.substring(0, sIdx + scriptStartTag.length) + newScript + src.substring(eIdx);
        fs.writeFileSync('admin.html', src);
    }
}
