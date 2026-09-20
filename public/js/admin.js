/**
 * <i class="fa-solid fa-briefcase"></i> Workshop Manager - Admin Dashboard Logic
 * Modularized and optimized for performance & maintainability.
 */

// ==========================================
// <i class="fa-solid fa-chart-pie"></i> Global State
// ==========================================
let employees = [];
let sections = [];
let banks = [];
let charts = {};
let unreadCounts = {};
let selectedSectionFilter = 'all';

// ==========================================
// 🚀 Application Core Init
// ==========================================
async function init() {
    checkAuth();
    initSidebarCollapseState();
    setupEventListeners();
    updateDateHeader();
    
    // Initial Data Fetch
    await Promise.all([
        loadData(),
        loadBanks()
    ]);
    
    // Initial Component Loads
    checkNotifications();
    loadAdminNotifications();
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
        loadAdminNotifications();
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

        renderSectionFilterNav();
        renderSections();
        updateSectionSelects();
        updateBankSelects();
        updateDashboardKPIs();
    } catch (err) {
        console.error('Data Load Error:', err);
        if(container) container.innerHTML = '<div class="error"><i class="fa-solid fa-circle-xmark"></i> فشل في تحميل البيانات</div>';
    }
}

function updateDashboardKPIs() {
    const totalIncome = employees.reduce((sum, e) => sum + (parseFloat(e.total_income) || 0), 0);
    const totalWithdrawals = employees.reduce((sum, e) => sum + (parseFloat(e.total_withdrawal) || 0), 0);
    const totalTarget = employees.reduce((sum, e) => sum + (parseFloat(e.target) || 0), 0);
    const overallAchievement = totalTarget > 0 ? Math.round((totalIncome / totalTarget) * 100) : 0;

    setText('totalEmployees', employees.length.toLocaleString());
    setText('totalIncome', totalIncome.toLocaleString() + ' ﷼');
    setText('totalIncomeWithTax', Math.round(totalIncome * 1.15).toLocaleString() + ' ﷼');
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
        smartAlert('<i class="fa-solid fa-circle-check"></i> تم تحديث الحد الأعلى للسحب');
    } catch (e) { console.error('Limit update error:', e); }
}

// ==========================================
// 🎨 UI Rendering & Section Filter Pills
// ==========================================
function renderSectionFilterNav() {
    const nav = document.getElementById('sectionFilterNav');
    if (!nav) return;

    let html = `
        <div class="section-filter-pill ${selectedSectionFilter === 'all' ? 'active' : ''}" onclick="setSectionFilter('all')">
            <i class="fa-solid fa-layer-group"></i>
            <span>الكل</span>
            <span class="pill-badge">${employees.length}</span>
        </div>
    `;

    sections.forEach(sec => {
        const count = employees.filter(e => e.section_id === sec.id).length;
        const isActive = selectedSectionFilter == sec.id;
        html += `
            <div class="section-filter-pill ${isActive ? 'active' : ''}" onclick="setSectionFilter(${sec.id})">
                <i class="fa-solid fa-folder"></i>
                <span>${sec.name}</span>
                <span class="pill-badge">${count}</span>
            </div>
        `;
    });

    nav.innerHTML = html;
}

function setSectionFilter(secId) {
    selectedSectionFilter = secId;
    renderSectionFilterNav();
    renderSections();
}

function renderSections() {
    const container = document.getElementById('sectionsContainer');
    if (!container) return;
    container.innerHTML = '';
    
    const visibleSections = selectedSectionFilter === 'all' 
        ? sections 
        : sections.filter(s => s.id == selectedSectionFilter);

    if (visibleSections.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:50px 20px; background:white; border-radius:16px; border:1px dashed var(--border-color); color:var(--text-gray);">
                <i class="fa-solid fa-folder-open" style="font-size:36px; margin-bottom:12px; opacity:0.5;"></i>
                <div style="font-size:16px; font-weight:700;">لا توجد أقسام مسجلة حتى الآن</div>
                <button class="btn btn-primary" onclick="openNewSectionModal()" style="margin-top:15px;">
                    <i class="fa-solid fa-plus"></i> إضافة قسم جديد
                </button>
            </div>
        `;
        return;
    }

    visibleSections.forEach(section => {
        const sectionEmployees = employees.filter(emp => emp.section_id === section.id);
        const sectionIncome = sectionEmployees.reduce((sum, emp) => sum + (parseFloat(emp.total_income) || 0), 0);
        
        let shiftBadge = '';
        if (section.shift_start && section.shift_end) {
            shiftBadge = `<span style="background:#e0e7ff; color:var(--primary); font-size:11px; padding:2px 8px; border-radius:12px; font-weight:700; margin-right:8px;"><i class="fa-solid fa-clock"></i> ${section.shift_start} - ${section.shift_end}</span>`;
        }

        const card = document.createElement('div');
        card.className = 'section-card';
        card.innerHTML = `
        <div class="section-header" onclick="toggleSection('section-${section.id}')">
            <div class="section-info">
                <div class="section-icon">📂</div>
                <div class="section-title-group" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <h2 style="margin:0;">${section.name}</h2>
                    ${shiftBadge}
                </div>
            </div>
            <div class="section-stats" style="display:flex; align-items:center; gap:12px;">
                <div class="mini-stat">
                    <span class="mini-stat-val">${sectionEmployees.length}</span>
                    <span class="mini-stat-label">موظف</span>
                </div>
                <div class="mini-stat">
                    <span class="mini-stat-val">${sectionIncome.toLocaleString()} ﷼</span>
                    <span class="mini-stat-label">دخل اليوم</span>
                </div>
                <button class="section-gear-btn" onclick="openSectionPermissionsModal(${section.id}, event)" title="صلاحيات وإعدادات القسم">
                    <i class="fa-solid fa-sliders"></i>
                </button>
                <div class="mini-stat" style="display:flex; align-items:center; opacity:0.6; cursor:pointer;">▼</div>
            </div>
        </div>
        <div class="section-content" id="section-${section.id}">
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>الموظف</th>
                            <th>الراتب الأساسي</th>
                            <th>التارقت</th>
                            <th>البنك / الصرف</th>
                            <th>سحوبات اليوم</th>
                            <th style="background:#f0fdf4; color:#166534;">صافي متبقي (Excel)</th>
                            <th>دخل اليوم</th>
                            <th>الإنجاز</th>
                            <th>إجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sectionEmployees.length === 0 ? `
                            <tr><td colspan="9" style="text-align:center; padding:20px; color:var(--text-gray);">لا يوجد موظفين في هذا القسم حتى الآن</td></tr>
                        ` : sectionEmployees.map(emp => {
                            const income = parseFloat(emp.total_income) || 0;
                            const target = parseFloat(emp.target || emp.target_amount) || 0;
                            const percent = target > 0 ? Math.round((income / target) * 100) : 0;
                            return `
                            <tr>
                                <td data-label="الموظف">
                                    <div style="font-weight:800; font-size:14px; color:var(--text-dark);">${emp.name}</div>
                                    <div style="font-size:11px; color:var(--text-gray); font-weight:600;">${emp.username ? '@' + emp.username : 'بدون حساب'}</div>
                                </td>
                                <td data-label="الراتب الأساسي">${(parseFloat(emp.base_salary) || 0).toLocaleString()} ﷼</td>
                                <td data-label="التارقت">${(parseFloat(emp.target || emp.target_amount) || 0).toLocaleString()} ﷼</td>
                                <td data-label="البنك">${emp.bank_name || 'كاش'}</td>
                                <td data-label="سحوبات اليوم" style="color:var(--danger); font-weight:800;">${(parseFloat(emp.total_withdrawal || emp.total_withdrawals) || 0).toLocaleString()} ﷼</td>
                                <td data-label="صافي متبقي (Excel)" style="background:#f7fff9; font-weight:900; color:#15803d;">${(parseFloat(emp.net_remaining) || 0).toLocaleString()} ﷼</td>
                                <td data-label="دخل اليوم" style="font-weight:800; color:var(--primary);">${income.toLocaleString()} ﷼</td>
                                <td data-label="الإنجاز">
                                    <span style="font-weight:800; color:${getPercentColor(percent)};">${percent}%</span>
                                </td>
                                <td data-label="إجراءات">
                                    <div style="display:flex; justify-content:center; gap:6px; flex-wrap:wrap;">
                                        <button class="action-btn-pill" style="background:#f0fdf4; color:var(--success);" onclick="openIncomeModal(${emp.id})" title="إيداع دخل"><i class="fa-solid fa-sack-dollar"></i></button>
                                        <button class="action-btn-pill" style="background:#fffbeb; color:var(--warning);" onclick="openWithdrawalModal(${emp.id})" title="تسجيل سحب"><i class="fa-solid fa-credit-card"></i></button>
                                        <button class="action-btn-pill" style="background:#f0f9ff; color:var(--primary);" onclick="openEditModal(${emp.id})" title="تعديل"><i class="fa-solid fa-pen"></i></button>
                                        <button class="action-btn-pill" style="background:#fef2f2; color:var(--danger);" onclick="deleteEmployee(${emp.id})" title="حذف"><i class="fa-solid fa-trash"></i></button>
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
}

function toggleAllSections() {
    const contents = document.querySelectorAll('.section-content');
    if (!contents.length) return;
    const isAnyOpen = Array.from(contents).some(c => !c.classList.contains('collapsed'));
    contents.forEach(c => {
        if (isAnyOpen) c.classList.add('collapsed');
        else c.classList.remove('collapsed');
    });
}

// ==========================================
// 🛡️ Section Permissions & Shifts Modal Logic
// ==========================================
function openSectionPermissionsModal(sectionId, event) {
    if (event) event.stopPropagation();
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;

    document.getElementById('permSectionId').value = section.id;
    document.getElementById('permSectionName').value = section.name;
    document.getElementById('permCanViewIncome').checked = section.can_view_income !== 0;
    document.getElementById('permCanWithdraw').checked = section.can_withdraw !== 0;
    document.getElementById('permCanInspect').checked = section.can_inspect == 1;
    document.getElementById('permCanManageParts').checked = section.can_manage_parts == 1;
    document.getElementById('permShiftStart').value = section.shift_start || '';
    document.getElementById('permShiftEnd').value = section.shift_end || '';

    openModal('sectionPermissionsModal');
}

async function saveSectionPermissions(e) {
    e.preventDefault();
    const secId = document.getElementById('permSectionId').value;
    const name = document.getElementById('permSectionName').value.trim();
    const can_view_income = document.getElementById('permCanViewIncome').checked ? 1 : 0;
    const can_withdraw = document.getElementById('permCanWithdraw').checked ? 1 : 0;
    const can_inspect = document.getElementById('permCanInspect').checked ? 1 : 0;
    const can_manage_parts = document.getElementById('permCanManageParts').checked ? 1 : 0;
    const shift_start = document.getElementById('permShiftStart').value || null;
    const shift_end = document.getElementById('permShiftEnd').value || null;

    try {
        const res = await fetch(`/api/sections/${secId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                can_view_income,
                can_withdraw,
                can_inspect,
                can_manage_parts,
                shift_start,
                shift_end
            })
        });

        if (res.ok) {
            smartAlert('<i class="fa-solid fa-circle-check"></i> تم حفظ إعدادات وصلاحيات القسم بنجاح');
            closeModal('sectionPermissionsModal');
            loadData();
        } else {
            const err = await res.json();
            smartAlert('<i class="fa-solid fa-circle-xmark"></i> ' + (err.message || 'فشل في حفظ التعديلات'));
        }
    } catch (err) {
        console.error(err);
        smartAlert('<i class="fa-solid fa-circle-xmark"></i> تعذر الاتصال بالسيرفر');
    }
}

function openNewSectionModal() {
    document.getElementById('newSectionName').value = '';
    openModal('newSectionModal');
}

async function createNewSection(e) {
    e.preventDefault();
    const name = document.getElementById('newSectionName').value.trim();
    if (!name) return;

    try {
        const res = await fetch('/api/sections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });

        if (res.ok) {
            smartAlert('<i class="fa-solid fa-circle-check"></i> تم إضافة القسم بنجاح');
            closeModal('newSectionModal');
            loadData();
        } else {
            const err = await res.json();
            smartAlert('<i class="fa-solid fa-circle-xmark"></i> ' + (err.message || 'فشل في إضافة القسم'));
        }
    } catch (err) {
        console.error(err);
        smartAlert('<i class="fa-solid fa-circle-xmark"></i> تعذر الاتصال بالسيرفر');
    }
}

async function deleteCurrentSection() {
    const secId = document.getElementById('permSectionId').value;
    const section = sections.find(s => s.id == secId);
    if (!section) return;

    const count = employees.filter(e => e.section_id == secId).length;
    if (count > 0) {
        if (!confirm(`تحذير: يوجد ${count} موظف مرتبطين بهذا القسم (${section.name}). هل أنت متأكد من حذف القسم؟`)) {
            return;
        }
    } else {
        if (!confirm(`هل أنت متأكد من حذف قسم (${section.name}) نهائياً؟`)) {
            return;
        }
    }

    try {
        const res = await fetch(`/api/sections/${secId}`, { method: 'DELETE' });
        if (res.ok) {
            smartAlert('<i class="fa-solid fa-circle-check"></i> تم حذف القسم');
            closeModal('sectionPermissionsModal');
            if (selectedSectionFilter == secId) selectedSectionFilter = 'all';
            loadData();
        } else {
            const err = await res.json();
            smartAlert('<i class="fa-solid fa-circle-xmark"></i> ' + (err.message || 'فشل حذف القسم'));
        }
    } catch (err) {
        console.error(err);
        smartAlert('<i class="fa-solid fa-circle-xmark"></i> خطأ في الاتصال');
    }
}

// ==========================================
// <i class="fa-solid fa-arrow-trend-down"></i> Charting & Data Viz
// ==========================================
function updateCharts() {
    const sectionData = sections.map(sec => ({
        name: sec.name,
        income: employees.filter(e => e.section_id === sec.id).reduce((sum, e) => sum + (parseFloat(e.total_income) || 0), 0)
    }));
    renderIncomeChart(sectionData);

    const achievementData = employees.map(emp => {
        const income = parseFloat(emp.total_income) || 0;
        const target = parseFloat(emp.target || emp.target_amount) || 0;
        return {
            name: emp.name,
            percent: target > 0 ? (income / target) * 100 : 0
        };
    }).sort((a,b) => b.percent - a.percent).slice(0, 5);
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
                backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#8b5cf6'],
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

function openIncomeModal(empId) { 
    document.getElementById('incomeEmpId').value = empId; 
    document.getElementById('incomeAmount').value = '';
    document.getElementById('incomeNote').value = '';
    openModal('addIncomeModal'); 
}

function openWithdrawalModal(empId) {
    document.getElementById('withdrawalEmpId').value = empId;
    document.getElementById('withdrawalAmount').value = '';
    document.getElementById('withdrawalNote').value = '';
    openModal('addWithdrawalModal');
}

function openEditModal(empId) {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;
    document.getElementById('editEmpId').value = emp.id;
    document.getElementById('editEmpName').value = emp.name;
    document.getElementById('editEmpSection').value = emp.section_id;
    document.getElementById('editEmpTarget').value = emp.target || emp.target_amount || 0;
    document.getElementById('editEmpBaseSalary').value = emp.base_salary || 0;
    document.getElementById('editEmpUsername').value = emp.username || '';
    document.getElementById('editEmpPassword').value = emp.password || '1234';
    
    if(document.getElementById('editEmpBank')) {
        document.getElementById('editEmpBank').value = emp.bank_name || (banks[0]?.name || 'كاش');
    }
    
    openModal('editEmployeeModal');
}

async function handleAddEmployee(e) {
    e.preventDefault();
    const payload = {
        name: document.getElementById('addEmpName').value.trim(),
        section_id: document.getElementById('addEmpSection').value,
        base_salary: parseFloat(document.getElementById('addEmpBaseSalary').value) || 0,
        target: parseFloat(document.getElementById('addEmpTarget').value) || 0,
        bank_name: document.getElementById('addEmpBank').value,
        username: document.getElementById('addEmpUsername').value.trim() || undefined,
        password: document.getElementById('addEmpPassword').value || undefined
    };

    try {
        const res = await fetch('/api/employees', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });
        if (res.ok) { 
            smartAlert('<i class="fa-solid fa-circle-check"></i> تمت إضافة الموظف بنجاح'); 
            closeModal('addEmployeeModal'); 
            e.target.reset(); 
            loadData(); 
        } else {
            const errorData = await res.json();
            smartAlert('<i class="fa-solid fa-circle-xmark"></i> ' + (errorData.message || 'خطأ في الإضافة'));
        }
    } catch (e) { console.error(e); smartAlert('<i class="fa-solid fa-circle-xmark"></i> خطأ في الاتصال'); }
}

async function handleEditEmployee(e) {
    e.preventDefault();
    const id = document.getElementById('editEmpId').value;
    const payload = {
        name: document.getElementById('editEmpName').value.trim(),
        section_id: document.getElementById('editEmpSection').value,
        base_salary: parseFloat(document.getElementById('editEmpBaseSalary').value) || 0,
        target: parseFloat(document.getElementById('editEmpTarget').value) || 0,
        bank_name: document.getElementById('editEmpBank').value,
        username: document.getElementById('editEmpUsername').value.trim() || undefined,
        password: document.getElementById('editEmpPassword').value || undefined
    };

    try {
        const res = await fetch(`/api/employees/${id}`, { 
            method: 'PUT', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });
        if (res.ok) {
            smartAlert('<i class="fa-solid fa-circle-check"></i> تم تعديل بيانات الموظف'); 
            closeModal('editEmployeeModal'); 
            loadData();
        } else {
            const errorData = await res.json();
            smartAlert('<i class="fa-solid fa-circle-xmark"></i> ' + (errorData.message || 'خطأ في التعديل'));
        }
    } catch (e) { console.error(e); smartAlert('<i class="fa-solid fa-circle-xmark"></i> خطأ في الاتصال'); }
}

async function handleAddIncome(e) {
    e.preventDefault();
    const empId = document.getElementById('incomeEmpId').value;
    const amount = parseFloat(document.getElementById('incomeAmount').value) || 0;
    const note = document.getElementById('incomeNote').value.trim();
    const emp = employees.find(e => e.id == empId);

    const data = { 
        income: amount, 
        details: note,
        section_id: emp ? emp.section_id : null
    };

    try {
        const res = await fetch(`/api/employees/${empId}/income`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(data) 
        });
        if (res.ok) { 
            smartAlert('<i class="fa-solid fa-circle-check"></i> تم إيداع الدخل بنجاح'); 
            closeModal('addIncomeModal'); 
            loadData(); 
        } else {
            const err = await res.json();
            smartAlert('<i class="fa-solid fa-circle-xmark"></i> ' + (err.message || 'فشل الإيداع'));
        }
    } catch (e) { console.error(e); }
}

async function handleAddWithdrawal(e) {
    e.preventDefault();
    const empId = document.getElementById('withdrawalEmpId').value;
    const amount = parseFloat(document.getElementById('withdrawalAmount').value) || 0;
    const note = document.getElementById('withdrawalNote').value.trim();

    const data = { 
        employee_id: empId, 
        amount: amount, 
        reason: note, 
        status: 'approved' 
    };

    try {
        const res = await fetch('/api/withdrawals', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(data) 
        });
        if (res.ok) { 
            smartAlert('<i class="fa-solid fa-circle-check"></i> تم تسجيل السحب بنجاح'); 
            closeModal('addWithdrawalModal'); 
            loadData(); 
        } else {
            const err = await res.json();
            smartAlert('<i class="fa-solid fa-circle-xmark"></i> ' + (err.message || 'فشل تسجيل السحب'));
        }
    } catch (e) { console.error(e); }
}

function deleteEmployee(id) {
    if (!confirm('🚮 هل أنت متأكد من حذف هذا الموظف نهائياً؟')) return;
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
            const checkIn = row.check_in ? new Date(row.check_in).toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'}) : '---';
            const checkOut = row.check_out ? new Date(row.check_out).toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'}) : '---';
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
    } catch (e) { tbody.innerHTML = '<tr><td colspan="9"><i class="fa-solid fa-circle-xmark"></i> خطأ في التحميل</td></tr>'; }
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
        if(res.ok) smartAlert('<i class="fa-solid fa-circle-check"></i> تم تحديث الموعد');
    } catch (e) { alert('خطأ'); }
}

// ==========================================
// <i class="fa-solid fa-bell"></i> Management Alerts (Withdrawals/Leaves)
// ==========================================
async function loadPendingRequests() {
    const container = document.getElementById('pendingContainer');
    const section = document.getElementById('pendingRequestsSection');
    if(!container) return;

    try {
        const [wRes, lRes, dRes] = await Promise.all([
            fetch('/api/withdrawals/pending'),
            fetch('/api/leave-requests?status=pending'),
            fetch('/api/admin/documents?status=pending')
        ]);
        const withdrawals = await wRes.json();
        const leaves = await lRes.json();
        const pendingDocs = await dRes.json();

        const docsBadge = document.getElementById('docsBadge');
        if (docsBadge) {
            docsBadge.style.display = pendingDocs.length > 0 ? 'inline-block' : 'none';
            docsBadge.textContent = pendingDocs.length > 9 ? '9+' : pendingDocs.length;
        }

        if (withdrawals.length === 0 && leaves.length === 0 && pendingDocs.length === 0) {
            section.style.display = 'none';
            return;
        }

        section.style.display = 'block';
        container.innerHTML = '';

        withdrawals.forEach(w => {
            const card = document.createElement('div');
            card.className = 'stat-card';
            card.style.borderRight = '4px solid var(--warning)';
            card.innerHTML = `
                <div class="stat-header"><div class="stat-icon-box" style="--card-bg:#fffbeb; --card-accent:var(--warning);"><i class="fa-solid fa-credit-card"></i></div><span class="badge-status badge-status-warning">سحب معلق</span></div>
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
            const hasAtt = l.attachment_path ? `
                <button type="button" class="btn btn-secondary" style="padding:4px 8px; font-size:11px; margin-top:6px;" onclick="previewAdminDoc('${l.attachment_path}', 'مرفق إجازة: ${l.employee_name}')">
                    <i class="fa-solid fa-paperclip"></i> عرض السكليف / التقرير
                </button>` : '';

            card.innerHTML = `
                <div class="stat-header"><div class="stat-icon-box" style="--card-bg:#eff6ff; --card-accent:var(--info);">🏖️</div><span class="badge-status badge-status-warning">إجازة معلقة</span></div>
                <div style="font-weight:700;">${l.employee_name}</div>
                <div class="stat-value" style="font-size:20px;">${l.days_count} يوم</div>
                <div class="stat-label">${l.leave_type} (${l.start_date} - ${l.end_date})</div>
                ${hasAtt}
                <div style="margin-top:15px; display:flex; gap:10px;">
                    <button class="btn btn-success" style="flex:1;" onclick="handleLeaveAction(${l.id}, 'approved')">قبول</button>
                    <button class="btn btn-danger" style="flex:1;" onclick="handleLeaveAction(${l.id}, 'rejected')">رفض</button>
                </div>`;
            container.appendChild(card);
        });

        pendingDocs.forEach(d => {
            const card = document.createElement('div');
            card.className = 'stat-card';
            card.style.borderRight = '4px solid var(--primary)';
            card.innerHTML = `
                <div class="stat-header"><div class="stat-icon-box" style="--card-bg:#eef2ff; --card-accent:var(--primary);">📁</div><span class="badge-status badge-status-warning">مستند معلق</span></div>
                <div style="font-weight:700;">${d.employee_name}</div>
                <div class="stat-value" style="font-size:16px; font-weight:800; color:var(--text-dark);">${d.title}</div>
                <div class="stat-label">${d.document_type} • ${d.notes || 'بدون تفاصيل'}</div>
                <div style="margin-top:8px;">
                    <button type="button" class="btn btn-secondary" style="padding:4px 10px; font-size:11.5px; width:100%; justify-content:center;" onclick="previewAdminDoc('${d.file_path}', '${d.title.replace(/'/g, "\\'")}', '${d.mime_type || ''}')">
                        <i class="fa-solid fa-eye"></i> معاينة المرفق
                    </button>
                </div>
                <div style="margin-top:12px; display:flex; gap:10px;">
                    <button class="btn btn-success" style="flex:1;" onclick="handleDocumentAction(${d.id}, 'approved')">اعتماد</button>
                    <button class="btn btn-danger" style="flex:1;" onclick="handleDocumentAction(${d.id}, 'rejected')">رفض</button>
                </div>`;
            container.appendChild(card);
        });
    } catch (e) { console.warn('Pending requests error:', e); }
}

async function handleWithdrawalAction(id, status) {
    const note = prompt(status === 'rejected' ? 'سبب الرفض (اختياري):' : 'ملاحظة للإدارة / الموظف (اختياري):');
    if (status === 'rejected' && note === null) return;
    try {
        const res = await fetch(`/api/withdrawals/${id}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, admin_note: note || '' }) });
        if (res.ok) { loadPendingRequests(); loadData(); }
    } catch (e) { alert('خطأ'); }
}

async function handleLeaveAction(id, status) {
    const note = prompt(status === 'rejected' ? 'سبب الرفض (اختياري):' : 'ملاحظة للإدارة / الموظف (اختياري):');
    if (status === 'rejected' && note === null) return;
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
                    <thead><tr><th style="width:50px;">#</th><th>الموظف</th><th style="width:120px;">المبلغ</th><th style="width:120px;">راتب متبقي من اكسل</th></tr></thead>
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
    } catch(e) { smartAlert('<i class="fa-solid fa-circle-xmark"></i> فشل إعداد التقرير'); }
}

// ==========================================
// <i class="fa-solid fa-comment-dots"></i> Employee Chat Panel
// ==========================================
function toggleAdminChat() {
    const w = document.getElementById('adminChatWidget');
    if (!w) return;
    const isShowing = w.style.display === 'flex';
    w.style.display = isShowing ? 'none' : 'flex';
    if (!isShowing) {
        updateChatEmployeeSelect();
        const s = document.getElementById('chatEmployeeSelect');
        if (s && s.value) loadAdminChat(s.value);
    }
}

async function updateChatEmployeeSelect() {
    const s = document.getElementById('chatEmployeeSelect');
    if (!s) return;
    const current = s.value;
    s.innerHTML = '<option value="">-- اختر موظفاً لبدء المحادثة --</option>' + employees.map(e => {
        const ur = unreadCounts[e.id] || 0;
        return `<option value="${e.id}">${e.name} ${ur > 0 ? `(🔴 ${ur} جديد)` : ''}</option>`;
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
        if (!body) return;
        if (!msgs || msgs.length === 0) {
            body.innerHTML = `
                <div style="text-align:center; padding:40px 15px; color:#94a3b8; font-size:13px;">
                    <i class="fa-regular fa-comment-dots" style="font-size:32px; color:#cbd5e1; margin-bottom:8px; display:block;"></i>
                    لا توجد رسائل سابقة مع هذا الموظف. اكتب رسالتك بالأسفل للبدء.
                </div>
            `;
            return;
        }
        body.innerHTML = msgs.map(m => `
            <div style="display:flex; align-items:center; gap:6px; margin-bottom:8px; flex-direction:${m.sender === 'admin' ? 'row-reverse' : 'row'};">
                <div style="background: ${m.sender === 'admin' ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : '#f1f5f9'}; color: ${m.sender === 'admin' ? 'white' : '#1e293b'}; padding: 9px 14px; border-radius: 14px; max-width: 80%; font-size: 13.5px; line-height: 1.4; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
                    <div>${m.message}</div>
                    <div style="font-size:10px; opacity:0.75; text-align:left; margin-top:4px; font-weight:600;">${new Date(m.created_at || Date.now()).toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'})}</div>
                </div>
                <button style="background:none; border:none; color:#cbd5e1; cursor:pointer; font-size:12px; padding:4px; transition:color 0.2s;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#cbd5e1'" onclick="deleteAdminChatMessage(${m.id}, ${empId})" title="حذف الرسالة">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>`).join('');
        body.scrollTop = body.scrollHeight;
    } catch(e) { console.error(e); }
}

async function deleteAdminChatMessage(msgId, empId) {
    if (!confirm('هل تريد حذف هذه الرسالة؟')) return;
    try {
        const res = await fetch(`/api/messages/${msgId}`, { method: 'DELETE' });
        if (res.ok) {
            loadAdminChat(empId);
        }
    } catch (e) {
        console.error(e);
    }
}

async function sendAdminMessage() {
    const id = val('chatEmployeeSelect'), msg = val('adminChatInput').trim();
    if(!id) {
        alert('يرجى اختيار موظف من القائمة أولاً');
        return;
    }
    if(!msg) return;
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
        const displayTxt = total > 9 ? '9+' : total;
        
        ['chatBadge', 'sidebarChatBadge', 'floatingChatBadge'].forEach(bid => {
            const b = document.getElementById(bid);
            if (b) {
                b.style.display = total > 0 ? (bid === 'sidebarChatBadge' ? 'inline-block' : 'flex') : 'none';
                b.textContent = displayTxt;
            }
        });
    } catch(e) {}
}

// ==========================================
// <i class="fa-solid fa-screwdriver-wrench"></i> Helpers & Utilities
// ==========================================
function setupEventListeners() {
    listen('addEmployeeForm', 'submit', handleAddEmployee);
    listen('editEmployeeForm', 'submit', handleEditEmployee);
    listen('addIncomeForm', 'submit', handleAddIncome);
    listen('addWithdrawalForm', 'submit', handleAddWithdrawal);
    listen('adminChatInput', 'keypress', (e) => { if (e.key === 'Enter') sendAdminMessage(); });

    // Close modals on clicking backdrop overlay
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
        }
    });
}

function toggleSection(id) { document.getElementById(id).classList.toggle('collapsed'); }
function updateDateHeader() {
    const now = new Date();
    setText('currentDateDisplay', now.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
}

function openModal(id) { 
    const el = document.getElementById(id);
    if (el) {
        el.style.display = 'flex';
    } else {
        console.warn(`[Modal] Element with ID "${id}" was not found.`);
    }
}

function closeModal(id) { 
    const el = document.getElementById(id);
    if (el) el.style.display = 'none'; 
}

function openLeaveModal() { 
    loadAllLeaveRequests();
    openModal('leaveModal'); 
}

async function loadAllLeaveRequests(filterStatus = '') {
    const tbody = document.getElementById('leaveTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;">⏳ جاري تحميل طلبات الإجازة...</td></tr>';
    
    let url = '/api/leave-requests';
    if (filterStatus) url += `?status=${filterStatus}`;
    
    try {
        const res = await fetch(url);
        const leaves = await res.json();
        if (!leaves || leaves.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:var(--text-gray);">لا توجد طلبات إجازة مسجلة</td></tr>';
            return;
        }

        tbody.innerHTML = leaves.map(l => {
            const statusBadge = l.status === 'approved'
                ? '<span class="badge-status badge-status-success">مقبول</span>'
                : (l.status === 'rejected' ? '<span class="badge-status badge-status-danger">مرفوض</span>' : '<span class="badge-status badge-status-warning">معلق</span>');
            
            const actions = l.status === 'pending' ? `
                <div style="display:flex; gap:6px; justify-content:center;">
                    <button class="btn btn-success" style="padding:4px 8px; font-size:12px;" onclick="handleLeaveAction(${l.id}, 'approved')"><i class="fa-solid fa-check"></i> قبول</button>
                    <button class="btn btn-danger" style="padding:4px 8px; font-size:12px;" onclick="handleLeaveAction(${l.id}, 'rejected')"><i class="fa-solid fa-xmark"></i> رفض</button>
                </div>
            ` : `<span style="font-size:12px; color:var(--text-gray);">${l.admin_notes || '—'}</span>`;

            const attBtn = l.attachment_path ? `
                <button class="btn btn-secondary" style="padding:3px 8px; font-size:11px; margin-top:3px;" onclick="previewAdminDoc('${l.attachment_path}', 'مرفق إجازة: ${l.employee_name}')">
                    <i class="fa-solid fa-paperclip"></i> السكليف
                </button>
            ` : '';

            return `
                <tr>
                    <td style="font-weight:700;">${l.employee_name || 'موظف'} <span style="font-size:11px; color:var(--text-gray); font-weight:normal;">(${l.section_name || 'عام'})</span></td>
                    <td><span class="badge-status badge-status-info">${l.leave_type || 'إجازة اعتيادية'}</span></td>
                    <td dir="ltr" style="font-size:12px;">${l.start_date || '---'} ➔ ${l.end_date || '---'}</td>
                    <td><strong>${l.days_count || 1}</strong> يوم</td>
                    <td style="font-size:12px; max-width:180px;">${l.reason || 'بدون تفاصيل'} ${attBtn}</td>
                    <td>${statusBadge}</td>
                    <td>${actions}</td>
                </tr>
            `;
        }).join('');
    } catch(e) {
        console.error('Error loading leave requests:', e);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--danger); padding:15px;">❌ تعذر تحميل البيانات</td></tr>';
    }
}

// ==========================================
// 📂 Employee Documents & Sick Leaves Management
// ==========================================
let currentDocStatusFilter = '';

function setDocStatusFilter(st) {
    currentDocStatusFilter = st;
    loadAdminDocuments();
}

function openDocumentsModal() {
    const s = document.getElementById('docAdminEmpFilter');
    if (s && employees) {
        const cur = s.value;
        s.innerHTML = '<option value="">جميع الموظفين</option>' + employees.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
        s.value = cur;
    }
    loadAdminDocuments();
    openModal('documentsModal');
}

async function loadAdminDocuments() {
    const tbody = document.getElementById('adminDocsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;">⏳ جاري تحميل المستندات...</td></tr>';

    const empId = document.getElementById('docAdminEmpFilter')?.value || '';
    const docType = document.getElementById('docAdminTypeFilter')?.value || '';
    
    let url = `/api/admin/documents?`;
    if (currentDocStatusFilter) url += `status=${currentDocStatusFilter}&`;
    if (docType) url += `document_type=${docType}&`;
    if (empId) url += `employee_id=${empId}`;

    try {
        const res = await fetch(url);
        const docs = await res.json();
        
        if (!docs || docs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:25px; color:var(--text-gray);">لا توجد مستندات مسجلة</td></tr>';
            return;
        }

        const docTypesMap = {
            'sick_leave': { label: 'إجازة مرضية / سكليف', icon: '🩺', color: '#ef4444' },
            'national_id': { label: 'هوية / إقامة', icon: '🪪', color: '#3b82f6' },
            'driving_license': { label: 'رخصة قيادة', icon: '🚗', color: '#10b981' },
            'expense_invoice': { label: 'فاتورة / مصروفات', icon: '🧾', color: '#f59e0b' },
            'certificate': { label: 'شهادة تدريبية', icon: '📜', color: '#8b5cf6' },
            'other': { label: 'مستند رسمي', icon: '📝', color: '#64748b' }
        };

        tbody.innerHTML = docs.map(d => {
            const meta = docTypesMap[d.document_type] || docTypesMap['other'];
            const statusBadge = d.status === 'approved'
                ? '<span class="badge-status badge-status-success">معتمد</span>'
                : (d.status === 'rejected' ? '<span class="badge-status badge-status-danger">مرفوض</span>' : '<span class="badge-status badge-status-warning">قيد المراجعة</span>');

            const isImage = (d.mime_type && d.mime_type.startsWith('image')) || d.file_path.match(/\.(jpg|jpeg|png|webp|gif)$/i);
            const safeTitle = (d.title || '').replace(/'/g, "\\'");
            const previewBtn = `
                <button class="btn btn-secondary" style="padding:4px 10px; font-size:12px;" onclick="previewAdminDoc('${d.file_path}', '${safeTitle}', '${d.mime_type || ''}')">
                    <i class="${isImage ? 'fa-solid fa-image' : 'fa-solid fa-file-pdf'}"></i> معاينة
                </button>
            `;

            const actions = d.status === 'pending' ? `
                <div style="display:flex; gap:6px; justify-content:center;">
                    <button class="btn btn-success" style="padding:4px 8px; font-size:12px;" onclick="handleDocumentAction(${d.id}, 'approved')"><i class="fa-solid fa-check"></i> اعتماد</button>
                    <button class="btn btn-danger" style="padding:4px 8px; font-size:12px;" onclick="handleDocumentAction(${d.id}, 'rejected')"><i class="fa-solid fa-xmark"></i> رفض</button>
                </div>
            ` : `
                <div style="font-size:12px; color:var(--text-gray); display:flex; align-items:center; justify-content:center; gap:6px;">
                    <span>${d.admin_notes || '—'}</span>
                    <button style="background:none; border:none; color:#cbd5e1; cursor:pointer; font-size:11px;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#cbd5e1'" onclick="deleteAdminDocument(${d.id})" title="حذف">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;

            return `
                <tr>
                    <td style="font-weight:700;">${d.employee_name || 'موظف'} <span style="font-size:11px; color:var(--text-gray); font-weight:normal;">(${d.section_name || 'عام'})</span></td>
                    <td><span class="badge-status" style="background:#f1f5f9; color:${meta.color}; font-weight:700;">${meta.icon} ${meta.label}</span></td>
                    <td>
                        <div style="font-weight:700; font-size:13px;">${d.title}</div>
                        ${d.notes ? `<div style="font-size:11.5px; color:var(--text-gray);">${d.notes}</div>` : ''}
                    </td>
                    <td>${previewBtn}</td>
                    <td dir="ltr" style="font-size:12px;">${new Date(d.created_at || Date.now()).toLocaleDateString('en-GB')}</td>
                    <td>${statusBadge}</td>
                    <td>${actions}</td>
                </tr>
            `;
        }).join('');

    } catch (e) {
        console.error('Error loading admin docs:', e);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--danger); padding:15px;">❌ تعذر تحميل المستندات</td></tr>';
    }
}

async function handleDocumentAction(id, status) {
    const note = prompt(status === 'rejected' ? 'سبب رفض المستند (اختياري):' : 'ملاحظة للإدارة والموظف (مثال: تم اعتماد التقرير الطبي):');
    if (status === 'rejected' && note === null) return;
    try {
        const res = await fetch(`/api/admin/documents/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, admin_notes: note || '' })
        });
        if (res.ok) {
            loadAdminDocuments();
            loadPendingRequests();
        }
    } catch (e) {
        alert('حدث خطأ في تحديث حالة المستند');
    }
}

async function deleteAdminDocument(id) {
    if (!confirm('هل تريد حذف هذا المستند نهائياً؟')) return;
    try {
        const res = await fetch(`/api/employee/documents/${id}`, { method: 'DELETE' });
        if (res.ok) loadAdminDocuments();
    } catch (e) {}
}

function previewAdminDoc(filePath, title, mimeType) {
    const titleEl = document.getElementById('adminDocPreviewTitle');
    const bodyEl = document.getElementById('adminDocPreviewBody');
    const dlBtn = document.getElementById('adminDocDownloadBtn');

    if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-file"></i> ${title || 'معاينة المستند'}`;
    if (dlBtn) dlBtn.href = filePath;

    const isImage = (mimeType && mimeType.startsWith('image')) || filePath.match(/\.(jpg|jpeg|png|webp|gif)$/i);

    if (isImage) {
        bodyEl.innerHTML = `<img src="${filePath}" style="max-width:100%; max-height:65vh; border-radius:10px; object-fit:contain; box-shadow:0 10px 30px rgba(0,0,0,0.5);">`;
    } else {
        bodyEl.innerHTML = `
            <div style="padding:40px 20px;">
                <i class="fa-solid fa-file-pdf" style="font-size:52px; color:#ef4444; margin-bottom:15px; display:block;"></i>
                <div style="font-size:16px; font-weight:700; color:#ffffff; margin-bottom:15px;">ملف تقرير طبي / مستند PDF</div>
                <a href="${filePath}" target="_blank" class="btn btn-primary" style="display:inline-block; padding:10px 20px; font-size:13px; text-decoration:none;">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i> فتح في نافذة كاملة
                </a>
            </div>
        `;
    }

    openModal('docAdminPreviewModal');
}
function backupDatabase() { openModal('backupModal'); }
function downloadDbBackup() { window.location.href = '/api/backup'; }

async function uploadAndRestoreDatabase(input) {
    const file = input.files[0];
    if (!file) return;

    if (!confirm(`<i class="fa-solid fa-triangle-exclamation"></i> تحذير مهم:\nهل أنت متأكد من استعادة قاعدة البيانات من الملف (${file.name})؟\nسيتم استبدال البيانات الحالية على السيرفر بالبيانات الموجودة في هذا الملف واسترجاع كافة سجلات الموظفين والدخل.`)) {
        input.value = '';
        return;
    }

    const formData = new FormData();
    formData.append('backup_file', file);

    try {
        if (typeof showToast === 'function') showToast('⏳ جاري رفع واستعادة قاعدة البيانات...', 'info');
        const res = await fetch('/api/backup/restore', {
            method: 'POST',
            body: formData
        });
        const result = await res.json();
        if (res.ok) {
            alert('🎉 ' + result.message);
            closeModal('backupModal');
            location.reload();
        } else {
            alert('خطأ: ' + (result.message || 'فشلت عملية الاستعادة'));
        }
    } catch (e) {
        console.error(e);
        alert('حدث خطأ أثناء الاتصال بالسيرفر');
    } finally {
        input.value = '';
    }
}
function checkNotifications() { fetch('/api/notifications').then(r => r.json()).then(d => { if(d.total > 0 && d.total !== document.getElementById('notifBadgeDot').innerText) { /* old logic replaced */ } }); }

let unreadAdminCount = 0;
let isFirstNotifLoad = true;

function playNotificationSound() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime); // Note A5
        osc.frequency.setValueAtTime(1760, ctx.currentTime + 0.1); // Note A6
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.02);
        gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
    } catch(e) {}
}

function toggleAdminNotif() {
    const dropdown = document.getElementById('adminNotifDropdown');
    if (!dropdown) return;
    const isOpening = dropdown.style.display !== 'block';
    dropdown.style.display = isOpening ? 'block' : 'none';
    if (isOpening) {
        loadAdminNotifications();
    }
}

async function loadAdminNotifications() {
    try {
        const res = await fetch(`/api/sys_notifications?recipient_type=admin`);
        const notifs = await res.json();
        
        const list = document.getElementById('adminNotifList');
        const newUnreadCount = notifs.filter(n => n.is_read === 0).length;
        
        if (!isFirstNotifLoad && newUnreadCount > unreadAdminCount) {
            playNotificationSound();
        }
        unreadAdminCount = newUnreadCount;
        isFirstNotifLoad = false;
        
        const badge = document.getElementById('notifBadgeDot');
        if (unreadAdminCount > 0) {
            badge.style.display = 'flex';
            badge.innerText = unreadAdminCount > 9 ? '9+' : unreadAdminCount;
        } else {
            badge.style.display = 'none';
        }

        if (notifs.length === 0) {
            list.innerHTML = '<div style="padding: 15px; text-align: center; color: var(--text-gray); font-size: 12px;">لا توجد إشعارات</div>';
            return;
        }

        list.innerHTML = notifs.map(n => `
            <div style="padding: 15px; border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: background 0.2s; background: ${n.is_read === 0 ? '#eff6ff' : 'transparent'};" onclick="markAdminRead(${n.id}, this)">
                <div style="font-weight: 700; font-size: 13px; color: ${n.type==='warning'?'#d97706':'#1e293b'}; margin-bottom: 4px;">${n.title} ${n.is_read===0?'<i class="fa-solid fa-circle" style="color: #ef4444;"></i>':''}</div>
                <div style="font-size: 12px; color: #64748b;">${n.message}</div>
                <div style="font-size: 10px; color: #94a3b8; margin-top: 5px; text-align: left;">${new Date(n.created_at).toLocaleString('en-GB')}</div>
            </div>
        `).join('');
    } catch(e) {}
}

async function markAdminRead(id, element) {
    if(!element.innerHTML.includes('<i class="fa-solid fa-circle" style="color: #ef4444;"></i>')) return;
    try {
        await fetch(`/api/sys_notifications/${id}/read`, { method: 'PUT' });
        element.style.background = 'transparent';
        element.innerHTML = element.innerHTML.replace('<i class="fa-solid fa-circle" style="color: #ef4444;"></i>', '');
        
        unreadAdminCount--;
        const badge = document.getElementById('notifBadgeDot');
        if (unreadAdminCount > 0) {
            badge.innerText = unreadAdminCount > 9 ? '9+' : unreadAdminCount;
        } else {
            badge.style.display = 'none';
        }
    } catch(e) {}
}

async function markAllAdminRead() {
    try {
        await fetch(`/api/sys_notifications/read_all`, {
           method: 'PUT', headers: {'Content-Type': 'application/json'},
           body: JSON.stringify({ recipient_type: 'admin' })
        });
        loadAdminNotifications();
    } catch(e) {}
}

// Close dropdown on outside click
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('adminNotifDropdown');
    const wrapper = document.querySelector('.notif-wrapper');
    if (dropdown && wrapper && dropdown.style.display === 'block' && !wrapper.contains(e.target)) {
        dropdown.style.display = 'none';
    }
});

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
const updateSectionSelects = () => { 
    ['empSection', 'editEmpSection', 'addEmpSection'].forEach(sid => { 
        const s = document.getElementById(sid); 
        if(s) {
            const cur = s.value;
            s.innerHTML = sections.map(sec => `<option value="${sec.id}">${sec.name}</option>`).join('');
            if (cur && sections.some(sec => sec.id == cur)) s.value = cur;
        }
    }); 
};
const updateBankSelects = () => {
    ['empBank', 'editEmpBank', 'addEmpBank'].forEach(bid => {
        const s = document.getElementById(bid);
        if (s && banks && banks.length > 0) {
            const currentVal = s.value;
            s.innerHTML = banks.map(b => `<option value="${b.name}">${b.name}</option>`).join('');
            if (currentVal && banks.some(b => b.name === currentVal)) {
                s.value = currentVal;
            }
        }
    });
};
async function loadBanks() {
    try {
        const res = await fetch('/api/banks');
        banks = await res.json();
        updateBankSelects();
    } catch (e) {
        console.warn('Banks load error:', e);
    }
}
const getFormData = (id) => Object.fromEntries(new FormData(document.getElementById(id)));

// --- Excel Import Salaries (Admin Home) ---
function openImportSalariesModal() {
    const resDiv = document.getElementById('importSalariesResult');
    if (resDiv) {
        resDiv.style.display = 'none';
        resDiv.innerHTML = '';
    }
    const fileInput = document.getElementById('importSalariesFileInput');
    if (fileInput) fileInput.value = '';
    const modal = document.getElementById('importSalariesModal');
    if (modal) modal.style.display = 'flex';
}

async function importSalariesFromExcel(input) {
    const file = input.files[0];
    if (!file) return;
    const resultDiv = document.getElementById('importSalariesResult');
    if (resultDiv) {
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = '<div style="color:var(--primary); font-weight:700; text-align:center; padding:12px;"><i class="fa-solid fa-spinner fa-spin"></i> جاري قراءة ومزامنة مسير الرواتب...</div>';
    }

    const fd = new FormData();
    fd.append('file', file);
    try {
        const res = await fetch('/api/employees/import-salaries', { method: 'POST', body: fd });
        const result = await res.json();
        if (result.success || res.ok) {
            if (resultDiv) {
                resultDiv.innerHTML = `
                    <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:14px;">
                        <div style="color:#166534; font-weight:800; font-size:15px; margin-bottom:8px;"><i class="fa-solid fa-circle-check"></i> ${result.message || 'تمت مزامنة مسير الرواتب بنجاح'}</div>
                        <div style="font-size:13px; color:#374151;">
                            تم تحديث: <strong>${result.updatedCount || 0}</strong> موظف
                            ${result.addedCount > 0 ? ` | تم إضافة: <strong>${result.addedCount}</strong> موظف جديد` : ''}
                        </div>
                    </div>`;
            }
            if (typeof smartAlert === 'function') {
                smartAlert('✅ ' + (result.message || 'تم استيراد مسير الرواتب بنجاح'));
            }
            loadData();
        } else {
            if (resultDiv) {
                resultDiv.innerHTML = `<div style="background:#fef2f2; border:1px solid #fecaca; border-radius:10px; padding:14px; color:#b91c1c; font-weight:700;"><i class="fa-solid fa-circle-xmark"></i> ${result.message || 'فشل استيراد مسير الرواتب'}</div>`;
            }
        }
    } catch(e) {
        if (resultDiv) {
            resultDiv.innerHTML = `<div style="background:#fef2f2; border:1px solid #fecaca; border-radius:10px; padding:14px; color:#b91c1c;"><i class="fa-solid fa-circle-xmark"></i> تعذر الاتصال بالسيرفر</div>`;
        }
    } finally {
        input.value = '';
    }
}

// Fallbacks for compatibility
function openImportEmployeesModal() {
    openImportSalariesModal();
}
async function importEmployeesFromExcel(input) {
    return importSalariesFromExcel(input);
}

function downloadImportTemplate() {
    const rows = [
        ['اسم', 'قسم', 'هدف', 'راتب', 'مستخدم', 'كلمة المرور', 'بنك'],
        ['محمد علي', 'مكانيكا', '5000', '3000', 'mohammed', 'pass123', 'الاهلي'],
        ['فهد أحمد', 'كهرباء', '4000', '2500', 'fahad', 'pass123', 'الراجحي'],
        ['خالد سعد', 'كشف', '6000', '3500', '', '', 'كاش'],
    ];
    const csvContent = '\uFEFF' + rows.map(r => r.join('\t')).join('\n');
    const blob = new Blob([csvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'نموذج_استيراد_موظفين.xls';
    a.click();
    URL.revokeObjectURL(url);
}

function toggleMobileSidebar(forceState) {
    const sb = document.getElementById('adminSidebar') || document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (!sb) return;
    
    if (typeof forceState === 'boolean') {
        if (forceState) {
            sb.classList.add('open');
            if (overlay) overlay.classList.add('open');
        } else {
            sb.classList.remove('open');
            if (overlay) overlay.classList.remove('open');
        }
    } else {
        sb.classList.toggle('open');
        if (overlay) overlay.classList.toggle('open');
    }
}

function toggleSidebarCollapse() {
    const sb = document.getElementById('adminSidebar') || document.querySelector('.sidebar');
    const layout = document.querySelector('.app-layout');
    if (!sb) return;

    const isCollapsed = sb.classList.toggle('collapsed');
    if (layout) layout.classList.toggle('sidebar-collapsed', isCollapsed);
    localStorage.setItem('adminSidebarCollapsed', isCollapsed ? '1' : '0');

    const toggleBtnIcon = document.querySelector('#desktopSidebarToggle i');
    if (toggleBtnIcon) {
        toggleBtnIcon.className = isCollapsed ? 'fa-solid fa-angles-left' : 'fa-solid fa-angles-right';
    }
}

function initSidebarCollapseState() {
    const saved = localStorage.getItem('adminSidebarCollapsed');
    if (saved === '1' && window.innerWidth > 768) {
        const sb = document.getElementById('adminSidebar') || document.querySelector('.sidebar');
        const layout = document.querySelector('.app-layout');
        if (sb) sb.classList.add('collapsed');
        if (layout) layout.classList.add('sidebar-collapsed');
        const toggleBtnIcon = document.querySelector('#desktopSidebarToggle i');
        if (toggleBtnIcon) {
            toggleBtnIcon.className = 'fa-solid fa-angles-left';
        }
    }
}

// Global window mappings
window.openImportSalariesModal = openImportSalariesModal;
window.importSalariesFromExcel = importSalariesFromExcel;
window.openImportEmployeesModal = openImportEmployeesModal;
window.importEmployeesFromExcel = importEmployeesFromExcel;
window.downloadImportTemplate = downloadImportTemplate;
window.openModal = openModal;
window.closeModal = closeModal;
window.toggleMobileSidebar = toggleMobileSidebar;
window.toggleSidebarCollapse = toggleSidebarCollapse;

// Initialize!
init();

