/**
 * 💼 Workshop Manager - Admin Dashboard Logic
 * Modularized and optimized for performance & maintainability.
 */

// ==========================================
// 📊 Global State
// ==========================================
let employees = [];
let sections = [];
let charts = {};
let unreadCounts = {};

// ==========================================
// 🚀 Application Core Init
// ==========================================
async function init() {
    checkAuth();
    setupEventListeners();
    updateDateHeader();
    
    // Initial Data Fetch
    await loadData();
    
    // Initial Component Loads
    checkNotifications();
    loadPendingRequests();
    loadAdminInspectionStats();
    checkUnreadMessages();

    // Load Global Settings
    try {
        const settings = await fetch('/api/settings').then(r => r.json());
        if (settings.max_withdrawal_limit) {
            document.getElementById('globalMaxLimit').value = settings.max_withdrawal_limit;
        }
    } catch(e) { console.warn('Settings load error:', e); }
    
    // Dynamic Polling (Every 30s)
    setInterval(() => {
        checkNotifications();
        loadPendingRequests();
        loadAdminInspectionStats();
        checkUnreadMessages();
        updateDateHeader();
    }, 30000); 
}

// ==========================================
// 🔐 Auth & Navigation
// ==========================================
function checkAuth() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || user.role !== 'admin') window.location.href = 'login.html';
}

function logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = 'login.html';
}

function showView(viewId) {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const clickedItem = Array.from(document.querySelectorAll('.nav-item')).find(item => item.getAttribute('onclick')?.includes(viewId));
    if (clickedItem) clickedItem.classList.add('active');
    
    if (viewId === 'overview') loadData();
}

// ==========================================
// 📡 Data Synchronization
// ==========================================
async function loadData() {
    const container = document.getElementById('sectionsContainer');
    try {
        const [empRes, secRes] = await Promise.all([
            fetch('/api/employees'),
            fetch('/api/sections')
        ]);
        employees = await empRes.json();
        sections = await secRes.json();

        renderSections();
        updateSectionSelects();
        updateDashboardKPIs();
    } catch (err) {
        console.error('Data Load Error:', err);
        if(container) container.innerHTML = '<div class="error">❌ فشل في تحميل البيانات</div>';
    }
}

function updateDashboardKPIs() {
    const totalIncome = employees.reduce((sum, e) => sum + (e.total_income || 0), 0);
    const totalWithdrawals = employees.reduce((sum, e) => sum + (e.total_withdrawal || 0), 0);
    const totalTarget = employees.reduce((sum, e) => sum + (e.target || 0), 0);
    const overallAchievement = totalTarget > 0 ? Math.round((totalIncome / totalTarget) * 100) : 0;

    setText('totalEmployees', employees.length.toLocaleString());
    setText('totalIncome', totalIncome.toLocaleString() + ' ﷼');
    setText('totalWithdrawals', totalWithdrawals.toLocaleString() + ' ﷼');
    setText('overallAchievement', overallAchievement + '%');
    
    updateCharts();
}

async function updateGlobalLimit(val) {
    if (!val) return;
    try {
        await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'max_withdrawal_limit', value: val })
        });
        smartAlert('✅ تم تحديث الحد الأعلى للسحب');
    } catch (e) { console.error('Limit update error:', e); }
}

// ==========================================
// 🎨 UI Rendering & Component Logic
// ==========================================
function renderSections() {
    const container = document.getElementById('sectionsContainer');
    if(!container) return;
    container.innerHTML = '';
    
    sections.forEach(section => {
        const sectionEmployees = employees.filter(emp => emp.section_id === section.id);
        const sectionIncome = sectionEmployees.reduce((sum, emp) => sum + (emp.total_income || 0), 0);
        
        const card = document.createElement('div');
        card.className = 'section-card';
        card.innerHTML = `
        <div class="section-header" onclick="toggleSection('section-${section.id}')">
            <div class="section-info">
                <div class="section-icon">📂</div>
                <div class="section-title-group">
                    <h2>${section.name}</h2>
                </div>
            </div>
            <div class="section-stats">
                <div class="mini-stat">
                    <span class="mini-stat-val">${sectionEmployees.length}</span>
                    <span class="mini-stat-label">موظف</span>
                </div>
                <div class="mini-stat">
                    <span class="mini-stat-val">${sectionIncome.toLocaleString()}</span>
                    <span class="mini-stat-label">دخل اليوم</span>
                </div>
                <div class="mini-stat" style="display:flex; align-items:center; opacity:0.5;">▼</div>
            </div>
        </div>
        <div class="section-content collapsed" id="section-${section.id}">
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>الموظف</th>
                            <th>الراتب الأساسي</th>
                            <th>التارقت</th>
                            <th>سحوبات اليوم</th>
                            <th style="background:#f0fdf4; color:#166534;">الصافي (Sync)</th>
                            <th>الدخل المحلي</th>
                            <th>الإنجاز</th>
                            <th>إجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sectionEmployees.map(emp => {
                            const income = emp.total_income || 0;
                            const target = emp.target || 0;
                            const percent = target > 0 ? Math.round((income / target) * 100) : 0;
                            return `
                            <tr>
                                <td>
                                    <div style="font-weight:700;">${emp.name}</div>
                                    <div style="font-size:11px; color:var(--text-gray);">${emp.username}</div>
                                </td>
                                <td>${(emp.base_salary || 0).toLocaleString()}</td>
                                <td>${(emp.target_amount || 0).toLocaleString()}</td>
                                <td style="color:var(--danger); font-weight:700;">${(emp.total_withdrawals || 0).toLocaleString()}</td>
                                <td style="background:#f7fff9; font-weight:800; color:#15803d;">${(emp.net_remaining || 0).toLocaleString()}</td>
                                <td style="font-weight:800; color:var(--primary);">${income.toLocaleString()}</td>
                                <td>
                                    <span style="font-weight:700; color:${getPercentColor(percent)};">${percent}%</span>
                                </td>
                                <td>
                                    <div style="display:flex; justify-content:center; gap:8px;">
                                        <button class="action-btn-pill" style="background:#fef2f2; color:var(--danger);" onclick="deleteEmployee(${emp.id})" title="حذف">🗑️</button>
                                        <button class="action-btn-pill" style="background:#f0f9ff; color:var(--primary);" onclick="openEditModal(${emp.id})" title="تعديل">✏️</button>
                                        <button class="action-btn-pill" style="background:#f0fdf4; color:var(--success);" onclick="openIncomeModal(${emp.id})" title="إيداع">💰</button>
                                        <button class="action-btn-pill" style="background:#fffbeb; color:var(--warning);" onclick="openWithdrawalModal(${emp.id})" title="سحب">💳</button>
                                    </div>
                                </td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
        container.appendChild(card);
    });

    // Add Universal Buttons
    const footerBtns = document.createElement('div');
    footerBtns.style = "display: flex; justify-content: center; gap: 15px; margin-top: 25px; padding-bottom: 50px;";
    footerBtns.innerHTML = `
        <button class="btn btn-primary" onclick="openModal('addEmployeeModal')">➕ إضافة موظف</button>
        <button class="btn btn-success" onclick="document.getElementById('salary-file').click()">📊 استيراد إكسل</button>
        <input type="file" id="salary-file" style="display: none;" accept=".xlsx, .xls" onchange="importSalaries(this)">
    `;
    container.appendChild(footerBtns);
}

// ==========================================
// 📉 Charting & Data Viz
// ==========================================
function updateCharts() {
    const sectionData = sections.map(sec => ({
        name: sec.name,
        income: employees.filter(e => e.section_id === sec.id).reduce((sum, e) => sum + (e.total_income || 0), 0)
    }));
    renderIncomeChart(sectionData);

    const achievementData = employees.map(emp => ({
        name: emp.name,
        percent: emp.target > 0 ? (emp.total_income / emp.target) * 100 : 0
    })).sort((a,b) => b.percent - a.percent).slice(0, 5);
    renderAchievementChart(achievementData);
}

function renderIncomeChart(data) {
    const el = document.getElementById('incomeBySectionChart');
    if(!el) return;
    const ctx = el.getContext('2d');
    if (charts.income) charts.income.destroy();
    charts.income = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.map(d => d.name),
            datasets: [{
                data: data.map(d => d.income),
                backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'],
                borderWidth: 2, borderColor: '#fff'
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '65%' }
    });
}

function renderAchievementChart(data) {
    const el = document.getElementById('targetAchievementChart');
    if(!el) return;
    const ctx = el.getContext('2d');
    if (charts.achievement) charts.achievement.destroy();
    charts.achievement = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.name),
            datasets: [{ label: 'الإنجاز %', data: data.map(d => d.percent), backgroundColor: '#6366f1', borderRadius: 8 }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } } }
    });
}

// ==========================================
// 🏝️ Employee Management Modals
// ==========================================
async function handleAddEmployee(e) {
    e.preventDefault();
    const data = getFormData('addEmployeeForm');
    try {
        const res = await fetch('/api/employees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (res.ok) { smartAlert('✅ تمت الإضافة'); closeModal('addEmployeeModal'); e.target.reset(); loadData(); }
    } catch (e) { console.error(e); }
}

async function handleEditEmployee(e) {
    e.preventDefault();
    const id = document.getElementById('editEmpId').value;
    const data = getFormData('editEmployeeForm');
    try {
        const res = await fetch(`/api/employees/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (res.ok) {
            const extraInc = document.getElementById('editEmpNewIncome').value;
            if(extraInc) await fetch(`/api/employees/${id}/income`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ income: parseInt(extraInc), section_id: data.section_id }) });
            smartAlert('✅ تم التعديل'); closeModal('editEmployeeModal'); loadData();
        }
    } catch (e) { console.error(e); }
}

async function handleAddIncome(e) {
    e.preventDefault();
    const empId = document.getElementById('incomeEmpId').value;
    const data = { 
        income: document.getElementById('incomeAmount').value, 
        details: document.getElementById('incomeDetails').value,
        section_id: employees.find(e => e.id == empId).section_id
    };
    try {
        const res = await fetch(`/api/employees/${empId}/income`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (res.ok) { smartAlert('✅ تم الإيداع'); closeModal('addIncomeModal'); loadData(); }
    } catch (e) { console.error(e); }
}

async function handleAddWithdrawal(e) {
    e.preventDefault();
    const empId = document.getElementById('withdrawalEmpId').value;
    const data = { employee_id: empId, amount: document.getElementById('withdrawalAmount').value, reason: document.getElementById('withdrawalReason').value, status: 'approved' };
    try {
        const res = await fetch('/api/withdrawals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (res.ok) { smartAlert('✅ تم تسجيل السحب'); closeModal('addWithdrawalModal'); loadData(); }
    } catch (e) { console.error(e); }
}

function deleteEmployee(id) {
    if (!confirm('🚮 متأكد من حذف الموظف نهائياً؟')) return;
    fetch(`/api/employees/${id}`, { method: 'DELETE' }).then(res => res.ok ? loadData() : alert('فشل الحذف'));
}

// ==========================================
// 📅 Attendance & Shifts
// ==========================================
async function openAttendanceModal() {
    const select = document.getElementById('attendanceEmployeeFilter');
    if(select) {
        select.innerHTML = '<option value="">جميع الموظفين</option>' + employees.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
    }
    const dateInput = document.getElementById('attendanceDate');
    if(dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    
    loadAttendanceReport();
    openModal('attendanceModal');
}

async function loadAttendanceReport(type = 'date') {
    const tbody = document.getElementById('attendanceTableBody');
    if(!tbody) return;
    const date = document.getElementById('attendanceDate').value;
    const month = document.getElementById('attendanceMonth').value;
    const empId = document.getElementById('attendanceEmployeeFilter').value;
    
    tbody.innerHTML = '<tr><td colspan="9">⏳ جاري التحميل...</td></tr>';
    
    let url = `/api/attendance/report?`;
    if (date && type==='date') url += `date=${date}&`;
    if (month && type==='month') url += `month=${month}&`;
    if (empId) url += `employee_id=${empId}`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.length === 0) { tbody.innerHTML = '<tr><td colspan="9">لا توجد بيانات</td></tr>'; return; }

        tbody.innerHTML = data.map(row => {
            const checkIn = row.check_in ? new Date(row.check_in).toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'}) : '---';
            const checkOut = row.check_out ? new Date(row.check_out).toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'}) : '---';
            return `
                <tr>
                    <td>${row.date}</td>
                    <td font-weight-bold>${row.employee_name}</td>
                    <td font-size-11 color-gray>${row.shift_start}-${row.shift_end}</td>
                    <td dir="ltr">${checkIn}</td>
                    <td dir="ltr">${checkOut}</td>
                    <td>${(row.delay_minutes/60).toFixed(1)}h</td>
                    <td>${(row.early_departure_minutes/60).toFixed(1)}h</td>
                    <td>${(row.overtime_minutes/60).toFixed(1)}h</td>
                    <td><span class="badge-status badge-status-${row.check_in ? 'success' : 'danger'}">${row.check_in ? 'حاضر' : 'غائب'}</span></td>
                </tr>`;
        }).join('');
    } catch (e) { tbody.innerHTML = '<tr><td colspan="9">❌ خطأ في التحميل</td></tr>'; }
}

async function openShiftModal() {
    const tbody = document.getElementById('shiftTableBody');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5">⏳ جاري التحميل...</td></tr>';
    openModal('shiftModal');

    const daysMap = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const order = [6, 0, 1, 2, 3, 4, 5]; // Sat to Fri

    try {
        const res = await fetch('/api/branch-shifts');
        const shifts = await res.json();
        const sorted = order.map(dn => shifts.find(s => s.day_of_week === dn));

        tbody.innerHTML = sorted.map(s => `
            <tr>
                <td><strong>${daysMap[s.day_of_week]}</strong></td>
                <td><input type="time" id="start-${s.day_of_week}" value="${s.shift_start}" ${s.is_closed ? 'disabled' : ''}></td>
                <td><input type="time" id="end-${s.day_of_week}" value="${s.shift_end}" ${s.is_closed ? 'disabled' : ''}></td>
                <td><input type="checkbox" id="close-${s.day_of_week}" ${s.is_closed ? 'checked' : ''} onchange="toggleDayInput(${s.day_of_week})"></td>
                <td><button class="btn btn-primary" style="padding:5px 10px;" onclick="updateBranchShift(${s.day_of_week})">حفظ</button></td>
            </tr>`).join('');
    } catch (e) { tbody.innerHTML = '<tr><td colspan="5">خطأ</td></tr>'; }
}

function toggleDayInput(day) {
    const c = document.getElementById(`close-${day}`).checked;
    document.getElementById(`start-${day}`).disabled = c;
    document.getElementById(`end-${day}`).disabled = c;
}

async function updateBranchShift(day) {
    const data = { shift_start: val(`start-${day}`), shift_end: val(`end-${day}`), is_closed: !!document.getElementById(`close-${day}`).checked };
    try {
        const res = await fetch(`/api/branch-shifts/${day}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if(res.ok) smartAlert('✅ تم تحديث الموعد');
    } catch (e) { alert('خطأ'); }
}

// ==========================================
// 🔔 Management Alerts (Withdrawals/Leaves)
// ==========================================
async function loadPendingRequests() {
    const container = document.getElementById('pendingContainer');
    const section = document.getElementById('pendingRequestsSection');
    if(!container) return;

    try {
        const [wRes, lRes] = await Promise.all([ fetch('/api/withdrawals/pending'), fetch('/api/leave-requests?status=pending') ]);
        const withdrawals = await wRes.json();
        const leaves = await lRes.json();

        if (withdrawals.length === 0 && leaves.length === 0) { section.style.display = 'none'; return; }

        section.style.display = 'block';
        container.innerHTML = '';

        withdrawals.forEach(w => {
            const card = document.createElement('div');
            card.className = 'stat-card';
            card.style.borderRight = '4px solid var(--warning)';
            card.innerHTML = `
                <div class="stat-header"><div class="stat-icon-box" style="--card-bg:#fffbeb; --card-accent:var(--warning);">💳</div><span class="badge-status badge-status-warning">سحب معلق</span></div>
                <div style="font-weight:700;">${w.employee_name}</div>
                <div class="stat-value" style="font-size:22px; color:var(--danger);">${w.amount} ﷼</div>
                <div class="stat-label">${w.reason || 'بدون سبب'}</div>
                <div style="margin-top:15px; display:flex; gap:10px;">
                    <button class="btn btn-success" style="flex:1;" onclick="handleWithdrawalAction(${w.id}, 'approved')">قبول</button>
                    <button class="btn btn-danger" style="flex:1;" onclick="handleWithdrawalAction(${w.id}, 'rejected')">رفض</button>
                </div>`;
            container.appendChild(card);
        });

        leaves.forEach(l => {
            const card = document.createElement('div');
            card.className = 'stat-card';
            card.style.borderRight = '4px solid var(--info)';
            card.innerHTML = `
                <div class="stat-header"><div class="stat-icon-box" style="--card-bg:#eff6ff; --card-accent:var(--info);">🏖️</div><span class="badge-status badge-status-warning">إجازة معلقة</span></div>
                <div style="font-weight:700;">${l.employee_name}</div>
                <div class="stat-value" style="font-size:20px;">${l.days_count} يوم</div>
                <div class="stat-label">${l.leave_type} (${l.start_date} - ${l.end_date})</div>
                <div style="margin-top:15px; display:flex; gap:10px;">
                    <button class="btn btn-success" style="flex:1;" onclick="handleLeaveAction(${l.id}, 'approved')">قبول</button>
                    <button class="btn btn-danger" style="flex:1;" onclick="handleLeaveAction(${l.id}, 'rejected')">رفض</button>
                </div>`;
            container.appendChild(card);
        });
    } catch (e) { console.warn('Pending requests error:', e); }
}

async function handleWithdrawalAction(id, status) {
    const note = status === 'rejected' ? prompt('سبب الرفض:') : null;
    try {
        const res = await fetch(`/api/withdrawals/${id}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, admin_note: note || '' }) });
        if (res.ok) { loadPendingRequests(); loadData(); }
    } catch (e) { alert('خطأ'); }
}

async function handleLeaveAction(id, status) {
    const note = status === 'rejected' ? prompt('سبب الرفض:') : null;
    try {
        const res = await fetch(`/api/leave-requests/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, admin_notes: note || '' }) });
        if (res.ok) { loadPendingRequests(); loadData(); if(isVisible('leaveModal')) loadAllLeaveRequests(); }
    } catch (e) { alert('خطأ'); }
}

// ==========================================
// 🖨️ Printing & Reporting
// ==========================================
async function printWithdrawalList() {
    try {
        const res = await fetch('/api/reports/withdrawal-list');
        const data = await res.json();
        const emps = data.employees;
        const maxLimit = data.maxWithdrawalLimit;

        const grouped = {};
        emps.forEach(e => { if(!grouped[e.bank_name]) grouped[e.bank_name] = []; grouped[e.bank_name].push(e); });

        let html = `
            <style>
                @media print { body * { visibility: hidden; } .print-area, .print-area * { visibility: visible; } .print-area { position: absolute; left: 0; top: 0; width: 100%; direction: rtl; font-family: 'Cairo', sans-serif; } }
                .print-table { width: 100%; border-collapse: collapse; }
                .print-table th, .print-table td { border: 1px solid black; padding: 10px; text-align: center; }
                .bank-header { background: #eee; font-weight: bold; }
                .footer { margin-top: 25px; border: 2px solid black; padding: 15px; display: flex; justify-content: space-between; font-weight: 700; }
            </style>
            <div class="print-area">
                <h1 style="text-align:center; margin-bottom:20px;">كشف السحبيات اليومية</h1>
                <table class="print-table">
                    <thead><tr><th style="width:50px;">#</th><th>الموظف</th><th style="width:120px;">المبلغ</th><th style="width:120px;">الصافي (Sync)</th></tr></thead>
                    <tbody>`;
        
        let c = 1, tNet = 0;
        for (const bank in grouped) {
            html += `<tr class="bank-header"><td colspan="4">${bank}</td></tr>`;
            grouped[bank].forEach(e => {
                tNet += (e.net_remaining || 0);
                html += `<tr><td>${c++}</td><td style="text-align:right;">${e.name}</td><td></td><td>${(e.net_remaining || 0).toLocaleString()}</td></tr>`;
            });
        }
        html += `<tr style="background:#f9f9f9; font-weight:bold;"><td colspan="2">الإجمالي</td><td></td><td>${tNet.toLocaleString()}</td></tr></tbody></table>
                <div class="footer"><span>ملاحظات: ____________________</span><span>* الحد الأعلى للسحب: ${maxLimit} ﷼</span></div></div>`;

        const win = window.open('', '_blank');
        win.document.write(`<html><head><link href="https://fonts.googleapis.com/css2?family=Cairo&display=swap" rel="stylesheet"></head><body>${html}</body></html>`);
        win.document.close();
        setTimeout(() => win.print(), 600);
    } catch(e) { smartAlert('❌ فشل إعداد التقرير'); }
}

// ==========================================
// 💬 Employee Chat Panel
// ==========================================
function toggleAdminChat() {
    const w = document.getElementById('adminChatWidget');
    w.style.display = w.style.display === 'flex' ? 'none' : 'flex';
    if(w.style.display === 'flex') updateChatEmployeeSelect();
}

async function updateChatEmployeeSelect() {
    const s = document.getElementById('chatEmployeeSelect');
    const current = s.value;
    s.innerHTML = '<option value="">-- اختر موظفاً --</option>' + employees.map(e => {
        const ur = unreadCounts[e.id] || 0;
        return `<option value="${e.id}">${e.name} ${ur > 0 ? '🔴' : ''}</option>`;
    }).join('');
    s.value = current;
}

async function loadAdminChat(empId) {
    if(!empId) return;
    try {
        await fetch('/api/messages/mark-read', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employee_id: empId, reader: 'admin' }) });
        checkUnreadMessages();
        const msgs = await fetch(`/api/messages/${empId}`).then(r => r.json());
        const body = document.getElementById('adminChatBody');
        body.innerHTML = msgs.map(m => `
            <div style="align-self: ${m.sender === 'admin' ? 'flex-end' : 'flex-start'}; background: ${m.sender === 'admin' ? 'var(--primary)' : '#f1f5f9'}; color: ${m.sender === 'admin' ? 'white' : 'black'}; padding: 8px 12px; border-radius: 10px; max-width: 80%; font-size: 14px; margin-bottom: 5px;">
                ${m.message}
            </div>`).join('');
        body.scrollTop = body.scrollHeight;
    } catch(e) { console.error(e); }
}

async function sendAdminMessage() {
    const id = val('chatEmployeeSelect'), msg = val('adminChatInput').trim();
    if(!id || !msg) return;
    try {
        await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ employee_id: id, sender: 'admin', message: msg }) });
        document.getElementById('adminChatInput').value = '';
        loadAdminChat(id);
    } catch(e) { alert('فشل الإرسال'); }
}

async function checkUnreadMessages() {
    try {
        const counts = await fetch('/api/messages/unread/admin').then(r => r.json());
        unreadCounts = {}; counts.forEach(i => unreadCounts[i.employee_id] = i.count);
        const total = counts.reduce((s, i) => s + i.count, 0);
        const b = document.getElementById('chatBadge');
        b.style.display = total > 0 ? 'flex' : 'none';
        b.textContent = total;
    } catch(e) {}
}

// ==========================================
// 🛠️ Helpers & Utilities
// ==========================================
function setupEventListeners() {
    listen('addEmployeeForm', 'submit', handleAddEmployee);
    listen('editEmployeeForm', 'submit', handleEditEmployee);
    listen('addIncomeForm', 'submit', handleAddIncome);
    listen('addWithdrawalForm', 'submit', handleAddWithdrawal);
    listen('adminChatInput', 'keypress', (e) => { if (e.key === 'Enter') sendAdminMessage(); });
}

function toggleSection(id) { document.getElementById(id).classList.toggle('collapsed'); }
function updateDateHeader() {
    const now = new Date();
    setText('currentDateDisplay', now.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
}

function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function scrollToPending() { const s = document.getElementById('pendingRequestsSection'); if(s.style.display!=='none') s.scrollIntoView({behavior:'smooth'}); }
function backupDatabase() { window.location.href = '/api/backup'; }
function checkNotifications() { fetch('/api/notifications').then(r => r.json()).then(d => document.getElementById('notifBadgeDot').style.display = d.total > 0 ? 'block' : 'none'); }
async function loadAdminInspectionStats() {
    const stats = await fetch('/api/admin/inspection-stats').then(r => r.json());
    // (Inspection logic UI omitted for brevity, but stays in background)
}

// Global UI Helpers
const setText = (id, txt) => { const el = document.getElementById(id); if(el) el.textContent = txt; };
const val = (id) => document.getElementById(id)?.value;
const listen = (id, ev, fn) => { const el = document.getElementById(id); if(el) el.addEventListener(ev, fn); };
const isVisible = (id) => document.getElementById(id)?.style.display === 'flex';
const getPercentColor = (p) => p >= 100 ? '#10b981' : p >= 75 ? '#f59e0b' : '#ef4444';
const updateSectionSelects = () => { ['empSection', 'editEmpSection'].forEach(sid => { const s = document.getElementById(sid); if(s) s.innerHTML = sections.map(sec => `<option value="${sec.id}">${sec.name}</option>`).join(''); }); };
const getFormData = (id) => Object.fromEntries(new FormData(document.getElementById(id)));

// --- Excel Import Logic ---
async function importSalaries(input) {
    const file = input.files[0]; if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    try {
        smartAlert('⏳ جاري المزامنة...');
        const res = await fetch('/api/employees/import-salaries', { method: 'POST', body: fd });
        const result = await res.json();
        smartAlert(result.message);
        loadData();
    } catch(e) { smartAlert('❌ خطأ في الاتصال'); } finally { input.value = ''; }
}

// Initialize!
init();
