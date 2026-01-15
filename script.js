// ===== Load all employees =====
if (window.location.pathname.endsWith("admin.html")) {
  loadSectionsSummary();
  loadEmployees();
}

function loadEmployees() {
  fetch("/api/employees")
    .then((res) => res.json())
    .then((employees) => {
      const tbody = document.querySelector("#employeesTable tbody");
      tbody.innerHTML = "";
      employees.forEach((emp) => {
        const remaining = emp.target - emp.total_income;
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${emp.id}</td>
          <td><input value="${emp.name}" id="name_${emp.id}"></td>
          <td>${emp.section_name || "-"}</td>
          <td><input type="number" value="${emp.target}" id="target_${emp.id}"></td>
          <td>${emp.total_income}</td>
          <td>${remaining > 0 ? remaining : "🎯 تم الهدف"}</td>
          <td><input value="${emp.username || ''}" id="user_${emp.id}"></td>
          <td><input value="${emp.password || ''}" id="pass_${emp.id}" type="password"></td>
          <td><button onclick="updateEmployee(${emp.id})">💾 حفظ</button></td>
        `;
        tbody.appendChild(tr);
      });
    });
}
// ===========================================
// ===== دالة رفع ملف الرواتب (Excel) =====
// ===========================================
async function uploadSalariesFile() {
  const fileInput = document.getElementById('salariesFile');
  const messageDiv = document.getElementById('uploadMessage');
  const file = fileInput.files[0];

  if (!file) {
    messageDiv.style.color = 'red';
    messageDiv.textContent = 'الرجاء اختيار ملف Excel أولاً.';
    return;
  }

  messageDiv.style.color = 'blue';
  messageDiv.textContent = 'جاري رفع ومعالجة الملف... قد يستغرق الأمر بعض الوقت.';

  const formData = new FormData();
  formData.append('salariesFile', file);

  try {
    const response = await fetch('/api/upload-salaries', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    if (response.ok) {
      messageDiv.style.color = 'green';
      messageDiv.textContent = `✅ ${result.message} (تم تحديث ${result.details.updatedEmployees} موظف وإضافة ${result.details.totalWithdrawalsAdded} سحب).`;
      if (result.details.errors.length > 0) {
        messageDiv.textContent += ` تنبيه: ${result.details.errors.length} موظف لم يتم العثور عليهم: ${result.details.errors.join(', ')}`;
        console.error('Errors:', result.details.errors);
      }
      // إعادة تحميل بيانات الموظفين لتحديث الراتب الأساسي
      loadEmployees();
      loadSectionsSummary(); // للتأكد من تحديث ملخص الأقسام
    } else {
      messageDiv.style.color = 'red';
      messageDiv.textContent = `❌ خطأ في المعالجة: ${result.message || 'حدث خطأ غير معروف'}`;
      console.error('Upload Error:', result.error);
    }
  } catch (error) {
    messageDiv.style.color = 'red';
    messageDiv.textContent = '❌ فشل الاتصال بالخادم أو حدث خطأ غير متوقع.';
    console.error('Fetch Error:', error);
  }
}

// ===== Load sections summary =====
function loadSectionsSummary() {
  fetch("/api/sections-summary")
    .then((res) => res.json())
    .then((data) => {
      const div = document.getElementById("sectionsSummary");
      div.innerHTML = `<h3>ملخص الأقسام</h3>`;
      let totalAll = 0;
      if (Array.isArray(data)) {
        data.forEach((s) => {
          div.innerHTML += `<p><b>${s.section_name}:</b> ${s.total_income} ريال</p>`;
          totalAll += s.total_income;
        });
      }
      div.innerHTML += `<hr><p><b>إجمالي جميع الأقسام:</b> ${totalAll} ريال</p>`;
    });
}

// ===== Update employee info =====
function updateEmployee(id) {
  const name = document.getElementById(`name_${id}`).value;
  const target = parseFloat(document.getElementById(`target_${id}`).value);
  const username = document.getElementById(`user_${id}`).value;
  const password = document.getElementById(`pass_${id}`).value;

  fetch(`/api/employees/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, target, username, password }),
  }).then(() => {
    alert("تم تحديث بيانات الموظف");
    loadEmployees();
  });
}


