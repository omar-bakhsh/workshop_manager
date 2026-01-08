// ==========================
// 🧩 استيراد المكتبات المطلوبة
// ==========================
const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const xlsx = require('xlsx');

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
            employee_id INTEGER,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('admin', 'employee'))
        )`,
        `CREATE TABLE IF NOT EXISTS sections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS employees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            section_id INTEGER,
            target INTEGER NOT NULL DEFAULT 0,
            base_salary INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            hide_income INTEGER DEFAULT 0,
            FOREIGN KEY (section_id) REFERENCES sections(id)
        )`,
        `CREATE TABLE IF NOT EXISTS entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            section_id INTEGER NOT NULL,
            income INTEGER NOT NULL,
            details TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_id) REFERENCES employees(id),
            FOREIGN KEY (section_id) REFERENCES sections(id)
        )`,
        `CREATE TABLE IF NOT EXISTS withdrawals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            amount INTEGER NOT NULL,
            reason TEXT,
            status TEXT DEFAULT 'pending', -- pending, approved, rejected
            admin_note TEXT,
            date DATE DEFAULT CURRENT_DATE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_id) REFERENCES employees(id)
        )`,
        `CREATE TABLE IF NOT EXISTS absences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            date DATE NOT NULL,
            reason TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_id) REFERENCES employees(id)
        )`,
        `CREATE TABLE IF NOT EXISTS leave_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            leave_type TEXT DEFAULT 'annual',
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            days_count INTEGER NOT NULL,
            reason TEXT,
            status TEXT DEFAULT 'pending',
            admin_notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_id) REFERENCES employees(id)
        )`,
        `CREATE TABLE IF NOT EXISTS workshop_lifts (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            status TEXT DEFAULT 'idle', -- idle, green, yellow, red
            technician_id INTEGER,
            issue_description TEXT,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (technician_id) REFERENCES employees(id)
        )`,
        `CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            date DATE DEFAULT CURRENT_DATE,
            check_in TIMESTAMP,
            check_out TIMESTAMP,
            status TEXT DEFAULT 'present',
            FOREIGN KEY (employee_id) REFERENCES employees(id)
        )`,
        `CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            sender TEXT NOT NULL, -- 'employee' or 'admin'
            message TEXT NOT NULL,
            is_read INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_id) REFERENCES employees(id)
        )`
    ];

    db.serialize(() => {
        tables.forEach(sql => {
            db.run(sql, (err) => {
                if (err) console.error('❌ خطأ في إنشاء جدول:', err.message);
            });
        });

        // التأكد من وجود مستخدم المدير الافتراضي والأقسام الافتراضية
        db.run(`INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)`,
            ['admin', 'admin123', 'admin'],
            (err) => {
                if (err) console.error('❌ خطأ في إضافة المدير الافتراضي:', err.message);
            }
        );

        const defaultSections = ['مكانيكا', 'كهرباء', 'كشف', 'ادارة'];
        defaultSections.forEach(sectionName => {
            db.run(`INSERT OR IGNORE INTO sections (name) VALUES (?)`, [sectionName], (err) => {
                if (err) console.error(`❌ خطأ في إضافة قسم ${sectionName}:`, err.message);
            });
        });

        // إضافة الرافعات الافتراضية (A-E)
        const lifts = ['A', 'B', 'C', 'D', 'E'];
        lifts.forEach(id => {
            db.run(`INSERT OR IGNORE INTO workshop_lifts (id, name) VALUES (?, ?)`, [id, `رافعة ${id}`], (err) => {
                if (err) console.error(`❌ خطأ في إضافة الرافعة ${id}:`, err.message);
            });
        });

        console.log('✅ تم الانتهاء من تهيئة قاعدة البيانات');
    });
}

// ==========================
// 🧩 دالة للاستعلام عن قاعدة البيانات (Promise Wrapper)
// ==========================
function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// ==========================
// 🔐 مصادقة المستخدمين
// ==========================
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await dbGet(`
            SELECT u.*, e.name AS employee_name, e.id AS employee_id, e.section_id
            FROM users u
            LEFT JOIN employees e ON u.employee_id = e.id
            WHERE u.username = ? AND u.password = ?
        `, [username, password]);

        if (user) {
            // حذف كلمة المرور قبل الإرسال
            delete user.password;
            return res.json({
                message: "تم تسجيل الدخول بنجاح",
                ...user
            });
        }
        res.status(401).json({ message: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ message: "خطأ في الخادم" });
    }
});

// ==========================
// 👥 إدارة الموظفين (Admin)
// ==========================

// إضافة موظف جديد
app.post('/api/employees', async (req, res) => {
    const { name, section_id, target, base_salary, username, password, hide_income } = req.body;
    if (!name || !section_id || !target || !username || !password) {
        return res.status(400).json({ message: "الرجاء إدخال جميع البيانات المطلوبة." });
    }
    try {
        // 1. إضافة الموظف
        const empResult = await dbRun(`INSERT INTO employees (name, section_id, target, base_salary, hide_income) VALUES (?, ?, ?, ?, ?)`, [name, section_id, target, base_salary || 0, hide_income || 0]);
        const employee_id = empResult.lastID;

        // 2. إنشاء حساب المستخدم
        await dbRun(`INSERT INTO users (employee_id, username, password, role) VALUES (?, ?, ?, 'employee')`, [employee_id, username, password]);

        res.status(201).json({ message: "تمت إضافة الموظف بنجاح", id: employee_id });
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT') {
            return res.status(409).json({ message: "اسم المستخدم موجود بالفعل." });
        }
        console.error("Add Employee Error:", error);
        res.status(500).json({ message: "خطأ في إضافة الموظف" });
    }
});

// تحديث بيانات موظف
app.put('/api/employees/:id', async (req, res) => {
    const { id } = req.params;
    const { name, section_id, target, base_salary, username, password, hide_income } = req.body;

    try {
        // 1. تحديث بيانات الموظف (الاسم، القسم، الهدف، الراتب الأساسي، إخفاء الدخل)
        await dbRun(`UPDATE employees SET name = ?, section_id = ?, target = ?, base_salary = ?, hide_income = ? WHERE id = ?`, [name, section_id, target, base_salary, hide_income || 0, id]);

        // 2. تحديث بيانات المستخدم (اسم المستخدم وكلمة المرور)
        // التحقق مما إذا كان هناك مستخدم مرتبط لتجنب تحديث المدير
        const userCheck = await dbGet('SELECT id FROM users WHERE employee_id = ?', [id]);
        if (userCheck) {
            await dbRun(`UPDATE users SET username = ?, password = ? WHERE employee_id = ?`, [username, password, id]);
        }

        res.json({ message: "تم تحديث بيانات الموظف بنجاح" });
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT') {
            return res.status(409).json({ message: "اسم المستخدم موجود بالفعل." });
        }
        console.error("Update Employee Error:", error);
        res.status(500).json({ message: "خطأ في تحديث بيانات الموظف" });
    }
});

// حذف/تعطيل موظف (Soft Delete)
app.delete('/api/employees/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // حذف جميع البيانات المرتبطة بالموظف أولاً (Hard Delete)
        await dbRun(`DELETE FROM entries WHERE employee_id = ?`, [id]);
        await dbRun(`DELETE FROM withdrawals WHERE employee_id = ?`, [id]);
        await dbRun(`DELETE FROM absences WHERE employee_id = ?`, [id]);
        await dbRun(`DELETE FROM users WHERE employee_id = ?`, [id]);

        // أخيراً حذف الموظف
        await dbRun(`DELETE FROM employees WHERE id = ?`, [id]);

        res.json({ message: "تم حذف الموظف وجميع بياناته بنجاح" });
    } catch (error) {
        console.error("Delete Employee Error:", error);
        res.status(500).json({ message: "خطأ في حذف الموظف" });
    }
});

// جلب جميع الموظفين مع ملخص الأداء
app.get('/api/employees', async (req, res) => {
    try {
        const employees = await dbAll(`
            SELECT
                e.id,
                e.name,
                e.target,
                e.base_salary,
                e.hide_income,
                e.section_id,
                s.name AS section_name,
                u.username,
                u.password,
                (SELECT COALESCE(SUM(income), 0) FROM entries WHERE employee_id = e.id) AS total_income,
                (SELECT COALESCE(SUM(amount), 0) FROM withdrawals WHERE employee_id = e.id AND status = 'approved') AS total_withdrawal
            FROM employees e
            LEFT JOIN sections s ON e.section_id = s.id
            LEFT JOIN users u ON e.id = u.employee_id
            WHERE e.is_active = 1
            ORDER BY e.id
        `);
        res.json(employees);
    } catch (error) {
        console.error("Fetch Employees Error:", error);
        res.status(500).json({ message: "خطأ في جلب بيانات الموظفين" });
    }
});

// جلب جميع الأقسام
app.get('/api/sections', async (req, res) => {
    try {
        const sections = await dbAll(`SELECT * FROM sections ORDER BY id`);
        res.json(sections);
    } catch (error) {
        console.error("Fetch Sections Error:", error);
        res.status(500).json({ message: "خطأ في جلب الأقسام" });
    }
});

// جلب ملخص الأقسام
app.get('/api/sections-summary', async (req, res) => {
    try {
        const summary = await dbAll(`
            SELECT
                s.id,
                s.name,
                COUNT(e.id) AS employee_count,
                COALESCE(SUM(e.target), 0) AS total_target,
                COALESCE(SUM(ent.income), 0) AS total_income
            FROM sections s
            LEFT JOIN employees e ON s.id = e.section_id AND e.is_active = 1
            LEFT JOIN entries ent ON e.id = ent.employee_id
            GROUP BY s.id
            ORDER BY s.id
        `);
        res.json(summary);
    } catch (error) {
        console.error("Fetch Sections Summary Error:", error);
        res.status(500).json({ message: "خطأ في جلب ملخص الأقسام" });
    }
});

// ==========================
// 📊 بيانات الموظف الفردية
// ==========================

// جلب إحصائيات الموظف (صفحة الموظف)
app.get('/api/employee-stats/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // جلب اسم الموظف والهدف والقسم
        const info = await dbGet(`
            SELECT e.name, e.target, e.base_salary, e.hide_income, e.section_id, s.name AS section_name 
            FROM employees e 
            LEFT JOIN sections s ON e.section_id = s.id 
            WHERE e.id = ? AND e.is_active = 1
        `, [id]);

        // جلب إجمالي الدخل
        const totalIncomeRow = await dbGet(`SELECT COALESCE(SUM(income), 0) AS total_income FROM entries WHERE employee_id = ?`, [id]);

        // جلب إجمالي السحوبات (المقبولة فقط)
        const totalWithdrawalRow = await dbGet(`SELECT COALESCE(SUM(amount), 0) AS total_withdrawal FROM withdrawals WHERE employee_id = ? AND status = 'approved'`, [id]);

        // جلب جميع الإدخالات
        const entries = await dbAll(`SELECT * FROM entries WHERE employee_id = ? ORDER BY created_at DESC`, [id]);

        // جلب جميع السحوبات (مع الحالة)
        const withdrawals = await dbAll(`SELECT * FROM withdrawals WHERE employee_id = ? ORDER BY created_at DESC`, [id]);

        // جلب الغيابات
        const absences = await dbAll(`SELECT * FROM absences WHERE employee_id = ? ORDER BY date DESC`, [id]);

        if (!info) {
            return res.status(404).json({ message: "لم يتم العثور على الموظف أو أنه غير نشط." });
        }

        if (info.hide_income == 1) {
            res.json({
                info,
                total_income: -1, // Flag for hidden
                total_withdrawal: totalWithdrawalRow.total_withdrawal,
                entries: [], // Hide entries
                withdrawals,
                absences,
                income_hidden: true
            });
        } else {
            res.json({
                info,
                total_income: totalIncomeRow.total_income,
                total_withdrawal: totalWithdrawalRow.total_withdrawal,
                entries,
                withdrawals,
                absences,
                income_hidden: false
            });
        }
    } catch (error) {
        console.error("Fetch Employee Stats Error:", error);
        res.status(500).json({ message: "خطأ في جلب إحصائيات الموظف" });
    }
});

// إضافة إدخال (دخل) جديد
app.post('/api/entries', async (req, res) => {
    const { employee_id, section_id, income, details } = req.body;
    if (!employee_id || !income || income <= 0) {
        return res.status(400).json({ message: "الرجاء التأكد من إدخال الدخل بشكل صحيح." });
    }

    try {
        await dbRun(`INSERT INTO entries (employee_id, section_id, income, details) VALUES (?, ?, ?, ?)`, [employee_id, section_id, income, details]);
        res.status(201).json({ message: "تم تسجيل الدخل بنجاح" });
    } catch (error) {
        console.error("Add Entry Error:", error);
        res.status(500).json({ message: "خطأ في تسجيل الدخل" });
    }
});

// استبدال دخل الموظف (حذف القديم وإضافة الجديد)
app.post('/api/employees/:id/income', async (req, res) => {
    const { id } = req.params;
    const { income, details, section_id } = req.body;

    if (!income || income <= 0) {
        return res.status(400).json({ message: "الرجاء التأكد من إدخال الدخل بشكل صحيح." });
    }

    try {
        // حذف جميع المدخلات السابقة لهذا الموظف
        await dbRun(`DELETE FROM entries WHERE employee_id = ?`, [id]);

        // إضافة المدخل الجديد
        // نحتاج section_id، إذا لم يتم إرساله يمكن جلبه من جدول الموظفين
        let secId = section_id;
        if (!secId) {
            const emp = await dbGet('SELECT section_id FROM employees WHERE id = ?', [id]);
            if (emp) secId = emp.section_id;
        }

        await dbRun(`INSERT INTO entries (employee_id, section_id, income, details) VALUES (?, ?, ?, ?)`,
            [id, secId, income, details]);

        res.json({ message: "تم تحديث الدخل بنجاح (تم استبدال القيم السابقة)" });
    } catch (error) {
        console.error("Replace Income Error:", error);
        res.status(500).json({ message: "خطأ في تحديث الدخل" });
    }
});

// تحديث إدخال (دخل)
app.put('/api/entries/:id', async (req, res) => {
    const { id } = req.params;
    const { income, details } = req.body;

    if (!income || income <= 0) {
        return res.status(400).json({ message: "الرجاء التأكد من إدخال الدخل بشكل صحيح." });
    }

    try {
        await dbRun(`UPDATE entries SET income = ?, details = ? WHERE id = ?`, [income, details, id]);
        res.json({ message: "تم تحديث الدخل بنجاح" });
    } catch (error) {
        console.error("Update Entry Error:", error);
        res.status(500).json({ message: "خطأ في تحديث الدخل" });
    }
});

// حذف إدخال (دخل)
app.delete('/api/entries/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await dbRun(`DELETE FROM entries WHERE id = ?`, [id]);
        res.json({ message: "تم حذف الدخل بنجاح" });
    } catch (error) {
        console.error("Delete Entry Error:", error);
        res.status(500).json({ message: "خطأ في حذف الدخل" });
    }
});

// ==========================
// 📂 إدارة السحوبات والغيابات
// ==========================

// إضافة سحب جديد (طلب أو مباشر)
app.post('/api/withdrawals', async (req, res) => {
    const { employee_id, amount, reason, date, status } = req.body;
    if (!employee_id || !amount || amount <= 0) {
        return res.status(400).json({ message: "الرجاء التأكد من إدخال المبلغ بشكل صحيح." });
    }

    const withdrawalStatus = status || 'pending'; // Default to pending for employee requests
    const withdrawalDate = date || new Date().toISOString().split('T')[0];

    try {
        await dbRun(`INSERT INTO withdrawals (employee_id, amount, reason, date, status) VALUES (?, ?, ?, ?, ?)`,
            [employee_id, amount, reason, withdrawalDate, withdrawalStatus]);
        res.status(201).json({ message: "تم تسجيل السحب بنجاح" });
    } catch (error) {
        console.error("Add Withdrawal Error:", error);
        res.status(500).json({ message: "خطأ في تسجيل السحب" });
    }
});

// تحديث حالة السحب (قبول/رفض)
app.put('/api/withdrawals/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status, admin_note } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: "حالة غير صالحة." });
    }

    try {
        await dbRun(`UPDATE withdrawals SET status = ?, admin_note = ? WHERE id = ?`, [status, admin_note, id]);
        res.json({ message: "تم تحديث حالة السحب بنجاح" });
    } catch (error) {
        console.error("Update Withdrawal Status Error:", error);
        res.status(500).json({ message: "خطأ في تحديث حالة السحب" });
    }
});

// جلب السحوبات المعلقة (للمدير)
app.get('/api/withdrawals/pending', async (req, res) => {
    try {
        const pending = await dbAll(`
            SELECT w.*, e.name AS employee_name 
            FROM withdrawals w
            JOIN employees e ON w.employee_id = e.id
            WHERE w.status = 'pending'
            ORDER BY w.created_at DESC
        `);
        res.json(pending);
    } catch (error) {
        console.error("Fetch Pending Withdrawals Error:", error);
        res.status(500).json({ message: "خطأ في جلب السحوبات المعلقة" });
    }
});

// جلب جميع السحوبات (للمدير - سجل كامل)
app.get('/api/withdrawals', async (req, res) => {
    try {
        const withdrawals = await dbAll(`
            SELECT w.*, e.name AS employee_name 
            FROM withdrawals w
            JOIN employees e ON w.employee_id = e.id
            ORDER BY w.created_at DESC
        `);
        res.json(withdrawals);
    } catch (error) {
        console.error("Fetch All Withdrawals Error:", error);
        res.status(500).json({ message: "خطأ في جلب سجل السحوبات" });
    }
});

// إضافة غياب
app.post('/api/absences', async (req, res) => {
    const { employee_id, date, reason } = req.body;
    if (!employee_id || !date) {
        return res.status(400).json({ message: "الرجاء إدخال الموظف والتاريخ." });
    }

    try {
        await dbRun(`INSERT INTO absences (employee_id, date, reason) VALUES (?, ?, ?)`, [employee_id, date, reason]);
        res.status(201).json({ message: "تم تسجيل الغياب بنجاح" });
    } catch (error) {
        console.error("Add Absence Error:", error);
        res.status(500).json({ message: "خطأ في تسجيل الغياب" });
    }
});

// جلب الغيابات حسب الفترة الزمنية (للتقرير)
app.get('/api/absences', async (req, res) => {
    const { from, to } = req.query;

    if (!from || !to) {
        return res.status(400).json({ message: "الرجاء تحديد تاريخ البداية والنهاية" });
    }

    try {
        const absences = await dbAll(`
            SELECT a.*, e.name as employee_name 
            FROM absences a
            LEFT JOIN employees e ON a.employee_id = e.id
            WHERE a.date BETWEEN ? AND ?
            ORDER BY a.date DESC
        `, [from, to]);

        res.json(absences);
    } catch (error) {
        console.error("Fetch Absences Report Error:", error);
        res.status(500).json({ message: "خطأ في جلب تقرير الغيابات" });
    }
});

// جلب الغيابات (مع إمكانية التصفية حسب الفترة الزمنية والموظف)
app.get('/api/absences', async (req, res) => {
    const { from, to, employee_id } = req.query;

    try {
        let query = `
            SELECT a.*, e.name as employee_name 
            FROM absences a
            LEFT JOIN employees e ON a.employee_id = e.id
            WHERE 1=1
        `;
        let params = [];

        // إذا تم تحديد فترة زمنية
        if (from && to) {
            query += ` AND a.date BETWEEN ? AND ?`;
            params.push(from, to);
        }

        // إذا تم تحديد موظف
        if (employee_id) {
            query += ` AND a.employee_id = ?`;
            params.push(employee_id);
        }

        query += ` ORDER BY a.date DESC`;

        const absences = await dbAll(query, params);
        res.json(absences);
    } catch (error) {
        console.error("Fetch Absences Error:", error);
        res.status(500).json({ message: "خطأ في جلب الغيابات" });
    }
});

// جلب سحوبات موظف محدد
app.get('/api/employees/:id/withdrawals', async (req, res) => {
    const { id } = req.params;
    try {
        const withdrawals = await dbAll(`SELECT * FROM withdrawals WHERE employee_id = ? ORDER BY date DESC`, [id]);
        res.json(withdrawals);
    } catch (error) {
        console.error("Fetch Employee Withdrawals Error:", error);
        res.status(500).json({ message: "خطأ في جلب سحوبات الموظف" });
    }
});

// جلب دخل موظف محدد
app.get('/api/employees/:id/entries', async (req, res) => {
    const { id } = req.params;
    try {
        const entries = await dbAll(`SELECT * FROM entries WHERE employee_id = ? ORDER BY date DESC`, [id]);
        res.json(entries);
    } catch (error) {
        console.error("Fetch Employee Entries Error:", error);
        res.status(500).json({ message: "خطأ في جلب دخل الموظف" });
    }
});


// إضافة سحب جماعي (Batch)
app.post('/api/withdrawals/batch', async (req, res) => {
    const { employee_ids, amount, reason, date } = req.body;

    if (!employee_ids || !Array.isArray(employee_ids) || employee_ids.length === 0 || !amount) {
        return res.status(400).json({ message: "بيانات غير صالحة." });
    }

    const withdrawalDate = date || new Date().toISOString().split('T')[0];

    try {
        const promises = employee_ids.map(id =>
            dbRun(`INSERT INTO withdrawals (employee_id, amount, reason, date, status) VALUES (?, ?, ?, ?, 'approved')`,
                [id, amount, reason, withdrawalDate])
        );

        await Promise.all(promises);
        res.json({ message: `تم إضافة السحوبات لـ ${employee_ids.length} موظف بنجاح` });
    } catch (error) {
        console.error("Batch Withdrawal Error:", error);
        res.status(500).json({ message: "خطأ في إضافة السحوبات الجماعية" });
    }
});


// ==========================
// 🏖️ إدارة الإجازات (Leave Management)
// ==========================

// دالة مساعدة لحساب عدد أيام العمل بين تاريخين (استثناء الجمعة والسبت)
function calculateBusinessDays(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let count = 0;

    const current = new Date(start);
    while (current <= end) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 5 && dayOfWeek !== 6) { // 5=Friday, 6=Saturday
            count++;
        }
        current.setDate(current.getDate() + 1);
    }

    return count;
}

// دالة لحساب رصيد الإجازات
async function getLeaveBalance(employee_id) {
    try {
        const result = await dbGet(`
            SELECT COALESCE(SUM(days_count), 0) as used_days
            FROM leave_requests
            WHERE employee_id = ? AND status = 'approved'
        `, [employee_id]);

        return {
            total: 21,
            used: result.used_days,
            remaining: 21 - result.used_days
        };
    } catch (error) {
        console.error('Leave Balance Error:', error);
        return { total: 21, used: 0, remaining: 21 };
    }
}

// إنشاء طلب إجازة جديد (Employee)
app.post('/api/leave-requests', async (req, res) => {
    const { employee_id, leave_type, start_date, end_date, reason } = req.body;

    if (!employee_id || !start_date || !end_date) {
        return res.status(400).json({ message: 'جميع الحقول مطلوبة' });
    }

    try {
        const days_count = calculateBusinessDays(start_date, end_date);

        if (days_count <= 0) {
            return res.status(400).json({ message: 'التواريخ غير صحيحة' });
        }

        // التحقق من الرصيد المتاح
        const balance = await getLeaveBalance(employee_id);
        if (days_count > balance.remaining) {
            return res.status(400).json({
                message: `رصيدك غير كافٍ. المتبقي: ${balance.remaining} يوم`
            });
        }

        await dbRun(`
            INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, days_count, reason)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [employee_id, leave_type || 'annual', start_date, end_date, days_count, reason]);

        res.json({ message: 'تم إرسال طلب الإجازة بنجاح', days_count });
    } catch (error) {
        console.error('Create Leave Request Error:', error);
        res.status(500).json({ message: 'خطأ في إنشاء طلب الإجازة' });
    }
});

// جلب جميع طلبات الإجازة (Admin) مع إمكانية الفلترة
app.get('/api/leave-requests', async (req, res) => {
    const { status, employee_id } = req.query;

    try {
        let sql = `
            SELECT 
                lr.*,
                e.name AS employee_name,
                s.name AS section_name
            FROM leave_requests lr
            JOIN employees e ON lr.employee_id = e.id
            LEFT JOIN sections s ON e.section_id = s.id
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            sql += ` AND lr.status = ?`;
            params.push(status);
        }

        if (employee_id) {
            sql += ` AND lr.employee_id = ?`;
            params.push(employee_id);
        }

        sql += ` ORDER BY lr.created_at DESC`;

        const requests = await dbAll(sql, params);
        res.json(requests);
    } catch (error) {
        console.error('Fetch Leave Requests Error:', error);
        res.status(500).json({ message: 'خطأ في جلب طلبات الإجازة' });
    }
});

// جلب طلبات الإجازة لموظف محدد (Employee)
app.get('/api/leave-requests/employee/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const requests = await dbAll(`
            SELECT * FROM leave_requests
            WHERE employee_id = ?
            ORDER BY created_at DESC
        `, [id]);

        res.json(requests);
    } catch (error) {
        console.error('Fetch Employee Leave Requests Error:', error);
        res.status(500).json({ message: 'خطأ في جلب طلبات الإجازة' });
    }
});

// تحديث حالة طلب الإجازة (Admin: قبول/رفض)
app.put('/api/leave-requests/:id', async (req, res) => {
    const { id } = req.params;
    const { status, admin_notes } = req.body;

    if (!status || !['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: 'حالة غير صحيحة' });
    }

    try {
        await dbRun(`
            UPDATE leave_requests
            SET status = ?, admin_notes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [status, admin_notes || null, id]);

        res.json({ message: `تم ${status === 'approved' ? 'قبول' : 'رفض'} الطلب بنجاح` });
    } catch (error) {
        console.error('Update Leave Request Error:', error);
        res.status(500).json({ message: 'خطأ في تحديث طلب الإجازة' });
    }
});

// جلب رصيد الإجازات لموظف محدد
app.get('/api/leave-balance/:employee_id', async (req, res) => {
    const { employee_id } = req.params;

    try {
        const balance = await getLeaveBalance(employee_id);
        res.json(balance);
    } catch (error) {
        console.error('Fetch Leave Balance Error:', error);
        res.status(500).json({ message: 'خطأ في جلب رصيد الإجازات' });
    }
});

// جلب رصيد الإجازات لجميع الموظفين (Admin)
app.get('/api/leave-balances', async (req, res) => {
    try {
        const employees = await dbAll(`
            SELECT id, name FROM employees WHERE is_active = 1
        `);

        const balances = await Promise.all(
            employees.map(async (emp) => {
                const balance = await getLeaveBalance(emp.id);
                return {
                    employee_id: emp.id,
                    employee_name: emp.name,
                    ...balance
                };
            })
        );

        res.json(balances);
    } catch (error) {
        console.error('Fetch Leave Balances Error:', error);
    }
});

// ==========================
// 🏗️ إدارة الرافعات (Lift Management)
// ==========================

// جلب حالة جميع الرافعات
app.get('/api/lifts', async (req, res) => {
    try {
        const lifts = await dbAll(`
            SELECT 
                l.*,
                e.name AS technician_name
            FROM workshop_lifts l
            LEFT JOIN employees e ON l.technician_id = e.id
            ORDER BY l.id
        `);
        res.json(lifts);
    } catch (error) {
        console.error('Fetch Lifts Error:', error);
        res.status(500).json({ message: 'خطأ في جلب بيانات الرافعات' });
    }
});

// تحديث حالة الرافعة (للفني)
app.put('/api/lifts/:id', async (req, res) => {
    const { id } = req.params;
    const { status, technician_id, issue_description } = req.body;

    try {
        // التحقق من وجود الرافعة
        const lift = await dbGet('SELECT * FROM workshop_lifts WHERE id = ?', [id]);
        if (!lift) {
            return res.status(404).json({ message: 'الرافعة غير موجودة' });
        }

        // بناء جملة التحديث ديناميكياً
        let updates = [];
        let params = [];

        if (status) {
            updates.push('status = ?');
            params.push(status);
        }
        if (technician_id !== undefined) {
            updates.push('technician_id = ?');
            params.push(technician_id);
        }
        if (issue_description !== undefined) {
            updates.push('issue_description = ?');
            params.push(issue_description);
        }

        updates.push('last_updated = CURRENT_TIMESTAMP');

        if (updates.length === 1) { // Only last_updated
            return res.status(400).json({ message: 'لا توجد بيانات للتحديث' });
        }

        const sql = `UPDATE workshop_lifts SET ${updates.join(', ')} WHERE id = ?`;
        params.push(id);

        await dbRun(sql, params);
        res.json({ message: 'تم تحديث حالة الرافعة بنجاح' });
    } catch (error) {
        console.error('Update Lift Error:', error);
        res.status(500).json({ message: 'خطأ في تحديث الرافعة' });
    }
});

// تحرير الرافعة (إخلاء)
app.post('/api/lifts/:id/release', async (req, res) => {
    const { id } = req.params;

    try {
        await dbRun(`
            UPDATE workshop_lifts 
            SET status = 'idle', technician_id = NULL, issue_description = NULL, last_updated = CURRENT_TIMESTAMP 
            WHERE id = ?
        `, [id]);
        res.json({ message: 'تم إخلاء الرافعة بنجاح' });
    } catch (error) {
        console.error('Release Lift Error:', error);
        res.status(500).json({ message: 'خطأ في إخلاء الرافعة' });
    }
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
// 📅 نظام الحضور والانصراف
// ==========================

// تسجيل دخول (Check-in)
app.post('/api/attendance/check-in', async (req, res) => {
    const { employee_id } = req.body;
    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toISOString();

    try {
        // التحقق مما إذا كان قد سجل بالفعل اليوم
        const existing = await dbGet('SELECT * FROM attendance WHERE employee_id = ? AND date = ?', [employee_id, date]);
        if (existing) {
            return res.status(400).json({ message: 'تم تسجيل الحضور مسبقاً لهذا اليوم' });
        }

        await dbRun(`INSERT INTO attendance (employee_id, date, check_in) VALUES (?, ?, ?)`, [employee_id, date, time]);
        res.json({ message: 'تم تسجيل الحضور بنجاح', time });
    } catch (error) {
        console.error("Check-in Error:", error);
        res.status(500).json({ message: "خطأ في تسجيل الحضور" });
    }
});

// تسجيل خروج (Check-out)
app.post('/api/attendance/check-out', async (req, res) => {
    const { employee_id } = req.body;
    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toISOString();

    try {
        const existing = await dbGet('SELECT * FROM attendance WHERE employee_id = ? AND date = ?', [employee_id, date]);
        if (!existing) {
            return res.status(400).json({ message: 'يجب تسجيل الحضور أولاً' });
        }
        if (existing.check_out) {
            return res.status(400).json({ message: 'تم تسجيل الانصراف مسبقاً' });
        }

        await dbRun(`UPDATE attendance SET check_out = ? WHERE id = ?`, [time, existing.id]);
        res.json({ message: 'تم تسجيل الانصراف بنجاح', time });
    } catch (error) {
        console.error("Check-out Error:", error);
        res.status(500).json({ message: "خطأ في تسجيل الانصراف" });
    }
});

// جلب حالة الحضور لليوم
app.get('/api/attendance/status/:employee_id', async (req, res) => {
    const { employee_id } = req.params;
    const date = new Date().toISOString().split('T')[0];

    try {
        const status = await dbGet('SELECT * FROM attendance WHERE employee_id = ? AND date = ?', [employee_id, date]);
        res.json(status || { status: 'not_marked' });
    } catch (error) {
        console.error("Attendance Status Error:", error);
        res.status(500).json({ message: "خطأ في جلب حالة الحضور" });
    }
});

// ==========================
// 💬 نظام المحادثة (Chat)
// ==========================

// جلب الرسائل
app.get('/api/messages/:employee_id', async (req, res) => {
    const { employee_id } = req.params;
    try {
        const messages = await dbAll(`SELECT * FROM messages WHERE employee_id = ? ORDER BY created_at ASC`, [employee_id]);
        res.json(messages);
    } catch (error) {
        console.error("Fetch Messages Error:", error);
        res.status(500).json({ message: "خطأ في جلب الرسائل" });
    }
});

// إرسال رسالة
app.post('/api/messages', async (req, res) => {
    const { employee_id, sender, message } = req.body;
    if (!message) return res.status(400).json({ message: "الرسالة فارغة" });

    try {
        await dbRun(`INSERT INTO messages (employee_id, sender, message) VALUES (?, ?, ?)`, [employee_id, sender, message]);
        res.json({ message: "تم الإرسال" });
    } catch (error) {
        console.error("Send Message Error:", error);
        res.status(500).json({ message: "خطأ في إرسال الرسالة" });
    }
});

// ==========================
// 🔔 نظام الإشعارات
// ==========================
app.get('/api/notifications', async (req, res) => {
    try {
        const pendingWithdrawals = await dbGet(`SELECT COUNT(*) as count FROM withdrawals WHERE status = 'pending'`);
        const pendingLeaves = await dbGet(`SELECT COUNT(*) as count FROM leave_requests WHERE status = 'pending'`);

        res.json({
            withdrawals: pendingWithdrawals.count,
            leaves: pendingLeaves.count,
            total: pendingWithdrawals.count + pendingLeaves.count
        });
    } catch (error) {
        console.error("Notifications Error:", error);
        res.status(500).json({ message: "خطأ في جلب الإشعارات" });
    }
});

// ==========================
// 💾 النسخ الاحتياطي
// ==========================
app.get('/api/backup', (req, res) => {
    const dbPath = path.join(__dirname, 'db.sqlite');
    const date = new Date().toISOString().split('T')[0];
    const filename = `backup_workshop_${date}.sqlite`;

    res.download(dbPath, filename, (err) => {
        if (err) {
            console.error("Backup Download Error:", err);
            res.status(500).send("Could not download backup");
        }
    });
});

// ==========================
// 🧩 تشغيل السيرفر
// ==========================
app.listen(PORT, () => {
    console.log('\n🎉 ====================================');
    console.log('🚀 تم تشغيل السيرفر بنجاح!');
    console.log(`📍 العنوان: http://localhost:${PORT}`);
    console.log('📋 الأقسام المتاحة: مكانيكا, كهرباء, كشف, ادارة');
    console.log('====================================\n');
});