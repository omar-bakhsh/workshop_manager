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

// ===== Load sections summary =====
function loadSectionsSummary() {
  fetch("/api/sections-summary")
    .then((res) => res.json())
    .then((data) => {
      const div = document.getElementById("sectionsSummary");
      div.innerHTML = `<h3>ملخص الأقسام</h3>`;
      data.sections.forEach((s) => {
        div.innerHTML += `<p><b>${s.name}:</b> ${s.total_income} ريال</p>`;
      });
      div.innerHTML += `<hr><p><b>إجمالي جميع الأقسام:</b> ${data.totalAll} ريال</p>`;
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
