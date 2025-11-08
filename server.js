// ==========================
// 🧩 إعداد الخادم الأساسي
// ==========================
const express = require("express");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = 3000;

// ==========================
// 🧩 الإعدادات العامة
// ==========================
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(".")); // خدمة الملفات من الدليل الحالي

// ==========================
// 🧩 إعداد قاعدة البيانات
// ==========================
const db = new sqlite3.Database("db.sqlite");

db.serialize(() => {
  // إنشاء الجداول
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT,
      employee_id INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      hidden INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      section_id INTEGER,
      target REAL DEFAULT 0,
      hidden INTEGER DEFAULT 0,
      last_income_update TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER,
      section_id INTEGER,
      amount REAL,
      note TEXT,
      employee_note TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  // إنشاء مستخدم المدير الافتراضي
  db.get("SELECT * FROM users WHERE username = ?", ["admin"], (err, row) => {
    if (!row) {
      db.run(
        "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
        ["admin", "admin123", "admin"]
      );
      console.log("✅ تم إنشاء حساب المدير (username: admin / password: admin123)");
    }
  });

  // إضافة الأقسام الافتراضية إذا لم تكن موجودة
  db.get("SELECT COUNT(*) as count FROM sections", (err, row) => {
    if (row.count === 0) {
      db.run("INSERT INTO sections (name) VALUES (?)", ["مكانيا"]);
      db.run("INSERT INTO sections (name) VALUES (?)", ["كهرباء"]);
      db.run("INSERT INTO sections (name) VALUES (?)", ["كشف"]);
      console.log("✅ تم إنشاء الأقسام الافتراضية");
    }
  });
});

// ==========================
// 🧩 مسارات تسجيل الدخول
// ==========================
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  db.get(
    "SELECT * FROM users WHERE username = ? AND password = ?",
    [username, password],
    (err, user) => {
      if (err) return res.status(500).send(err);
      if (!user) return res.status(401).json({ message: "بيانات الدخول غير صحيحة" });
      res.json(user);
    }
  );
});

// ==========================
// 🧩 إدارة الأقسام
// ==========================
app.get("/api/sections", (req, res) => {
  db.all("SELECT * FROM sections WHERE hidden = 0", (err, rows) => {
    if (err) return res.status(500).send(err);
    res.json(rows);
  });
});

app.post("/api/sections", (req, res) => {
  const { name } = req.body;
  db.run("INSERT INTO sections (name) VALUES (?)", [name], function (err) {
    if (err) return res.status(500).send(err);
    res.json({ id: this.lastID, name });
  });
});

// ==========================
// 🧩 إدارة الموظفين
// ==========================
app.post("/api/employees", (req, res) => {
  const { name, section_id, target, username, password } = req.body;
  db.run(
    "INSERT INTO employees (name, section_id, target) VALUES (?, ?, ?)",
    [name, section_id || null, target],
    function (err) {
      if (err) return res.status(500).send(err);
      const employee_id = this.lastID;
      db.run(
        "INSERT INTO users (username, password, role, employee_id) VALUES (?, ?, ?, ?)",
        [username, password, "employee", employee_id],
        function (err2) {
          if (err2) return res.status(500).send(err2);
          res.json({ id: employee_id, name });
        }
      );
    }
  );
});

// ==========================
// 🧩 بيانات صفحة الموظف - محدث
// ==========================
app.get("/api/employees/:id", (req, res) => {
  const empId = req.params.id;
  
  db.get(
    `SELECT e.*, s.name as section_name 
     FROM employees e 
     LEFT JOIN sections s ON e.section_id = s.id 
     WHERE e.id = ?`,
    [empId],
    (err, emp) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'خطأ في قاعدة البيانات' });
      }
      if (!emp) {
        return res.status(404).json({ error: "الموظف غير موجود" });
      }

      // الحصول على إجمالي الدخل
      db.get(
        `SELECT SUM(amount) as total FROM entries WHERE employee_id = ?`,
        [empId],
        (err2, incomeResult) => {
          if (err2) {
            console.error('Income calculation error:', err2);
            return res.status(500).json({ error: 'خطأ في حساب الدخل' });
          }

          const totalIncome = incomeResult.total || 0;
          const remaining = (emp.target || 0) - totalIncome;

          // الحصول على سجل الدخل
          db.all(
            `SELECT *, 
             CASE WHEN employee_note IS NOT NULL AND employee_note != '' THEN 1 ELSE 0 END as has_employee_note
             FROM entries WHERE employee_id = ? ORDER BY created_at DESC`, 
            [empId], 
            (err3, entries) => {
              if (err3) {
                console.error('Entries fetch error:', err3);
                return res.status(500).json({ error: 'خطأ في جلب سجل الدخل' });
              }
              
              // الحصول على آخر دخل مضاف
              const lastEntry = entries.length > 0 ? entries[0] : null;
              
              res.json({
                id: emp.id,
                name: emp.name,
                section_name: emp.section_name,
                target: emp.target || 0,
                totalIncome: totalIncome,
                remaining: remaining,
                entries: entries || [],
                lastEntry: lastEntry ? {
                  amount: lastEntry.amount,
                  date: lastEntry.created_at,
                  note: lastEntry.note
                } : null
              });
            }
          );
        }
      );
    }
  );
});

// ==========================
// 🧩 إضافة ملاحظة الموظف على الدخل
// ==========================
app.post("/api/entries/:id/employee-note", (req, res) => {
  const { employee_note } = req.body;
  const updated_at = new Date().toISOString();
  
  db.run(
    "UPDATE entries SET employee_note = ?, updated_at = ? WHERE id = ?",
    [employee_note, updated_at, req.params.id],
    function (err) {
      if (err) return res.status(500).send(err);
      res.json({ success: true });
    }
  );
});

// ==========================
// 🧩 عرض جميع الموظفين
// ==========================
app.get("/api/employees", (req, res) => {
  db.all(
    `
    SELECT e.*, s.name AS section_name,
      (SELECT IFNULL(SUM(amount),0) FROM entries WHERE employee_id = e.id) AS total_income,
      (SELECT created_at FROM entries WHERE employee_id = e.id ORDER BY created_at DESC LIMIT 1) AS last_income_date
    FROM employees e
    LEFT JOIN sections s ON e.section_id = s.id
    WHERE e.hidden = 0
    `,
    [],
    (err, rows) => {
      if (err) return res.status(500).send(err);
      res.json(rows);
    }
  );
});

// ==========================
// 🧩 ملخص الأقسام
// ==========================
app.get("/api/sections-summary", (req, res) => {
  db.all(
    `
    SELECT s.id, s.name,
      (SELECT IFNULL(SUM(amount),0) FROM entries WHERE section_id = s.id) AS total_income
    FROM sections s
    WHERE s.hidden = 0
    `,
    [],
    (err, rows) => {
      if (err) return res.status(500).send(err);
      const totalAll = rows.reduce((sum, s) => sum + s.total_income, 0);
      res.json({ sections: rows, totalAll });
    }
  );
});

// ==========================
// 🧩 تعديل بيانات الموظف
// ==========================
app.put("/api/employees/:id", (req, res) => {
  const { name, target, username, password } = req.body;
  const id = req.params.id;

  db.run(
    "UPDATE employees SET name=?, target=? WHERE id=?",
    [name, target, id],
    (err) => {
      if (err) return res.status(500).send(err);

      db.run(
        "UPDATE users SET username=?, password=? WHERE employee_id=?",
        [username, password, id],
        (err2) => {
          if (err2) return res.status(500).send(err2);
          res.json({ success: true });
        }
      );
    }
  );
});

// ==========================
// 🧩 تعديل أو حذف دخل موظف (للمدير فقط)
// ==========================
app.put("/api/entries/:id", (req, res) => {
  const { amount, note } = req.body;
  const updated_at = new Date().toISOString();
  
  db.run(
    "UPDATE entries SET amount=?, note=?, updated_at=? WHERE id=?",
    [amount, note, updated_at, req.params.id],
    function (err) {
      if (err) return res.status(500).send(err);
      res.json({ success: true });
    }
  );
});

app.delete("/api/entries/:id", (req, res) => {
  db.run("DELETE FROM entries WHERE id=?", [req.params.id], (err) => {
    if (err) return res.status(500).send(err);
    res.json({ success: true });
  });
});

// ==========================
// 🧩 مسار جديد: إضافة دخل للموظف (للمدير فقط)
// ==========================
app.post("/api/employees/:id/income", (req, res) => {
  const employee_id = req.params.id;
  const { amount, note } = req.body;
  const created_at = new Date().toISOString();
  const updated_at = created_at;

  // الحصول على section_id للموظف
  db.get("SELECT section_id FROM employees WHERE id = ?", [employee_id], (err, emp) => {
    if (err) return res.status(500).send(err);
    if (!emp) return res.status(404).send("Employee not found");

    const section_id = emp.section_id;

    db.run(
      "INSERT INTO entries (employee_id, section_id, amount, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      [employee_id, section_id, amount, note, created_at, updated_at],
      function (err) {
        if (err) return res.status(500).send(err);
        
        // تحديث تاريخ آخر دخل للموظف
        db.run(
          "UPDATE employees SET last_income_update = ? WHERE id = ?",
          [created_at, employee_id],
          (err2) => {
            if (err2) console.error("Error updating last_income_update:", err2);
          }
        );
        
        res.json({ id: this.lastID, success: true });
      }
    );
  });
});

// ==========================
// 🧩 حذف موظف
// ==========================
app.delete("/api/employees/:id", (req, res) => {
  const id = req.params.id;
  
  db.run("DELETE FROM employees WHERE id=?", [id], (err) => {
    if (err) return res.status(500).send(err);
    
    db.run("DELETE FROM users WHERE employee_id=?", [id], (err2) => {
      if (err2) return res.status(500).send(err2);
      res.json({ success: true });
    });
  });
});

// ==========================
// 🧩 تقديم صفحات HTML
// ==========================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

app.get("/admin.html", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

app.get("/employee.html", (req, res) => {
  res.sendFile(path.join(__dirname, "employee.html"));
});

app.get("/login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

// ==========================
// 🧩 تشغيل السيرفر
// ==========================
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔑 Admin login: username: admin / password: admin123`);
});