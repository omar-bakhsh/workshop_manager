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
// 🧩 دالات مساعدة لقاعدة البيانات (Promises)
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

const dbPath = path.join(__dirname, 'db.sqlite');
console.log('📍 مسار قاعدة البيانات:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ خطأ في فتح قاعدة البيانات:', err.message);
        process.exit(1);
    } else {
        console.log('✅ تم الاتصال بقاعدة البيانات SQLite بنجاح');
        initializeDatabase();
    }
});

// ==========================
// 🧩 تهيئة قاعدة البيانات
// ==========================
async function initializeDatabase() {
    console.log('🔧 جاري تهيئة قاعدة البيانات...');

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
            status TEXT DEFAULT 'pending',
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
            status TEXT DEFAULT 'idle',
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
            sender TEXT NOT NULL,
            message TEXT NOT NULL,
            is_read INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_id) REFERENCES employees(id)
        )`,
        `CREATE TABLE IF NOT EXISTS inspections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            inspector_id INTEGER NOT NULL,
            customer_name TEXT,
            customer_phone TEXT,
            car_type TEXT,
            car_color TEXT,
            car_model TEXT,
            plate_number TEXT,
            odometer TEXT,
            vin TEXT,
            total_amount REAL DEFAULT 0,
            vat_amount REAL DEFAULT 0,
            final_amount REAL DEFAULT 0,
            paid_amount REAL DEFAULT 0,
            remaining_amount REAL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (inspector_id) REFERENCES employees(id)
        )`,
        `CREATE TABLE IF NOT EXISTS inspection_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            inspection_id INTEGER NOT NULL,
            category TEXT,
            service_description TEXT,
            quantity INTEGER DEFAULT 1,
            price REAL DEFAULT 0,
            total REAL DEFAULT 0,
            FOREIGN KEY (inspection_id) REFERENCES inspections(id)
        )`,
        `CREATE TABLE IF NOT EXISTS inspection_terms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            term TEXT UNIQUE NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS services (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL,
            service_name TEXT NOT NULL,
            price REAL DEFAULT 0,
            UNIQUE(category, service_name)
        )`,
        `CREATE TABLE IF NOT EXISTS inspection_bundles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            icon TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS inspection_bundle_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bundle_id INTEGER NOT NULL,
            service_description TEXT NOT NULL,
            category TEXT,
            FOREIGN KEY (bundle_id) REFERENCES inspection_bundles(id) ON DELETE CASCADE
        )`
    ];

    try {
        for (const sql of tables) {
            await dbRun(sql);
        }

        // بذر مستخدم المدير
        await dbRun(`INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)`, ['admin', 'admin123', 'admin']);

        // بذر الأقسام
        const sections = ['مكانيكا', 'كهرباء', 'كشف', 'ادارة'];
        for (const section of sections) {
            await dbRun(`INSERT OR IGNORE INTO sections (name) VALUES (?)`, [section]);
        }

        // بذر الرافعات
        const lifts = [
            { id: 'A', name: 'رافعة A' },
            { id: 'B', name: 'رافعة B' },
            { id: 'C', name: 'رافعة C' },
            { id: 'D', name: 'رافعة D' },
            { id: 'E', name: 'رافعة E' }
        ];
        for (const lift of lifts) {
            await dbRun(`INSERT OR IGNORE INTO workshop_lifts (id, name) VALUES (?, ?)`, [lift.id, lift.name]);
        }

        // بذر الخدمات الافتراضية
        const defaultServices = {
            "كشف": [
                { service: "كشف كمبيوتر", price: 100 },
                { service: "كشف ميكانيكا", price: 50 },
                { service: "كشف كهرباء", price: 50 },
                { service: "كشف شامل", price: 200 }
            ],
            "مكانيكا": [
                { service: "تغيير زيت", price: 30 },
                { service: "تغيير فحمات", price: 50 },
                { service: "تصفية مكينة", price: 150 }
            ],
            "كهرباء": [
                { service: "فحص ضفيرة", price: 100 },
                { service: "تغيير بواجي", price: 40 }
            ]
        };

        const servicesCount = await dbGet("SELECT COUNT(*) as count FROM services");
        if (servicesCount.count === 0) {
            for (const cat of Object.keys(defaultServices)) {
                for (const s of defaultServices[cat]) {
                    await dbRun("INSERT INTO services (category, service_name, price) VALUES (?, ?, ?)", [cat, s.service, s.price]);
                }
            }
            console.log('🌱 تم بذر الخدمات الافتراضية');
        }

        // بذر باقات الصيانة الدورية
        const bundlesCount = await dbGet("SELECT COUNT(*) as count FROM inspection_bundles");
        if (bundlesCount.count === 0) {
            console.log('🌱 جاري بذر باقات الصيانة الدورية...');

            const commonItems = [
                { name: "تلييس المقاعد والأرضيات", code: "I", cat: "عام" },
                { name: "أحزمة الأمان وأقفالها", code: "I", cat: "كشف" },
                { name: "الإنارة والمساحات والسوائل", code: "I", cat: "كشف" },
                { name: "السيور", code: "I", cat: "كشف" },
                { name: "زيت الماكينة", code: "R", cat: "مكانيكا" },
                { name: "فلتر زيت الماكينة", code: "R", cat: "مكانيكا" },
                { name: "نظام التبريد", code: "I", cat: "كشف" },
                { name: "مواسير البنزين", code: "I", cat: "كشف" },
                { name: "مستوى سائل البطارية", code: "I", cat: "كشف" },
                { name: "خطوط الفرامل والخراطيم", code: "I", cat: "كشف" },
                { name: "فرامل اليد", code: "I", cat: "كشف" },
                { name: "وحدة كبح معززة", code: "I", cat: "كشف" },
                { name: "هوبات وأقمشة الفرامل", code: "I", cat: "كشف" },
                { name: "عجلة القيادة", code: "I", cat: "كشف" },
                { name: "نظام التعليق", code: "I", cat: "كشف" },
                { name: "جلود العكوس", code: "I", cat: "كشف" },
                { name: "نظام العادم", code: "I", cat: "كشف" },
                { name: "الاطارات", code: "I", cat: "كشف" },
                { name: "منظف الرواسب (بخاخات)", code: "F", cat: "خدمة سريعة" },
                { name: "عكس الاطارات", code: "R", cat: "خدمة سريعة" }
            ];

            const getPrefix = (code) => {
                switch (code) {
                    case 'I': return 'كشف على';
                    case 'C': return 'تنظيف';
                    case 'T': return 'تربيط';
                    case 'R': return 'غيار';
                    case 'F': return 'إضافة';
                    default: return '';
                }
            };

            for (let km = 10000; km <= 160000; km += 10000) {
                let items = [...commonItems];

                // فلتر الهواء
                if (km % 20000 === 0) items.push({ name: "فلتر الهواء", code: "R", cat: "مكانيكا" });
                else items.push({ name: "فلتر الهواء", code: "C", cat: "خدمة سريعة" });

                // البواجي
                if (km % 60000 === 0) items.push({ name: "البواجي", code: "R", cat: "مكانيكا" });

                // سائل الفرامل
                if (km % 40000 === 0) items.push({ name: "سائل الفرامل", code: "R", cat: "مكانيكا" });
                else items.push({ name: "سائل الفرامل", code: "I", cat: "كشف" });

                // المزاليج والصواميل (تربيط)
                if (km % 20000 === 0) items.push({ name: "المزاليج والصواميل (أسفل السيارة)", code: "T", cat: "مكانيكا" });

                // فلتر المكيف
                if (km % 20000 === 0) items.push({ name: "فلتر المكيف", code: "R", cat: "تكييف" });

                // فلتر البنزين
                if (km % 60000 === 0) items.push({ name: "فلتر البنزين", code: "R", cat: "مكانيكا" });

                // Construct Bundle
                const bundleName = `صيانة ${km.toLocaleString()} كم`;
                const result = await dbRun("INSERT INTO inspection_bundles (name, icon) VALUES (?, ?)", [bundleName, "🚗"]);
                const bundleId = result.lastID;

                for (const item of items) {
                    const desc = `${getPrefix(item.code)} ${item.name}`;
                    await dbRun("INSERT INTO inspection_bundle_items (bundle_id, service_description, category) VALUES (?, ?, ?)",
                        [bundleId, desc, item.cat]);
                }
            }
            console.log('🌱 تم بذر باقات الصيانة الدورية بنجاح');
        }

        console.log('✅ تم الانتهاء من تهيئة قاعدة البيانات');
    } catch (err) {
        console.error('❌ خطأ في تهيئة قاعدة البيانات:', err.message);
    }
}

// ==========================
// 🔐 نظام المصادقة (Auth)
// ==========================
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await dbGet('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
        if (user) {
            res.json(user);
        } else {
            const employee = await dbGet(`
                SELECT e.*, u.username, u.role, u.id as user_id 
                FROM employees e
                JOIN users u ON e.id = u.employee_id
                WHERE u.username = ? AND u.password = ? AND e.is_active = 1
            `, [username, password]);

            if (employee) {
                res.json({
                    id: employee.user_id,
                    employee_id: employee.id,
                    username: employee.username,
                    role: employee.role,
                    name: employee.name
                });
            } else {
                res.status(401).json({ message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
            }
        }
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ message: "خطأ في تسجيل الدخول" });
    }
});

// ==========================
// 📁 إدارة الأقسام (Sections)
// ==========================
app.get('/api/sections', async (req, res) => {
    try {
        const sections = await dbAll('SELECT * FROM sections');
        res.json(sections);
    } catch (error) {
        res.status(500).json({ message: "خطأ في جلب الأقسام" });
    }
});

// ==========================
// 👥 إدارة الموظفين (Employees)
// ==========================
app.get('/api/employees', async (req, res) => {
    try {
        const employees = await dbAll(`
            SELECT e.*, 
                   COALESCE((SELECT SUM(income) FROM entries WHERE employee_id = e.id), 0) as total_income,
                   COALESCE((SELECT SUM(amount) FROM withdrawals WHERE employee_id = e.id AND status = 'approved'), 0) as total_withdrawal,
                   u.username, u.password
            FROM employees e
            LEFT JOIN users u ON e.id = u.employee_id
            WHERE e.is_active = 1
        `);
        res.json(employees);
    } catch (error) {
        console.error("Fetch Employees Error:", error);
        res.status(500).json({ message: "خطأ في جلب الموظفين" });
    }
});

app.post('/api/employees', async (req, res) => {
    const { name, section_id, target, base_salary, username, password, hide_income } = req.body;
    try {
        await dbRun('BEGIN TRANSACTION');
        const empResult = await dbRun(
            'INSERT INTO employees (name, section_id, target, base_salary, hide_income) VALUES (?, ?, ?, ?, ?)',
            [name, section_id, target || 0, base_salary || 0, hide_income || 0]
        );
        const employee_id = empResult.lastID;

        if (username && password) {
            await dbRun(
                'INSERT INTO users (employee_id, username, password, role) VALUES (?, ?, ?, ?)',
                [employee_id, username, password, 'employee']
            );
        }
        await dbRun('COMMIT');
        res.status(201).json({ message: "تمت إضافة الموظف بنجاح", id: employee_id });
    } catch (error) {
        await dbRun('ROLLBACK');
        console.error("Add Employee Error:", error);
        res.status(500).json({ message: "خطأ في إضافة الموظف" });
    }
});

app.put('/api/employees/:id', async (req, res) => {
    const { id } = req.params;
    const { name, section_id, target, base_salary, username, password, hide_income, is_active } = req.body;
    try {
        await dbRun('BEGIN TRANSACTION');
        await dbRun(
            'UPDATE employees SET name = ?, section_id = ?, target = ?, base_salary = ?, hide_income = ?, is_active = ? WHERE id = ?',
            [name, section_id, target, base_salary, hide_income, is_active !== undefined ? is_active : 1, id]
        );

        if (username && password) {
            const user = await dbGet('SELECT * FROM users WHERE employee_id = ?', [id]);
            if (user) {
                await dbRun('UPDATE users SET username = ?, password = ? WHERE employee_id = ?', [username, password, id]);
            } else {
                await dbRun('INSERT INTO users (employee_id, username, password, role) VALUES (?, ?, ?, ?)', [id, username, password, 'employee']);
            }
        }
        await dbRun('COMMIT');
        res.json({ message: "تم تحديث بيانات الموظف بنجاح" });
    } catch (error) {
        await dbRun('ROLLBACK');
        console.error("Update Employee Error:", error);
        res.status(500).json({ message: "خطأ في تحديث بيانات الموظف" });
    }
});

app.delete('/api/employees/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await dbRun('UPDATE employees SET is_active = 0 WHERE id = ?', [id]);
        res.json({ message: "تم حذف الموظف بنجاح" });
    } catch (error) {
        res.status(500).json({ message: "خطأ في حذف الموظف" });
    }
});

// ==========================
// 💰 الدخل والسحوبات (Income & Withdrawals)
// ==========================
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
        res.status(500).json({ message: "خطأ في جلب السحوبات المعلقة" });
    }
});

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
        res.status(500).json({ message: "خطأ في جلب سجل السحوبات" });
    }
});

app.put('/api/withdrawals/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status, admin_note } = req.body;
    try {
        await dbRun('UPDATE withdrawals SET status = ?, admin_note = ? WHERE id = ?', [status, admin_note, id]);
        res.json({ message: "تم تحديث حالة السحب" });
    } catch (error) {
        res.status(500).json({ message: "خطأ في تحديث حالة السحب" });
    }
});

app.post('/api/withdrawals/batch', async (req, res) => {
    const { employee_ids, amount, reason, date } = req.body;
    const withdrawalDate = date || new Date().toISOString().split('T')[0];
    try {
        const promises = employee_ids.map(id =>
            dbRun(`INSERT INTO withdrawals(employee_id, amount, reason, date, status) VALUES(?, ?, ?, ?, 'approved')`,
                [id, amount, reason, withdrawalDate])
        );
        await Promise.all(promises);
        res.json({ message: `تم إضافة السحوبات لـ ${employee_ids.length} موظف بنجاح` });
    } catch (error) {
        res.status(500).json({ message: "خطأ في إضافة السحوبات الجماعية" });
    }
});

app.get('/api/employees/:id/entries', async (req, res) => {
    const { id } = req.params;
    try {
        const entries = await dbAll(`SELECT * FROM entries WHERE employee_id = ? ORDER BY created_at DESC`, [id]);
        res.json(entries);
    } catch (error) {
        res.status(500).json({ message: "خطأ في جلب دخل الموظف" });
    }
});

app.get('/api/employees/:id/withdrawals', async (req, res) => {
    const { id } = req.params;
    try {
        const withdrawals = await dbAll(`SELECT * FROM withdrawals WHERE employee_id = ? ORDER BY date DESC`, [id]);
        res.json(withdrawals);
    } catch (error) {
        res.status(500).json({ message: "خطأ في جلب سحوبات الموظف" });
    }
});

// ==========================
// 📅 الغيابات (Absences)
// ==========================
app.post('/api/absences', async (req, res) => {
    const { employee_id, date, reason } = req.body;
    try {
        await dbRun(`INSERT INTO absences(employee_id, date, reason) VALUES(?, ?, ?)`, [employee_id, date, reason]);
        res.status(201).json({ message: "تم تسجيل الغياب بنجاح" });
    } catch (error) {
        res.status(500).json({ message: "خطأ في تسجيل الغياب" });
    }
});

app.get('/api/absences', async (req, res) => {
    const { from, to, employee_id } = req.query;
    try {
        let query = `SELECT a.*, e.name as employee_name FROM absences a JOIN employees e ON a.employee_id = e.id WHERE 1=1`;
        let params = [];
        if (from && to) { query += ` AND a.date BETWEEN ? AND ?`; params.push(from, to); }
        if (employee_id) { query += ` AND a.employee_id = ?`; params.push(employee_id); }
        query += ` ORDER BY a.date DESC`;
        const absences = await dbAll(query, params);
        res.json(absences);
    } catch (error) {
        res.status(500).json({ message: "خطأ في جلب الغيابات" });
    }
});

// ==========================
// 🏖️ إدارة الإجازات (Leave Management)
// ==========================
function calculateBusinessDays(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let count = 0;
    const current = new Date(start);
    while (current <= end) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 5 && dayOfWeek !== 6) count++;
        current.setDate(current.getDate() + 1);
    }
    return count;
}

async function getLeaveBalance(employee_id) {
    const result = await dbGet(`SELECT COALESCE(SUM(days_count), 0) as used_days FROM leave_requests WHERE employee_id = ? AND status = 'approved'`, [employee_id]);
    return { total: 21, used: result.used_days, remaining: 21 - result.used_days };
}

app.post('/api/leave-requests', async (req, res) => {
    const { employee_id, leave_type, start_date, end_date, reason } = req.body;
    try {
        const days_count = calculateBusinessDays(start_date, end_date);
        if (days_count <= 0) return res.status(400).json({ message: 'التواريخ غير صحيحة' });
        const balance = await getLeaveBalance(employee_id);
        if (days_count > balance.remaining) return res.status(400).json({ message: `رصيدك غير كافٍ. المتبقي: ${balance.remaining} يوم` });
        await dbRun(`INSERT INTO leave_requests(employee_id, leave_type, start_date, end_date, days_count, reason) VALUES(?, ?, ?, ?, ?, ?)`,
            [employee_id, leave_type || 'annual', start_date, end_date, days_count, reason]);
        res.json({ message: 'تم إرسال طلب الإجازة بنجاح', days_count });
    } catch (error) {
        res.status(500).json({ message: 'خطأ في إنشاء طلب الإجازة' });
    }
});

app.get('/api/leave-requests', async (req, res) => {
    const { status, employee_id } = req.query;
    try {
        let sql = `SELECT lr.*, e.name AS employee_name FROM leave_requests lr JOIN employees e ON lr.employee_id = e.id WHERE 1=1`;
        let params = [];
        if (status) { sql += ` AND lr.status = ?`; params.push(status); }
        if (employee_id) { sql += ` AND lr.employee_id = ?`; params.push(employee_id); }
        sql += ` ORDER BY lr.created_at DESC`;
        const requests = await dbAll(sql, params);
        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: 'خطأ في جلب طلبات الإجازة' });
    }
});

app.get('/api/leave-requests/employee/:id', async (req, res) => {
    try {
        const requests = await dbAll(`SELECT * FROM leave_requests WHERE employee_id = ? ORDER BY created_at DESC`, [req.params.id]);
        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: 'خطأ في جلب طلبات الإجازة' });
    }
});

app.put('/api/leave-requests/:id', async (req, res) => {
    const { id } = req.params;
    const { status, admin_notes } = req.body;
    try {
        await dbRun(`UPDATE leave_requests SET status = ?, admin_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [status, admin_notes, id]);
        res.json({ message: `تم ${status === 'approved' ? 'قبول' : 'رفض'} الطلب بنجاح` });
    } catch (error) {
        res.status(500).json({ message: 'خطأ في تحديث طلب الإجازة' });
    }
});

app.get('/api/leave-balance/:employee_id', async (req, res) => {
    try {
        const balance = await getLeaveBalance(req.params.employee_id);
        res.json(balance);
    } catch (error) {
        res.status(500).json({ message: 'خطأ في جلب رصيد الإجازات' });
    }
});

app.get('/api/leave-balances', async (req, res) => {
    try {
        const employees = await dbAll(`SELECT id, name FROM employees WHERE is_active = 1`);
        const balances = await Promise.all(employees.map(async (emp) => {
            const balance = await getLeaveBalance(emp.id);
            return { employee_id: emp.id, employee_name: emp.name, ...balance };
        }));
        res.json(balances);
    } catch (error) {
        res.status(500).json({ message: 'خطأ في جلب أرصدة الإجازات' });
    }
});

// ==========================
// 🏗️ إدارة الرافعات (Lifts)
// ==========================
app.get('/api/lifts', async (req, res) => {
    try {
        const lifts = await dbAll(`SELECT l.*, e.name AS technician_name FROM workshop_lifts l LEFT JOIN employees e ON l.technician_id = e.id ORDER BY l.id`);
        res.json(lifts);
    } catch (error) {
        res.status(500).json({ message: 'خطأ في جلب بيانات الرافعات' });
    }
});

app.put('/api/lifts/:id', async (req, res) => {
    const { id } = req.params;
    const { status, technician_id, issue_description } = req.body;
    try {
        let updates = [];
        let params = [];
        if (status) { updates.push('status = ?'); params.push(status); }
        if (technician_id !== undefined) { updates.push('technician_id = ?'); params.push(technician_id); }
        if (issue_description !== undefined) { updates.push('issue_description = ?'); params.push(issue_description); }
        updates.push('last_updated = CURRENT_TIMESTAMP');
        const sql = `UPDATE workshop_lifts SET ${updates.join(', ')} WHERE id = ?`;
        params.push(id);
        await dbRun(sql, params);
        res.json({ message: 'تم تحديث حالة الرافعة بنجاح' });
    } catch (error) {
        res.status(500).json({ message: 'خطأ في تحديث الرافعة' });
    }
});

app.post('/api/lifts/:id/release', async (req, res) => {
    try {
        await dbRun(`UPDATE workshop_lifts SET status = 'idle', technician_id = NULL, issue_description = NULL, last_updated = CURRENT_TIMESTAMP WHERE id = ?`, [req.params.id]);
        res.json({ message: 'تم إخلاء الرافعة بنجاح' });
    } catch (error) {
        res.status(500).json({ message: 'خطأ في إخلاء الرافعة' });
    }
});

// ==========================
// 📅 الحضور والانصراف (Attendance)
// ==========================
app.post('/api/attendance/check-in', async (req, res) => {
    const { employee_id } = req.body;
    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toISOString();
    try {
        const existing = await dbGet('SELECT * FROM attendance WHERE employee_id = ? AND date = ?', [employee_id, date]);
        if (existing) return res.status(400).json({ message: 'تم تسجيل الحضور مسبقاً لهذا اليوم' });
        await dbRun(`INSERT INTO attendance(employee_id, date, check_in) VALUES(?, ?, ?)`, [employee_id, date, time]);
        res.json({ message: 'تم تسجيل الحضور بنجاح', time });
    } catch (error) {
        res.status(500).json({ message: "خطأ في تسجيل الحضور" });
    }
});

app.post('/api/attendance/check-out', async (req, res) => {
    const { employee_id } = req.body;
    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toISOString();
    try {
        const existing = await dbGet('SELECT * FROM attendance WHERE employee_id = ? AND date = ?', [employee_id, date]);
        if (!existing) return res.status(400).json({ message: 'يجب تسجيل الحضور أولاً' });
        if (existing.check_out) return res.status(400).json({ message: 'تم تسجيل الانصراف مسبقاً' });
        await dbRun(`UPDATE attendance SET check_out = ? WHERE id = ?`, [time, existing.id]);
        res.json({ message: 'تم تسجيل الانصراف بنجاح', time });
    } catch (error) {
        res.status(500).json({ message: "خطأ في تسجيل الانصراف" });
    }
});

app.get('/api/attendance/status/:employee_id', async (req, res) => {
    const date = new Date().toISOString().split('T')[0];
    try {
        const status = await dbGet('SELECT * FROM attendance WHERE employee_id = ? AND date = ?', [req.params.employee_id, date]);
        res.json(status || { status: 'not_marked' });
    } catch (error) {
        res.status(500).json({ message: "خطأ في جلب حالة الحضور" });
    }
});

app.get('/api/attendance/report', async (req, res) => {
    const targetDate = req.query.date || new Date().toISOString().split('T')[0];
    try {
        const report = await dbAll(`
            SELECT e.id AS employee_id, e.name AS employee_name, s.name AS section_name, a.check_in, a.check_out, a.status, a.date
            FROM employees e
            LEFT JOIN sections s ON e.section_id = s.id
            LEFT JOIN attendance a ON e.id = a.employee_id AND a.date = ?
            WHERE e.is_active = 1
            ORDER BY s.name, e.name
        `, [targetDate]);
        res.json(report);
    } catch (error) {
        res.status(500).json({ message: "خطأ في جلب تقرير الحضور" });
    }
});

// ==========================
// 💬 المحادثة (Chat)
// ==========================
app.get('/api/messages/:employee_id', async (req, res) => {
    try {
        const messages = await dbAll(`SELECT * FROM messages WHERE employee_id = ? ORDER BY created_at ASC`, [req.params.employee_id]);
        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: "خطأ في جلب الرسائل" });
    }
});

app.post('/api/messages', async (req, res) => {
    const { employee_id, sender, message } = req.body;
    try {
        await dbRun(`INSERT INTO messages(employee_id, sender, message) VALUES(?, ?, ?)`, [employee_id, sender, message]);
        res.json({ message: "تم الإرسال" });
    } catch (error) {
        res.status(500).json({ message: "خطأ في إرسال الرسالة" });
    }
});

app.put('/api/messages/mark-read', async (req, res) => {
    const { employee_id, reader } = req.body;
    try {
        const senderToMark = reader === 'admin' ? 'employee' : 'admin';
        await dbRun(`UPDATE messages SET is_read = 1 WHERE employee_id = ? AND sender = ?`, [employee_id, senderToMark]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: "خطأ في تحديث حالة القراءة" });
    }
});

app.get('/api/messages/unread/admin', async (req, res) => {
    try {
        const counts = await dbAll(`SELECT employee_id, COUNT(*) as count FROM messages WHERE sender = 'employee' AND is_read = 0 GROUP BY employee_id`);
        res.json(counts);
    } catch (error) {
        res.status(500).json({ message: "خطأ" });
    }
});

app.get('/api/messages/unread/employee/:id', async (req, res) => {
    try {
        const result = await dbGet(`SELECT COUNT(*) as count FROM messages WHERE employee_id = ? AND sender = 'admin' AND is_read = 0`, [req.params.id]);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: "خطأ" });
    }
});

// ==========================
// 🔔 الإشعارات (Notifications)
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
        res.status(500).json({ message: "خطأ في جلب الإشعارات" });
    }
});

// ==========================
// 🔍 نظام الكشف (Inspections)
// ==========================
app.post('/api/inspections', async (req, res) => {
    const { inspector_id, customer_name, customer_phone, car_type, car_color, car_model, plate_number, odometer, vin, items, total_amount, vat_amount, final_amount, paid_amount, remaining_amount } = req.body;
    try {
        await dbRun('BEGIN TRANSACTION');
        const inspResult = await dbRun(`
            INSERT INTO inspections(inspector_id, customer_name, customer_phone, car_type, car_color, car_model, plate_number, odometer, vin, total_amount, vat_amount, final_amount, paid_amount, remaining_amount)
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [inspector_id, customer_name || '', customer_phone || '', car_type || '', car_color || '', car_model || '', plate_number || '', odometer || '', vin || '', total_amount || 0, vat_amount || 0, final_amount || 0, paid_amount || 0, remaining_amount || 0]);
        const inspection_id = inspResult.lastID;
        if (items && Array.isArray(items)) {
            for (const item of items) {
                if (item.service_description) {
                    await dbRun(`INSERT INTO inspection_items(inspection_id, category, service_description, quantity, price, total) VALUES(?, ?, ?, ?, ?, ?)`,
                        [inspection_id, item.category, item.service_description, item.quantity || 1, item.price || 0, item.total || 0]);
                    await dbRun(`INSERT OR IGNORE INTO inspection_terms(term) VALUES(?)`, [item.service_description]);
                }
            }
        }
        await dbRun('COMMIT');
        res.status(201).json({ message: "تم حفظ الكشف بنجاح", id: inspection_id });
    } catch (error) {
        await dbRun('ROLLBACK');
        res.status(500).json({ message: "خطأ في حفظ الكشف" });
    }
});

app.put('/api/inspections/:id', async (req, res) => {
    const { id } = req.params;
    const { customer_name, customer_phone, car_type, car_color, car_model, plate_number, odometer, vin, items, total_amount, vat_amount, final_amount, paid_amount, remaining_amount } = req.body;
    try {
        await dbRun('BEGIN TRANSACTION');
        await dbRun(`UPDATE inspections SET customer_name = ?, customer_phone = ?, car_type = ?, car_color = ?, car_model = ?, plate_number = ?, odometer = ?, vin = ?, total_amount = ?, vat_amount = ?, final_amount = ?, paid_amount = ?, remaining_amount = ? WHERE id = ?`,
            [customer_name || '', customer_phone || '', car_type || '', car_color || '', car_model || '', plate_number || '', odometer || '', vin || '', total_amount || 0, vat_amount || 0, final_amount || 0, paid_amount || 0, remaining_amount || 0, id]);
        await dbRun(`DELETE FROM inspection_items WHERE inspection_id = ?`, [id]);
        if (items && Array.isArray(items)) {
            for (const item of items) {
                if (item.service_description) {
                    await dbRun(`INSERT INTO inspection_items(inspection_id, category, service_description, quantity, price, total) VALUES(?, ?, ?, ?, ?, ?)`,
                        [id, item.category, item.service_description, item.quantity || 1, item.price || 0, item.total || 0]);
                    await dbRun(`INSERT OR IGNORE INTO inspection_terms(term) VALUES(?)`, [item.service_description]);
                }
            }
        }
        await dbRun('COMMIT');
        res.json({ message: "تم تحديث الكشف بنجاح", id });
    } catch (error) {
        await dbRun('ROLLBACK');
        res.status(500).json({ message: "خطأ في تحديث الكشف" });
    }
});

app.get('/api/inspections/:id', async (req, res) => {
    try {
        const inspection = await dbGet(`SELECT * FROM inspections WHERE id = ?`, [req.params.id]);
        if (!inspection) return res.status(404).json({ message: "الكشف غير موجود" });
        const items = await dbAll(`SELECT * FROM inspection_items WHERE inspection_id = ?`, [req.params.id]);
        res.json({ ...inspection, items });
    } catch (error) {
        res.status(500).json({ message: "خطأ في جلب تفاصيل الكشف" });
    }
});

app.get('/api/inspections/search', async (req, res) => {
    const { query } = req.query;
    if (!query) return res.json([]);
    try {
        const inspections = await dbAll(`
            SELECT i.*, e.name as inspector_name FROM inspections i LEFT JOIN employees e ON i.inspector_id = e.id
            WHERE CAST(i.id AS TEXT) LIKE ? OR i.customer_phone LIKE ? OR i.plate_number LIKE ?
            ORDER BY i.created_at DESC LIMIT 20
        `, [`%${query}%`, `%${query}%`, `%${query}%`]);
        res.json(inspections);
    } catch (error) {
        res.status(500).json({ message: "خطأ في البحث" });
    }
});

app.get('/api/inspections/inspector/:id', async (req, res) => {
    try {
        const inspections = await dbAll(`SELECT * FROM inspections WHERE inspector_id = ? ORDER BY created_at DESC`, [req.params.id]);
        res.json(inspections);
    } catch (error) {
        res.status(500).json({ message: "خطأ في جلب الكشوفات" });
    }
});

app.get('/api/admin/inspection-stats', async (req, res) => {
    try {
        const stats = await dbAll(`
            SELECT e.name as inspector_name, COUNT(i.id) as total_inspections, SUM(i.final_amount) as total_value
            FROM employees e LEFT JOIN inspections i ON e.id = i.inspector_id
            WHERE e.section_id = (SELECT id FROM sections WHERE name = 'كشف')
            GROUP BY e.id
        `);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: "خطأ في جلب إحصائيات الكشوفات" });
    }
});

app.get('/api/inspector-stats/:id', async (req, res) => {
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    try {
        const count = await dbGet(`SELECT COUNT(*) as count FROM inspections WHERE inspector_id = ? AND created_at >= ?`, [req.params.id, monthStart.toISOString()]);
        res.json(count);
    } catch (error) {
        res.status(500).json({ message: "خطأ في جلب الإحصائيات" });
    }
});

app.get('/api/inspection-terms', async (req, res) => {
    try {
        const terms = await dbAll(`SELECT term FROM inspection_terms ORDER BY term ASC`);
        res.json(terms.map(t => t.term));
    } catch (error) {
        res.status(500).json({ message: "خطأ في جلب المصطلحات" });
    }
});

// ==========================
// 🛠️ الخدمات (Services)
// ==========================
app.get('/api/services', async (req, res) => {
    try {
        const services = await dbAll(`SELECT * FROM services ORDER BY category, service_name`);
        res.json(services);
    } catch (error) {
        res.status(500).json({ message: "خطأ في جلب الخدمات" });
    }
});

app.post('/api/services', async (req, res) => {
    const { category, service_name, price } = req.body;
    try {
        const result = await dbRun(`INSERT INTO services(category, service_name, price) VALUES(?, ?, ?)`, [category, service_name, price || 0]);
        res.status(201).json({ message: "تمت إضافة الخدمة بنجاح", id: result.lastID });
    } catch (error) {
        res.status(500).json({ message: "خطأ في إضافة الخدمة" });
    }
});

app.put('/api/services/:id', async (req, res) => {
    const { category, service_name, price } = req.body;
    try {
        await dbRun(`UPDATE services SET category = ?, service_name = ?, price = ? WHERE id = ?`, [category, service_name, price, req.params.id]);
        res.json({ message: "تم تحديث الخدمة بنجاح" });
    } catch (error) {
        res.status(500).json({ message: "خطأ في تحديث الخدمة" });
    }
});

app.delete('/api/services/:id', async (req, res) => {
    try {
        await dbRun(`DELETE FROM services WHERE id = ?`, [req.params.id]);
        res.json({ message: "تم حذف الخدمة بنجاح" });
    } catch (error) {
        res.status(500).json({ message: "خطأ في حذف الخدمة" });
    }
});

// ==========================
// 🚀 الباقات (Bundles)
// ==========================
app.get('/api/inspection-bundles', async (req, res) => {
    try {
        const bundles = await dbAll(`SELECT * FROM inspection_bundles`);
        for (let bundle of bundles) {
            bundle.items = await dbAll(`SELECT service_description, category FROM inspection_bundle_items WHERE bundle_id = ?`, [bundle.id]);
        }
        res.json(bundles);
    } catch (error) {
        res.status(500).json({ message: "خطأ في جلب الاختصارات" });
    }
});

app.post('/api/inspection-bundles', async (req, res) => {
    const { name, icon, items } = req.body;
    try {
        await dbRun('BEGIN TRANSACTION');
        const result = await dbRun(`INSERT INTO inspection_bundles(name, icon) VALUES(?, ?)`, [name, icon]);
        const bundle_id = result.lastID;
        for (const item of items) {
            await dbRun(`INSERT INTO inspection_bundle_items(bundle_id, service_description, category) VALUES(?, ?, ?)`, [bundle_id, item.service_description, item.category]);
        }
        await dbRun('COMMIT');
        res.status(201).json({ message: "تم إضافة الاختصار بنجاح", id: bundle_id });
    } catch (error) {
        await dbRun('ROLLBACK');
        res.status(500).json({ message: "خطأ في إضافة الاختصار" });
    }
});

app.put('/api/inspection-bundles/:id', async (req, res) => {
    const { name, icon, items } = req.body;
    const { id } = req.params;
    try {
        await dbRun('BEGIN TRANSACTION');
        await dbRun(`UPDATE inspection_bundles SET name = ?, icon = ? WHERE id = ?`, [name, icon, id]);
        await dbRun(`DELETE FROM inspection_bundle_items WHERE bundle_id = ?`, [id]);
        for (const item of items) {
            await dbRun(`INSERT INTO inspection_bundle_items(bundle_id, service_description, category) VALUES(?, ?, ?)`, [id, item.service_description, item.category]);
        }
        await dbRun('COMMIT');
        res.json({ message: "تم تحديث الاختصار بنجاح" });
    } catch (error) {
        await dbRun('ROLLBACK');
        res.status(500).json({ message: "خطأ في تحديث الاختصار" });
    }
});

app.delete('/api/inspection-bundles/:id', async (req, res) => {
    try {
        await dbRun(`DELETE FROM inspection_bundles WHERE id = ?`, [req.params.id]);
        res.json({ message: "تم حذف الاختصار بنجاح" });
    } catch (error) {
        res.status(500).json({ message: "خطأ في حذف الاختصار" });
    }
});

// ==========================
// 💾 النسخ الاحتياطي (Backup)
// ==========================
app.get('/api/backup', (req, res) => {
    const date = new Date().toISOString().split('T')[0];
    res.download(dbPath, `backup_workshop_${date}.sqlite`, (err) => {
        if (err) res.status(500).send("Could not download backup");
    });
});


// ==========================
// 📊 إحصائيات الموظف (Employee Stats)
// ==========================
app.get('/api/employee-stats/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const employee = await dbGet(`
            SELECT e.*, s.name as section_name 
            FROM employees e 
            LEFT JOIN sections s ON e.section_id = s.id 
            WHERE e.id = ?
        `, [id]);

        if (!employee) {
            return res.status(404).json({ message: "الموظف غير موجود" });
        }

        const incomeResult = await dbGet(`SELECT SUM(income) as total FROM entries WHERE employee_id = ?`, [id]);
        const withdrawalResult = await dbGet(`SELECT SUM(amount) as total FROM withdrawals WHERE employee_id = ? AND status = 'approved'`, [id]);

        const totalIncome = incomeResult.total || 0;
        const totalWithdrawals = withdrawalResult.total || 0;

        res.json({
            info: employee,
            total_income: totalIncome,
            total_withdrawals: totalWithdrawals,
            income_hidden: employee.hide_income === 1
        });
    } catch (error) {
        console.error("Employee Stats Error:", error);
        res.status(500).json({ message: "خطأ في جلب إحصائيات الموظف" });
    }
});

// ==========================
// 🚀 تشغيل السيرفر
// ==========================
app.listen(PORT, () => {
    console.log('\n🎉 ====================================');
    console.log('🚀 تم تشغيل السيرفر بنجاح!');
    console.log(`📍 العنوان: http://localhost:${PORT}`);
    console.log('====================================\n');
});