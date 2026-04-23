const fs = require('fs');

// 1. تحديث admin.html لإظهار المتبقي الصافي
let adminContent = fs.readFileSync('admin.html', 'utf8');
const oldAdminHeader = '<th>الراتب المتبقي</th>';
const newAdminHeader = '<th>الراتب المتبقي</th>\n                                    <th style="background:#f5f3ff; color:#7c3aed;">المتبقي الصافي (Excel)</th>';

const oldAdminCell = '<td style="font-weight:800; color:${remainingSalary < 0 ? \'var(--danger)\' : \'#b45309\'};">\n                                        ${remainingSalary.toLocaleString(\'en-US\')}\n                                    </td>';
const newAdminCell = `<td style="font-weight:800; color:\${remainingSalary < 0 ? 'var(--danger)' : '#b45309'};">
                                        \${remainingSalary.toLocaleString('en-US')}
                                    </td>
                                    <td style="font-weight:700; color:#6d28d9;">
                                        \${(emp.net_remaining || 0).toLocaleString('en-US')}
                                    </td>`;

if (adminContent.includes(oldAdminHeader)) adminContent = adminContent.replace(oldAdminHeader, newAdminHeader);
if (adminContent.includes(oldAdminCell)) adminContent = adminContent.replace(oldAdminCell, newAdminCell);
fs.writeFileSync('admin.html', adminContent, 'utf8');


// 2. تحديث employee.html لإظهار المتبقي الصافي
let empContent = fs.readFileSync('employee.html', 'utf8');
const targetEmpCard = '<!-- الراتب المتبقي -->';
const netRemainingCard = `        <!-- المتبقي الصافي -->
        <div class="stat-card" style="border-right: 4px solid #7c3aed;">
          <div class="stat-header">
            <div class="stat-icon" style="background:rgba(124, 58, 237, 0.1); color:#7c3aed;">✨</div>
          </div>
          <div class="stat-value" id="netRemaining" style="color:#6d28d9;">0</div>
          <div class="stat-label">المتبقي الصافي (Excel)</div>
        </div>

        <!-- الراتب المتبقي -->`;

if (!empContent.includes('id="netRemaining"') && empContent.includes(targetEmpCard)) {
    empContent = empContent.replace(targetEmpCard, netRemainingCard);
}

const oldEmpJs = "document.getElementById('foundationDeposit').textContent = (employeeData.deposit_amount || 0).toLocaleString('en-US');";
const newEmpJs = "document.getElementById('foundationDeposit').textContent = (employeeData.deposit_amount || 0).toLocaleString('en-US');\n        document.getElementById('netRemaining').textContent = (employeeData.net_remaining || 0).toLocaleString('en-US');";

if (empContent.includes(oldEmpJs)) empContent = empContent.replace(oldEmpJs, newEmpJs);
fs.writeFileSync('employee.html', empContent, 'utf8');

console.log("✅ تمت إضافة المتبقي الصافي لكل الواجهات بنجاح!");
