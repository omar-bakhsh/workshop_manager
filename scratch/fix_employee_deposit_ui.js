const fs = require('fs');
let content = fs.readFileSync('employee.html', 'utf8');

// 1. تنظيف الخطأ السابق وإضافة البطاقة في مكانها الصحيح بالـ HTML
content = content.replace('<!-- المؤسسة -->', ''); // إزالة الخطأ لو وجد
const targetCard = '<!-- الراتب المتبقي -->';
const newDepositCard = `        <!-- إيداع المؤسسة -->
        <div class="stat-card">
          <div class="stat-header">
            <div class="stat-icon info">🏢</div>
          </div>
          <div class="stat-value" id="foundationDeposit">0</div>
          <div class="stat-label">إيداع المؤسسة</div>
        </div>

        <!-- الراتب المتبقي -->`;

if (!content.includes('id="foundationDeposit"') && content.includes(targetCard)) {
    content = content.replace(targetCard, newDepositCard);
}

// 2. تحديث الـ JS لتعبئة القيمة
const oldJsLine = "document.getElementById('totalWithdrawals').textContent = excelWithdrawals.toLocaleString('en-US');";
const newJsLines = "document.getElementById('totalWithdrawals').textContent = excelWithdrawals.toLocaleString('en-US');\n        document.getElementById('foundationDeposit').textContent = (employeeData.deposit_amount || 0).toLocaleString('en-US');";

if (content.includes(oldJsLine)) {
    content = content.replace(oldJsLine, newJsLines);
}

fs.writeFileSync('employee.html', content, 'utf8');
console.log("✅ تمت إضافة بطاقة الإيداع وتصحيح الكود بنجاح!");
