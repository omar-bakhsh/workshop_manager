const fs = require('fs');
let content = fs.readFileSync('admin.html', 'utf8');

// 1. إضافة حقول الإدخال في Modal التعديل
const targetEditGroup = '<div class="form-group">\n                            <label>الراتب الأساسي</label>\n                            <input type="number" id="editEmpSalary" step="0.01">\n                        </div>';

const newEditGroups = `                        <div class="form-group">
                            <label>الراتب الأساسي</label>
                            <input type="number" id="editEmpSalary" step="0.01">
                        </div>
                        <div class="form-group">
                            <label>التارقت (Excel)</label>
                            <input type="number" id="editEmpTargetExcel" step="0.01">
                        </div>
                        <div class="form-group">
                            <label>إيداع المؤسسة</label>
                            <input type="number" id="editEmpDeposit" step="0.01">
                        </div>
                        <div class="form-group">
                            <label>إجمالي السحوبات (Excel)</label>
                            <input type="number" id="editEmpWithdrawalsExcel" step="0.01">
                        </div>`;

if (content.includes(targetEditGroup)) {
    content = content.replace(targetEditGroup, newEditGroups);
}

// 2. تحديث دالة openEditModal لتعبئة البيانات
const oldOpen = "document.getElementById('editEmpSalary').value = emp.base_salary || 0;";
const newOpen = "document.getElementById('editEmpSalary').value = emp.base_salary || 0;\n            document.getElementById('editEmpTargetExcel').value = emp.target_amount || 0;\n            document.getElementById('editEmpDeposit').value = emp.deposit_amount || 0;\n            document.getElementById('editEmpWithdrawalsExcel').value = emp.total_withdrawals || 0;";

if (content.includes(oldOpen)) content = content.replace(oldOpen, newOpen);

// 3. تحديث دالة handleEditEmployee لإرسال البيانات
const oldData = "base_salary: document.getElementById('editEmpSalary').value,";
const newData = "base_salary: document.getElementById('editEmpSalary').value,\n                target_amount: document.getElementById('editEmpTargetExcel').value,\n                deposit_amount: document.getElementById('editEmpDeposit').value,\n                total_withdrawals: document.getElementById('editEmpWithdrawalsExcel').value,";

if (content.includes(oldData)) content = content.replace(oldData, newData);

fs.writeFileSync('admin.html', content, 'utf8');
console.log("✅ تمت تحديث واجهة الإدارة بنجاح!");
