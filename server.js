// ==========================
// 🧩 استيراد المكتبات المطلوبة
// ==========================
const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// ==========================
// 🧩 الإعدادات العامة
// ==========================
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.')); // خدمة الملفات من المجلد الحالي

// ==========================
// 🧩 إعداد قاعدة البيانات
// ==========================
console.log('📁 محاولة فتح قاعدة البيانات...');
const dbPath = path.join(__dirname, 'db.sqlite');
console.log('📍 مسار قاعدة البيانات:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ خطأ في فتح قاعدة البيانات:', err.message);
        process.exit(1); // إيقاف التطبيق إذا فشل الاتصال بقاعدة البيانات
    } else {
        console.log('✅ تم الاتصال بقاعدة البيانات SQLite بنجاح');
        initializeDatabase();
    }
});

// ==========================
// 🧩 تهيئة قاعدة البيانات
// ==========================
function initializeDatabase() {
    console.log('🔧 جاري تهيئة قاعدة البيانات...');
    
    // إنشاء الجداول
    const tables = [
        `CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            role TEXT,
            employee_id INTEGER
        )`,
        `CREATE TABLE IF NOT EXISTS sections (
            id INTEGER PRIMARY KEY,
            name TEXT,
            hidden INTEGER DEFAULT 0
        )`,
        `CREATE TABLE IF NOT EXISTS employees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            section_id INTEGER,
            target REAL DEFAULT 0,
            hidden INTEGER DEFAULT 0,
            last_income_update TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER,
            section_id INTEGER,
            amount REAL,
            note TEXT,
            employee_note TEXT,
            created_at TEXT,
            updated_at TEXT
        )`
    ];

    let completed = 0;
    tables.forEach((sql, index) => {
        db.run(sql, (err) => {
            if (err) {
                console.error(`❌ خطأ في إنشاء الجدول ${index + 1}:`, err);
            } else {
                console.log(`✅ تم إنشاء/التأكد من الجدول ${index + 1}`);
            }
            completed++;
            
            // عندما تنتهي جميع الجداول، نقوم بإضافة البيانات الافتراضية
            if (completed === tables.length) {
                addDefaultData();
                // إضافة الموظفين التجريبيين بعد البيانات الافتراضية
                setTimeout(addSampleEmployees, 1000);
            }
        });
    });
}

// ==========================
// 🧩 إضافة البيانات الافتراضية
// ==========================
function addDefaultData() {
    console.log('📝 جاري إضافة البيانات الافتراضية...');
    
    // إضافة الأقسام الثابتة
    const defaultSections = [
        { id: 1, name: "مكانيكا" },
        { id: 2, name: "كهرباء" },
        { id: 3, name: "كشف" },
        { id: 4, name: "ادارة" }
    ];

    defaultSections.forEach(section => {
        db.get("SELECT * FROM sections WHERE id = ?", [section.id], (err, row) => {
            if (err) {
                console.error(`❌ خطأ في التحقق من قسم ${section.name}:`, err);
            } else if (!row) {
                db.run("INSERT INTO sections (id, name) VALUES (?, ?)", [section.id, section.name], function(err) {
                    if (err) {
                        console.error(`❌ خطأ في إنشاء قسم ${section.name}:`, err);
                    } else {
                        console.log(`✅ تم إنشاء قسم: ${section.name}`);
                    }
                });
            }
        });
    });

    // إضافة مستخدم المدير
    db.get("SELECT * FROM users WHERE username = ?", ["admin"], (err, row) => {
        if (err) {
            console.error('❌ خطأ في التحقق من المدير:', err);
        } else if (!row) {
            db.run(
                "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
                ["admin", "admin123", "admin"],
                function(err) {
                    if (err) {
                        console.error('❌ خطأ في إنشاء حساب المدير:', err);
                    } else {
                        console.log("✅ تم إنشاء حساب المدير (admin / admin123)");
                    }
                }
            );
        } else {
            console.log("✅ حساب المدير موجود بالفعل");
        }
    });
}

// ==========================
// 🧩 إضافة موظفين تجريبيين
// ==========================
function addSampleEmployees() {
    console.log('👥 جاري إضافة موظفين تجريبيين...');
    
    const sampleEmployees = [
        { name: "وسن", section_id: 1, target: 5000, username: "wesam", password: "123456" },
        { name: "أحمد", section_id: 2, target: 7000, username: "ahmed", password: "123456" },
        { name: "فاطمة", section_id: 3, target: 3000, username: "fatima", password: "123456" },
        { name: "نادر", section_id: 4, target: 4000, username: "nadir", password: "102030" }
    ];

    sampleEmployees.forEach(emp => {
        db.get("SELECT * FROM users WHERE username = ?", [emp.username], (err, row) => {
            if (err) {
                console.error(`❌ خطأ في التحقق من الموظف ${emp.name}:`, err);
            } else if (!row) {
                // إضافة الموظف
                db.run(
                    "INSERT INTO employees (name, section_id, target) VALUES (?, ?, ?)",
                    [emp.name, emp.section_id, emp.target],
                    function(err) {
                        if (err) {
                            console.error(`❌ خطأ في إضافة الموظف ${emp.name}:`, err);
                        } else {
                            const employee_id = this.lastID;
                            // إضافة حساب المستخدم
                            db.run(
                                "INSERT INTO users (username, password, role, employee_id) VALUES (?, ?, ?, ?)",
                                [emp.username, emp.password, "employee", employee_id],
                                function(err2) {
                                    if (err2) {
                                        console.error(`❌ خطأ في إنشاء حساب ${emp.username}:`, err2);
                                    } else {
                                        console.log(`✅ تم إنشاء موظف: ${emp.name} (${emp.username})`);
                                    }
                                }
                            );
                        }
                    }
                );
            } else {
                console.log(`✅ الموظف ${emp.name} موجود بالفعل`);
            }
        });
    });
}

// ==========================
// 🧩 مسارات API
// ==========================

// تسجيل الدخول
app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ message: "اسم المستخدم وكلمة المرور مطلوبان" });
    }

    db.get(
        "SELECT * FROM users WHERE username = ? AND password = ?",
        [username, password],
        (err, user) => {
            if (err) {
                console.error('❌ خطأ في تسجيل الدخول:', err);
                return res.status(500).json({ message: "خطأ في الخادم" });
            }
            if (!user) {
                return res.status(401).json({ message: "بيانات الدخول غير صحيحة" });
            }
            res.json(user);
        }
    );
});

// جلب جميع الأقسام
app.get("/api/sections", (req, res) => {
    db.all("SELECT * FROM sections WHERE hidden = 0", (err, rows) => {
        if (err) {
            console.error('❌ خطأ في جلب الأقسام:', err);
            return res.status(500).json({ message: "خطأ في جلب الأقسام" });
        }
        res.json(rows);
    });
});

// ==========================
// 🧩 إصلاح مسار ملخص الأقسام ليعرض الدخل الصحيح
// ==========================
app.get("/api/sections-summary", (req, res) => {
    db.all(
        `SELECT s.id, s.name,
            COALESCE((
                SELECT SUM(latest.amount) 
                FROM (
                    SELECT e.id, 
                        COALESCE((
                            SELECT amount FROM entries 
                            WHERE employee_id = e.id 
                            ORDER BY updated_at DESC LIMIT 1
                        ), 0) AS amount
                    FROM employees e 
                    WHERE e.section_id = s.id AND e.hidden = 0
                ) latest
            ), 0) AS total_income
        FROM sections s
        WHERE s.hidden = 0`,
        [],
        (err, rows) => {
            if (err) {
                console.error('❌ خطأ في جلب ملخص الأقسام:', err);
                return res.status(500).json({ message: "خطأ في جلب الملخص" });
            }
            const totalAll = rows.reduce((sum, s) => sum + (s.total_income || 0), 0);
            res.json({ sections: rows, totalAll });
        }
    );
});

// ==========================
// 🧩 إصلاح مسار جلب الموظفين ليعرض الدخل الصحيح
// ==========================
app.get("/api/employees", (req, res) => {
    db.all(
        `SELECT e.*, s.name AS section_name,
            COALESCE((
                SELECT amount FROM entries 
                WHERE employee_id = e.id 
                ORDER BY updated_at DESC LIMIT 1
            ), 0) AS total_income,
            (SELECT updated_at FROM entries WHERE employee_id = e.id ORDER BY updated_at DESC LIMIT 1) AS last_income_date
        FROM employees e
        LEFT JOIN sections s ON e.section_id = s.id
        WHERE e.hidden = 0`,
        [],
        (err, rows) => {
            if (err) {
                console.error('❌ خطأ في جلب الموظفين:', err);
                return res.status(500).json({ message: "خطأ في جلب الموظفين" });
            }
            res.json(rows);
        }
    );
});

// ==========================
// 🧩 تعديل مسار جلب بيانات الموظف ليعرض الدخل الوحيد
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
                console.error('❌ خطأ في جلب بيانات الموظف:', err);
                return res.status(500).json({ error: 'خطأ في قاعدة البيانات' });
            }
            if (!emp) {
                return res.status(404).json({ error: "الموظف غير موجود" });
            }

            // الحصول على الدخل الوحيد للموظف
            db.get(
                `SELECT * FROM entries WHERE employee_id = ? ORDER BY updated_at DESC LIMIT 1`,
                [empId],
                (err2, entry) => {
                    if (err2) {
                        console.error('❌ خطأ في جلب الدخل:', err2);
                        return res.status(500).json({ error: 'خطأ في جلب الدخل' });
                    }

                    const totalIncome = entry ? entry.amount : 0;
                    const remaining = (emp.target || 0) - totalIncome;
                    
                    res.json({
                        id: emp.id,
                        name: emp.name,
                        section_name: emp.section_name,
                        target: emp.target || 0,
                        totalIncome: totalIncome,
                        remaining: remaining,
                        entry: entry || null, // سجل الدخل الوحيد
                        lastEntry: entry ? {
                            amount: entry.amount,
                            date: entry.updated_at,
                            note: entry.note
                        } : null
                    });
                }
            );
        }
    );
});

// ==========================
// 🧩 مسار جديد: تحديث دخل الموظف (استبدال القديم بالجديد)
// ==========================
app.post("/api/employees/:id/income", (req, res) => {
    const employee_id = req.params.id;
    const { amount, note } = req.body;
    
    console.log('📥 طلب إضافة/تحديث دخل:', { employee_id, amount, note });
    
    if (!amount || amount <= 0) {
        return res.status(400).json({ message: "المبلغ مطلوب ويجب أن يكون أكبر من صفر" });
    }

    const created_at = new Date().toISOString();
    const updated_at = created_at;

    // الحصول على section_id للموظف
    db.get("SELECT section_id FROM employees WHERE id = ?", [employee_id], (err, emp) => {
        if (err) {
            console.error('❌ خطأ في جلب بيانات الموظف:', err);
            return res.status(500).json({ message: "خطأ في الخادم" });
        }
        if (!emp) {
            console.error('❌ الموظف غير موجود:', employee_id);
            return res.status(404).json({ message: "الموظف غير موجود" });
        }

        const section_id = emp.section_id;

        // بدلاً من إضافة سجل جديد، نقوم بتحديث السجل الموجود أو إنشاء واحد جديد
        db.get("SELECT id FROM entries WHERE employee_id = ?", [employee_id], (err, existingEntry) => {
            if (err) {
                console.error('❌ خطأ في التحقق من الدخل الموجود:', err);
                return res.status(500).json({ message: "خطأ في الخادم" });
            }

            if (existingEntry) {
                // تحديث الدخل الموجود
                db.run(
                    "UPDATE entries SET amount=?, note=?, updated_at=? WHERE employee_id=?",
                    [amount, note, updated_at, employee_id],
                    function (err) {
                        if (err) {
                            console.error('❌ خطأ في تحديث الدخل:', err);
                            return res.status(500).json({ message: "خطأ في تحديث الدخل" });
                        }
                        
                        console.log('✅ تم تحديث الدخل بنجاح:', { entryId: existingEntry.id, employee_id, amount });
                        
                        // تحديث تاريخ آخر دخل للموظف
                        db.run(
                            "UPDATE employees SET last_income_update = ? WHERE id = ?",
                            [created_at, employee_id],
                            (err2) => {
                                if (err2) console.error("❌ خطأ في تحديث تاريخ الدخل:", err2);
                            }
                        );
                        
                        res.json({ id: existingEntry.id, success: true, message: "تم تحديث الدخل بنجاح" });
                    }
                );
            } else {
                // إنشاء دخل جديد إذا لم يكن موجوداً
                db.run(
                    "INSERT INTO entries (employee_id, section_id, amount, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                    [employee_id, section_id, amount, note, created_at, updated_at],
                    function (err) {
                        if (err) {
                            console.error('❌ خطأ في إضافة الدخل:', err);
                            return res.status(500).json({ message: "خطأ في إضافة الدخل إلى قاعدة البيانات: " + err.message });
                        }
                        
                        console.log('✅ تم إضافة الدخل بنجاح:', { entryId: this.lastID, employee_id, amount });
                        
                        // تحديث تاريخ آخر دخل للموظف
                        db.run(
                            "UPDATE employees SET last_income_update = ? WHERE id = ?",
                            [created_at, employee_id],
                            (err2) => {
                                if (err2) console.error("❌ خطأ في تحديث تاريخ الدخل:", err2);
                            }
                        );
                        
                        res.json({ id: this.lastID, success: true, message: "تم إضافة الدخل بنجاح" });
                    }
                );
            }
        });
    });
});

// ==========================
// 🧩 مسار جديد: جلب سجل الدخل (للعرض في النافذة المنبثقة)
// ==========================
app.get("/api/employees/:id/entries", (req, res) => {
    const empId = req.params.id;
    
    db.all(
        `SELECT * FROM entries WHERE employee_id = ? ORDER BY updated_at DESC`,
        [empId],
        (err, entries) => {
            if (err) {
                console.error('❌ خطأ في جلب سجل الدخل:', err);
                return res.status(500).json({ error: 'خطأ في جلب سجل الدخل' });
            }
            
            res.json(entries);
    }
    );
});

// إضافة موظف جديد
app.post("/api/employees", (req, res) => {
    const { name, section_id, target, username, password } = req.body;
    
    if (!name || !section_id || !target || !username || !password) {
        return res.status(400).json({ message: "جميع الحقول مطلوبة" });
    }

    db.run(
        "INSERT INTO employees (name, section_id, target) VALUES (?, ?, ?)",
        [name, section_id, target],
        function (err) {
            if (err) {
                console.error('❌ خطأ في إضافة الموظف:', err);
                return res.status(500).json({ message: "خطأ في إضافة الموظف" });
            }
            
            const employee_id = this.lastID;
            db.run(
                "INSERT INTO users (username, password, role, employee_id) VALUES (?, ?, ?, ?)",
                [username, password, "employee", employee_id],
                function (err2) {
                    if (err2) {
                        console.error('❌ خطأ في إنشاء حساب الموظف:', err2);
                        return res.status(500).json({ message: "خطأ في إنشاء حساب الموظف" });
                    }
                    res.json({ id: employee_id, name });
                }
            );
        }
    );
});

// إضافة ملاحظة الموظف
app.post("/api/entries/:id/employee-note", (req, res) => {
    const { employee_note } = req.body;
    const updated_at = new Date().toISOString();
    
    db.run(
        "UPDATE entries SET employee_note = ?, updated_at = ? WHERE id = ?",
        [employee_note, updated_at, req.params.id],
        function (err) {
            if (err) {
                console.error('❌ خطأ في إضافة ملاحظة الموظف:', err);
                return res.status(500).json({ message: "خطأ في إضافة الملاحظة" });
            }
            res.json({ success: true });
        }
    );
});

// تعديل بيانات الموظف
app.put("/api/employees/:id", (req, res) => {
    const { name, target, username, password } = req.body;
    const id = req.params.id;

    db.run(
        "UPDATE employees SET name=?, target=? WHERE id=?",
        [name, target, id],
        (err) => {
            if (err) {
                console.error('❌ خطأ في تعديل بيانات الموظف:', err);
                return res.status(500).json({ message: "خطأ في التعديل" });
            }

            db.run(
                "UPDATE users SET username=?, password=? WHERE employee_id=?",
                [username, password, id],
                (err2) => {
                    if (err2) {
                        console.error('❌ خطأ في تعديل بيانات المستخدم:', err2);
                        return res.status(500).json({ message: "خطأ في التعديل" });
                    }
                    res.json({ success: true });
                }
            );
        }
    );
});

// تعديل الدخل
app.put("/api/entries/:id", (req, res) => {
    const { amount, note } = req.body;
    const updated_at = new Date().toISOString();
    
    db.run(
        "UPDATE entries SET amount=?, note=?, updated_at=? WHERE id=?",
        [amount, note, updated_at, req.params.id],
        function (err) {
            if (err) {
                console.error('❌ خطأ في تعديل الدخل:', err);
                return res.status(500).json({ message: "خطأ في التعديل" });
            }
            res.json({ success: true });
        }
    );
});

// حذف موظف
app.delete("/api/employees/:id", (req, res) => {
    const id = req.params.id;
    
    db.run("UPDATE employees SET hidden = 1 WHERE id=?", [id], (err) => {
        if (err) {
            console.error('❌ خطأ في إخفاء الموظف:', err);
            return res.status(500).json({ message: "خطأ في الحذف" });
        }
        
        db.run("UPDATE users SET username = username || '_deleted' WHERE employee_id=?", [id], (err2) => {
            if (err2) {
                console.error('❌ خطأ في تحديث اسم المستخدم:', err2);
            }
            res.json({ success: true });
        });
    });
});

// حذف دخل
app.delete("/api/entries/:id", (req, res) => {
    db.run("DELETE FROM entries WHERE id=?", [req.params.id], (err) => {
        if (err) {
            console.error('❌ خطأ في حذف الدخل:', err);
            return res.status(500).json({ message: "خطأ في الحذف" });
        }
        res.json({ success: true });
    });
});

// ==========================
// 🧩 مسارات التصحيح
// ==========================
app.get("/api/debug/employees", (req, res) => {
    db.all("SELECT * FROM employees WHERE hidden = 0", (err, rows) => {
        if (err) {
            console.error('❌ خطأ في جلب الموظفين:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

app.get("/api/debug/sections", (req, res) => {
    db.all("SELECT * FROM sections", (err, rows) => {
        if (err) {
            console.error('❌ خطأ في جلب الأقسام:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// ==========================
// 🧩 مسار جديد: جلب الموظفين حسب القسم
// ==========================
app.get("/api/sections/:id/employees", (req, res) => {
    const sectionId = req.params.id;
    
    db.all(
        `SELECT e.*, 
            COALESCE((
                SELECT amount FROM entries 
                WHERE employee_id = e.id 
                ORDER BY updated_at DESC LIMIT 1
            ), 0) AS total_income
        FROM employees e 
        WHERE e.section_id = ? AND e.hidden = 0`,
        [sectionId],
        (err, employees) => {
            if (err) {
                console.error('❌ خطأ في جلب موظفي القسم:', err);
                return res.status(500).json({ message: "خطأ في جلب الموظفين" });
            }
            res.json(employees);
        }
    );
});

// ==========================
// 🧩 مسار جديد: جلب إحصائيات القسم
// ==========================
app.get("/api/sections/:id/stats", (req, res) => {
    const sectionId = req.params.id;
    
    db.get(
        `SELECT 
            s.name,
            (SELECT COUNT(*) FROM employees WHERE section_id = s.id AND hidden = 0) AS employee_count,
            (SELECT IFNULL(SUM(target),0) FROM employees WHERE section_id = s.id AND hidden = 0) AS total_target,
            COALESCE((
                SELECT SUM(latest.amount) 
                FROM (
                    SELECT e.id, 
                        COALESCE((
                            SELECT amount FROM entries 
                            WHERE employee_id = e.id 
                            ORDER BY updated_at DESC LIMIT 1
                        ), 0) AS amount
                    FROM employees e 
                    WHERE e.section_id = s.id AND e.hidden = 0
                ) latest
            ), 0) AS total_income
        FROM sections s 
        WHERE s.id = ?`,
        [sectionId],
        (err, stats) => {
            if (err) {
                console.error('❌ خطأ في جلب إحصائيات القسم:', err);
                return res.status(500).json({ message: "خطأ في جلب الإحصائيات" });
            }
            res.json(stats);
        }
    );
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
    console.log('\n🎉 ====================================');
    console.log('🚀 تم تشغيل السيرفر بنجاح!');
    console.log(`📍 العنوان: http://localhost:${PORT}`);
    console.log('🔑 بيانات الدخول: admin / admin123');
    console.log('👥 الموظفون التجريبيون: wesam/123456, ahmed/123456, fatima/123456, nadir/102030');
    console.log('📋 الأقسام المتاحة: مكانيكا, كهرباء, كشف, ادارة');
    console.log('====================================\n');
});

// إغلاق قاعدة البيانات عند إيقاف التطبيق
process.on('SIGINT', () => {
    console.log('\n🛑 إيقاف السيرفر...');
    db.close((err) => {
        if (err) {
            console.error('❌ خطأ في إغلاق قاعدة البيانات:', err.message);
        } else {
            console.log('✅ تم إغلاق قاعدة البيانات');
        }
        process.exit(0);
    });
});