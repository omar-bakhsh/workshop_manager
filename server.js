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

// Configure upload storage with extensions
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const photoStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, 'uploads', 'inspection_photos');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname) || '.jpg';
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'photo-' + uniqueSuffix + ext);
    }
});
const uploadPhoto = multer({
    storage: photoStorage,
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});

const upload = multer({ dest: 'uploads/' });
const xlsx = require('xlsx');

const app = express();
const PORT = process.env.PORT || 8080;

// ==========================
// 🧩 الإعدادات العامة
// ==========================
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '.')));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// توجيه الصفحة الرئيسية إلى صفحة تسجيل الدخول
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

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
            name TEXT UNIQUE NOT NULL,
            shift_start TEXT DEFAULT '08:00',
            shift_end TEXT DEFAULT '18:00'
        )`,
        `CREATE TABLE IF NOT EXISTS employees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            section_id INTEGER,
            target INTEGER NOT NULL DEFAULT 0,
            base_salary INTEGER DEFAULT 0,
            target_amount REAL DEFAULT 0,
            deposit_amount REAL DEFAULT 0,
            total_withdrawals REAL DEFAULT 0,
            remaining_salary REAL DEFAULT 0,
            net_remaining REAL DEFAULT 0,
            bank_name TEXT DEFAULT 'كاش',
            last_sync_at TIMESTAMP,
            is_active INTEGER DEFAULT 1,
            hide_income INTEGER DEFAULT 0,
            FOREIGN KEY (section_id) REFERENCES sections(id)
        )`,
        `CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
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
        `CREATE TABLE IF NOT EXISTS branch_shifts (
            day_of_week INTEGER PRIMARY KEY, -- 0-6 (Sunday-Saturday)
            shift_start TEXT DEFAULT '08:00',
            shift_end TEXT DEFAULT '18:00',
            is_closed INTEGER DEFAULT 0
        )`,
        `CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            date DATE DEFAULT CURRENT_DATE,
            check_in TIMESTAMP,
            check_out TIMESTAMP,
            status TEXT DEFAULT 'present',
            delay_minutes INTEGER DEFAULT 0,
            early_departure_minutes INTEGER DEFAULT 0,
            overtime_minutes INTEGER DEFAULT 0,
            shift_start TEXT,
            shift_end TEXT,
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
        `CREATE TABLE IF NOT EXISTS sys_notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            recipient_type TEXT NOT NULL,
            recipient_id INTEGER,
            title TEXT,
            message TEXT,
            type TEXT DEFAULT 'info',
            is_read INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

    db.serialize(() => {
        tables.forEach(table => {
            db.run(table, (err) => {
                if (err) console.error('❌ خطأ في إنشاء الجدول:', err.message);
            });
        });

        // إضافة الأعمدة المفقودة للموظفين (Migration)
        db.run(`ALTER TABLE employees ADD COLUMN bank_name TEXT DEFAULT 'كاش'`, (err) => {
            if (!err) console.log('✅ تم إضافة عمود bank_name');
        });

        // تهيئة الإعدادات الافتراضية
        db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('app_name', 'Atenza App')`);
        db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('workshop_name', 'Atenza App')`);
        db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('max_withdrawal_limit', '500')`);

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

        // تحديث هيكلية الحضور للمناوبات المتقدمة
        db.run(`ALTER TABLE attendance ADD COLUMN early_departure_minutes INTEGER DEFAULT 0`, (err) => {});
        db.run(`ALTER TABLE attendance ADD COLUMN overtime_minutes INTEGER DEFAULT 0`, (err) => {});
        db.run(`ALTER TABLE attendance ADD COLUMN shift_start TEXT`, (err) => {});
        db.run(`ALTER TABLE attendance ADD COLUMN shift_end TEXT`, (err) => {});

        // تحديث هيكلية الكشوفات وأوامر العمل
        db.run(`ALTER TABLE inspections ADD COLUMN status TEXT DEFAULT 'new'`, (err) => {});
        db.run(`ALTER TABLE inspections ADD COLUMN car_status TEXT DEFAULT 'in_progress'`, (err) => {});
        db.run(`ALTER TABLE inspections ADD COLUMN assigned_technician_id INTEGER`, (err) => {});
        db.run(`ALTER TABLE inspections ADD COLUMN job_order_notes TEXT`, (err) => {});
        db.run(`ALTER TABLE inspections ADD COLUMN car_defects_diagram TEXT`, (err) => {});
        db.run(`ALTER TABLE inspections ADD COLUMN odometer TEXT`, (err) => {});
        db.run(`ALTER TABLE inspections ADD COLUMN vin TEXT`, (err) => {});
        db.run(`CREATE TABLE IF NOT EXISTS inspection_technicians (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            inspection_id INTEGER NOT NULL,
            technician_id INTEGER NOT NULL,
            FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE,
            FOREIGN KEY (technician_id) REFERENCES employees(id) ON DELETE CASCADE
        )`, (err) => {});
        
        db.run(`CREATE TABLE IF NOT EXISTS inspection_photos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            inspection_id INTEGER NOT NULL,
            photo_type TEXT DEFAULT 'before', -- 'before', 'damaged_part', 'after'
            file_path TEXT NOT NULL,
            caption TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE
        )`, (err) => {});

        // إضافة حقول قائمة الفحص والإنجاز لبنود الكشف
        db.run(`ALTER TABLE inspection_items ADD COLUMN is_completed INTEGER DEFAULT 0`, (err) => {});
        db.run(`ALTER TABLE inspection_items ADD COLUMN completed_at DATETIME`, (err) => {});
        db.run(`ALTER TABLE inspection_items ADD COLUMN completed_by TEXT`, (err) => {});
        
        // إنشاء جدول مواعيد الفرع إذا لم يوجد وبذره
        const defaultShifts = [
            { day: 0, start: '08:00', end: '18:00', closed: 1 }, // Sunday (Assuming Friday is 5)
            { day: 1, start: '08:00', end: '18:00', closed: 0 },
            { day: 2, start: '08:00', end: '18:00', closed: 0 },
            { day: 3, start: '08:00', end: '18:00', closed: 0 },
            { day: 4, start: '08:00', end: '18:00', closed: 0 },
            { day: 5, start: '08:00', end: '18:00', closed: 0 },
            { day: 6, start: '08:30', end: '17:30', closed: 0 }  // Saturday
        ];
        // Note: JavaScript Date.getDay() is 0=Sunday, 1=Monday, ..., 5=Friday, 6=Saturday
        // Middle east context: Friday (5) usually closed.
        const meShifts = [
            { day: 0, start: '08:00', end: '18:00', closed: 0 }, // Sun
            { day: 1, start: '08:00', end: '18:00', closed: 0 }, // Mon
            { day: 2, start: '08:00', end: '18:00', closed: 0 }, // Tue
            { day: 3, start: '08:00', end: '18:00', closed: 0 }, // Wed
            { day: 4, start: '08:00', end: '18:00', closed: 0 }, // Thu
            { day: 5, start: '08:00', end: '18:00', closed: 1 }, // Fri (Closed)
            { day: 6, start: '08:30', end: '17:30', closed: 0 }  // Sat
        ];

        meShifts.forEach(s => {
            db.run(`INSERT OR IGNORE INTO branch_shifts (day_of_week, shift_start, shift_end, is_closed) VALUES (?, ?, ?, ?)`,
                [s.day, s.start, s.end, s.closed]);
        });

        // بذر الخدمات الافتراضية
        const defaultServices = {
            "نظام التعليق الامامي": [
                { "service": "غيار أقمشة أمامية + مسح هوبات (مخرطة)", "price": 100 },
                { "service": "غيار مساعدات أمامية + كراسي مساعدات", "price": 200 },
                { "service": "غيار مقصات أمامية", "price": 200 }
            ],
            "نظام التعليق الخلفي": [
                { "service": "غيار أقمشة خلفية + مسح هوبات (مخرطة)", "price": 100 },
                { "service": "غيار مقصات خلفية", "price": 200 }
            ],
            "نظام التصفية": [
                { "service": "غيار بواجي + فلتر الهواء + فلتر مكيف", "price": 100 },
                { "service": "فك ثلاجة المحرك + تنظيف بخاخات بجهاز اختبار", "price": 400 },
                { "service": "غيار فلتر البنزين + صفاية", "price": 150 },
                { "service": "تصفية كاملة", "price": 550 },
                { "service": "تصفية بدون بواجي", "price": 450 },
                { "service": "تنظيف حساس m.a.f + حساس m.a.p بالمحاليل", "price": 100 },
                { "service": "تنظيف حساس الشكمان العلوي", "price": 100 }
            ],
            "نظام تبريد المحرك": [
                { "service": "غيار طرمبة ماء", "price": 300 },
                { "service": "فك رديتر المحرك + تركيب (غيار طبة علوية خارجي)", "price": 200 },
                { "service": "غيار بلف الحرارة + ماء رديتر عدد (2)", "price": 150 },
                { "service": "ماء رديتر", "price": 50 }
            ],
            "نظام صوف": [
                { "service": "فك جربكس + غيار صوفة المحرك الخلفية", "price": 1000 }
            ],
            "الزيوت": [
                { "service": "غيار زيت المحرك + فلتر + صرة + وردة", "price": 50 },
                { "service": "غيار زيت الفرامل + تنسيم النظام كامل", "price": 150 },
                { "service": "زيت دبل أمامي", "price": 100 },
                { "service": "زيت الدفرنس", "price": 50 }
            ],
            "كهرباء وتكييف": [
                { "service": "تحديث المحرك PCM", "price": 300 },
                { "service": "تحديث الجربكس TCM (بدون ضمان)", "price": 200 },
                { "service": "تحديث FSC تحسين نظام المسارات", "price": 150 },
                { "service": "فك جرم مراوح + غيار دينمو", "price": 300 },
                { "service": "كشف عام + كشف كمبيوتر", "price": 100 },
                { "service": "تعبئة فريون + زيت بالجهاز", "price": 200 },
                { "service": "فك طبلون أمامي + غيار ثلاجة المكيف", "price": 900 },
                { "service": "غيار بلف التنسيم + جلود ليات الكمبروسر", "price": 250 }
            ],
            "أخرى / قطع غيار": [
                { "service": "محاليل التنظيف", "price": 90 },
                { "service": "سليكون تويوتا أصلي", "price": 100 },
                { "service": "خرط هوبات (للقطعة)", "price": 30 },
                { "service": "غيار سيور المحرك + شداد", "price": 150 }
            ]
        };

        db.get("SELECT COUNT(*) as count FROM services", (err, row) => {
            if (row && row.count === 0) {
                Object.keys(defaultServices).forEach(cat => {
                    defaultServices[cat].forEach(s => {
                        db.run("INSERT INTO services (category, service_name, price) VALUES (?, ?, ?)", [cat, s.service, s.price]);
                    });
                });
                console.log('🌱 تم بذر الخدمات الافتراضية');
            }
        });

        // بذر باقات الكشف الافتراضية
        db.get("SELECT COUNT(*) as count FROM inspection_bundles", (err, row) => {
            if (row && row.count === 0) {
                const defaultBundles = [
                    {
                        name: "نظام الصوف",
                        icon: "🛠️",
                        items: [
                            { service: "فك جربكس غيار صوفة المحرك الخلفية", category: "نظام صوف" },
                            { service: "غيار صوفة الجربكس امامية", category: "نظام صوف" },
                            { service: "غيار صوف العكوس يمين + يسار", category: "نظام صوف" },
                            { service: "فك كرتير المحرك + غيار سليكون", category: "نظام صوف" },
                            { service: "غيار زيت المحرك + فلتر + صرة +وردة", category: "الزيوت" }
                        ]
                    },
                    {
                        name: "نظام الكمبروسر",
                        icon: "❄️",
                        items: [
                            { service: "غيار كمبروسر", category: "كهرباء وتكييف" },
                            { service: "غيار رديتر المكيف", category: "كهرباء وتكييف" },
                            { service: "تنظيف دائرة بفريون 11", category: "كهرباء وتكييف" },
                            { service: "غيار بلف المكيف الامامي", category: "كهرباء وتكييف" },
                            { service: "تعبئة فريون + زيت الكمبروسر بالجهاز", category: "كهرباء وتكييف" },
                            { service: "غيار بلف التنسيم + جلود ليات الكمبروسر", category: "كهرباء وتكييف" },
                            { service: "قطع بلف التنسيم + جلود ليات الكمبروسر", category: "كهرباء وتكييف" }
                        ]
                    },
                    {
                        name: "نظام التصفية",
                        icon: "✅",
                        items: [
                            { service: "غيار بواجي , فلتر هواء ,فلتر مكيف", category: "نظام التصفية" },
                            { service: "غيار فلتر بنزين + صفاية صغيرة", category: "نظام التصفية" },
                            { service: "تنظيف بخاخات خارجي", category: "نظام التصفية" },
                            { service: "تنظيف حساس ماب + ماف", category: "نظام التصفية" },
                            { service: "غيار بلف البخار , قاعدة بلف البخار كاملة", category: "نظام التصفية" },
                            { service: "تنظيف ثلاجة المحرك", category: "نظام التصفية" }
                        ]
                    }
                ];

                defaultBundles.forEach(b => {
                    db.run("INSERT INTO inspection_bundles (name, icon) VALUES (?, ?)", [b.name, b.icon], function (err) {
                        if (!err) {
                            const bundleId = this.lastID;
                            b.items.forEach(item => {
                                db.run("INSERT INTO inspection_bundle_items (bundle_id, service_description, category) VALUES (?, ?, ?)",
                                    [bundleId, item.service, item.category]);
                            });
                        }
                    });
                });
                console.log('🌱 تم بذر باقات الكشف الافتراضية');
            }
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
            SELECT u.*, e.name AS employee_name, e.id AS employee_id, e.section_id, s.name AS section_name
            FROM users u
            LEFT JOIN employees e ON u.employee_id = e.id
            LEFT JOIN sections s ON e.section_id = s.id
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
    const { name, section_id, target, base_salary, target_amount, deposit_amount, total_withdrawals, username, password, hide_income, bank_name } = req.body;
    if (!name || !section_id || !target || !username || !password) {
        return res.status(400).json({ message: "البيانات ناقصة." });
    }
    try {
        // 1. إضافة الموظف
        const empResult = await dbRun(`INSERT INTO employees (name, section_id, target, base_salary, hide_income, bank_name) VALUES (?, ?, ?, ?, ?, ?)`, 
            [name, section_id, target, base_salary || 0, hide_income || 0, bank_name || 'كاش']);
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
    const { name, section_id, target, base_salary, username, password, hide_income, bank_name } = req.body;

    try {
        // 1. تحديث بيانات الموظف (الاسم، القسم، الهدف، الراتب الأساسي، إخفاء الدخل)
        await dbRun(`UPDATE employees SET name = ?, section_id = ?, target = ?, base_salary = ?, hide_income = ?, bank_name = ? WHERE id = ?`, 
            [name, section_id, target, base_salary, hide_income || 0, bank_name || 'كاش', id]);

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
                e.base_salary, e.target_amount, e.deposit_amount, e.total_withdrawals, e.remaining_salary, e.net_remaining, e.last_sync_at,
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
            SELECT e.*, s.name AS section_name 
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
                ...info,
                info,
                total_income: -1, // Flag for hidden
                total_withdrawal: totalWithdrawalRow.total_withdrawal,
                last_income_at: entries.length > 0 ? entries[0].created_at : null,
                last_withdrawal_at: withdrawals.length > 0 ? withdrawals[0].created_at : null,
                entries: [], // Hide entries
                withdrawals,
                absences,
                income_hidden: true
            });
        } else {
            res.json({
                ...info,
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
        // Notification for admin
        await dbRun(`INSERT INTO sys_notifications (recipient_type, title, message, type) VALUES ('admin', 'طلب سحب جديد', 'طلب سحب بقيمة ${amount} من الموظف', 'warning')`);

        res.status(201).json({ message: "تم تسجيل الطلب بنجاح وهو بانتظار الموافقة" });
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
        
        const withdrawal = await dbGet('SELECT employee_id FROM withdrawals WHERE id = ?', [id]);
        if(withdrawal) {
            await dbRun(`INSERT INTO sys_notifications (recipient_type, recipient_id, title, message, type) VALUES ('employee', ?, 'رد على طلب سحب', 'تم تغيير حالة طلب السحب الخاص بك: ${status}', 'info')`, [withdrawal.employee_id]);
        }

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
        // Notification for admin
        await dbRun(`INSERT INTO sys_notifications (recipient_type, title, message, type) VALUES ('admin', 'طلب إجازة جديد', 'طلب إجازة جديد من موظف', 'warning')`);

        res.status(201).json({ message: 'تم تقديم طلب الإجازة بنجاح' });
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


// جلب السحوبات الجماعية
app.post('/api/withdrawals/batch', async (req, res) => {
    const { employee_ids, amount, reason, date } = req.body;
    if (!employee_ids || !Array.isArray(employee_ids) || !amount) {
        return res.status(400).json({ message: "بيانات غير مكتملة" });
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
        return res.status(400).json({ message: 'حالة غير صالحة' });
    }

    try {
        await dbRun(`
            UPDATE leave_requests
            SET status = ?, admin_notes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [status, admin_notes || null, id]);

        const request = await dbGet('SELECT employee_id FROM leave_requests WHERE id = ?', [id]);
        if(request) {
            await dbRun(`INSERT INTO sys_notifications (recipient_type, recipient_id, title, message, type) VALUES ('employee', ?, 'رد على طلب إجازة', 'تم تحديث حالة طلب الإجازة: ${status}', 'info')`, [request.employee_id]);
        }

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
        res.status(500).json({ message: 'خطأ' });
    }
});

// ==========================
// 🏗️ إدارة الدوام (Shift Management)
// ==========================

// تحديث أوقات الدوام للفرع (الأسبوعي)
app.get('/api/branch-shifts', async (req, res) => {
    try {
        const shifts = await dbAll(`SELECT * FROM branch_shifts ORDER BY day_of_week`);
        res.json(shifts);
    } catch (error) {
        res.status(500).json({ message: 'خطأ في جلب المواعيد' });
    }
});

app.put('/api/branch-shifts/:day', async (req, res) => {
    const { day } = req.params;
    const { shift_start, shift_end, is_closed } = req.body;
    try {
        await dbRun(`UPDATE branch_shifts SET shift_start = ?, shift_end = ?, is_closed = ? WHERE day_of_week = ?`,
            [shift_start, shift_end, is_closed ? 1 : 0, day]);
        res.json({ message: 'تم تحديث الموعد بنجاح' });
    } catch (error) {
        res.status(500).json({ message: 'خطأ في تحديث الموعد' });
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
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...

    try {
        const existing = await dbGet('SELECT * FROM attendance WHERE employee_id = ? AND date = ?', [employee_id, date]);
        if (existing) return res.status(400).json({ message: 'تم تسجيل الحضور مسبقاً' });

        // جلب وقت الدوام لليوم من مواعيد الفرع
        const shift = await dbGet(`SELECT * FROM branch_shifts WHERE day_of_week = ?`, [dayOfWeek]);
        
        let delayMinutes = 0;
        let sStart = '08:00', sEnd = '18:00';

        if (shift) {
            if (shift.is_closed) return res.status(400).json({ message: 'المحل مغلق اليوم' });
            sStart = shift.shift_start;
            sEnd = shift.shift_end;
            
            const [sh, sm] = sStart.split(':').map(Number);
            const shiftTime = new Date(now);
            shiftTime.setHours(sh, sm, 0, 0);

            if (now > shiftTime) {
                delayMinutes = Math.floor((now - shiftTime) / 60000);
            }
        }

        await dbRun(`INSERT INTO attendance (employee_id, date, check_in, delay_minutes, shift_start, shift_end) VALUES (?, ?, ?, ?, ?, ?)`, 
            [employee_id, date, now.toISOString(), delayMinutes, sStart, sEnd]);
        
        res.json({ message: delayMinutes > 0 ? `تم تسجيل الحضور (تأخير: ${delayMinutes} دقيقة)` : 'تم تسجيل الحضور في الوقت المحدد', delay_minutes: delayMinutes });
    } catch (error) {
        res.status(500).json({ message: "خطأ في تسجيل الحضور" });
    }
});

app.post('/api/attendance/check-out', async (req, res) => {
    const { employee_id } = req.body;
    const now = new Date();
    const date = now.toISOString().split('T')[0];

    try {
        const existing = await dbGet('SELECT * FROM attendance WHERE employee_id = ? AND date = ?', [employee_id, date]);
        if (!existing) return res.status(400).json({ message: 'يجب تسجيل الحضور أولاً' });
        if (existing.check_out) return res.status(400).json({ message: 'تم تسجيل الانصراف مسبقاً' });

        let earlyMinutes = 0;
        let overtimeMinutes = 0;

        if (existing.shift_end) {
            const [eh, em] = existing.shift_end.split(':').map(Number);
            const shiftEndTime = new Date(now);
            shiftEndTime.setHours(eh, em, 0, 0);

            if (now < shiftEndTime) {
                earlyMinutes = Math.floor((shiftEndTime - now) / 60000);
            } else {
                overtimeMinutes = Math.floor((now - shiftEndTime) / 60000);
            }
        }

        await dbRun(`UPDATE attendance SET check_out = ?, early_departure_minutes = ?, overtime_minutes = ? WHERE id = ?`, 
            [now.toISOString(), earlyMinutes, overtimeMinutes, existing.id]);
        
        res.json({ message: 'تم تسجيل الانصراف بنجاح', early_minutes: earlyMinutes, overtime_minutes: overtimeMinutes });
    } catch (error) {
        res.status(500).json({ message: "خطأ في تسجيل الانصراف" });
    }
});

// جلب حالة الحضور لليوم
app.get('/api/attendance/status/:employee_id', async (req, res) => {
    const { employee_id } = req.params;
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const dayOfWeek = now.getDay();

    try {
        const emp = await dbGet(`SELECT * FROM employees WHERE id = ?`, [employee_id]);
        if (!emp) return res.status(404).json({ message: "الموظف غير موجود" });

        const att = await dbGet(`SELECT * FROM attendance WHERE employee_id = ? AND date = ?`, [employee_id, date]);
        const shift = await dbGet(`SELECT * FROM branch_shifts WHERE day_of_week = ?`, [dayOfWeek]);

        res.json({
            status: att && att.check_in ? 'marked' : 'not_marked',
            check_in: att ? att.check_in : null,
            check_out: att ? att.check_out : null,
            delay_minutes: att ? (att.delay_minutes || 0) : 0,
            early_minutes: att ? (att.early_departure_minutes || 0) : 0,
            overtime_minutes: att ? (att.overtime_minutes || 0) : 0,
            shift_start: shift ? shift.shift_start : '08:00',
            shift_end: shift ? shift.shift_end : '18:00'
        });
    } catch (error) {
        console.error("Attendance Status Error:", error);
        res.status(500).json({ message: "خطأ في جلب حالة الحضور" });
    }
});

// consolidated history for employee
app.get('/api/employee/:id/requests', async (req, res) => {
    const { id } = req.params;
    try {
        const withdrawals = await dbAll(`SELECT 'withdrawal' as type, amount, status, date as created_at FROM withdrawals WHERE employee_id = ? ORDER BY date DESC`, [id]);
        const leaves = await dbAll(`SELECT 'leave' as type, leave_type as amount, status, created_at FROM leave_requests WHERE employee_id = ? ORDER BY created_at DESC`, [id]);
        
        // combine and sort
        const all = [...withdrawals, ...leaves].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
        res.json(all);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// ==========================
// 🧩 إعدادات النظام
// ==========================
app.get('/api/settings', async (req, res) => {
    try {
        const settings = await dbAll(`SELECT * FROM settings`);
        const settingsObj = {};
        settings.forEach(s => settingsObj[s.key] = s.value);
        res.json(settingsObj);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching settings' });
    }
});

app.post('/api/settings', async (req, res) => {
    try {
        if (req.body.key && req.body.value !== undefined) {
            await dbRun(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [req.body.key, String(req.body.value)]);
        } else if (typeof req.body === 'object' && req.body !== null) {
            for (const [key, value] of Object.entries(req.body)) {
                if (value !== undefined && value !== null) {
                    await dbRun(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [key, String(value)]);
                }
            }
        }
        res.json({ message: 'Settings updated successfully' });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ message: 'Error updating settings' });
    }
});

// ==========================
// 🧩 تقرير السحبيات (للطباعة)
// ==========================
app.get('/api/reports/withdrawal-list', async (req, res) => {
    try {
        const employees = await dbAll(`
            SELECT 
                e.name, 
                e.bank_name, 
                ((e.base_salary + e.target_amount) - (e.total_withdrawals + e.deposit_amount)) AS remaining_salary, 
                e.net_remaining
            FROM employees e
            WHERE e.is_active = 1
            ORDER BY e.bank_name, e.name
        `);
        
        const settings = await dbAll(`SELECT * FROM settings WHERE key = 'max_withdrawal_limit'`);
        const maxLimit = settings.length > 0 ? settings[0].value : '500';

        res.json({
            employees,
            maxWithdrawalLimit: maxLimit
        });
    } catch (error) {
        console.error("Fetch Withdrawal List Error:", error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

app.get('/api/attendance/report', async (req, res) => {
    const { date, month, employee_id } = req.query;
    try {
        let sql = `
            SELECT 
                e.id AS employee_id, e.name AS employee_name, s.name AS section_name,
                a.check_in, a.check_out, a.status, a.date,
                a.delay_minutes, a.early_departure_minutes, a.overtime_minutes,
                a.shift_start, a.shift_end
            FROM employees e
            LEFT JOIN sections s ON e.section_id = s.id
            LEFT JOIN attendance a ON e.id = a.employee_id
        `;
        let params = [];
        let conditions = ["e.is_active = 1"];

        if (employee_id) {
            conditions.push("e.id = ?");
            params.push(employee_id);
        }

        if (date) {
            conditions.push("a.date = ?");
            params.push(date);
        } else if (month) {
            conditions.push("strftime('%Y-%m', a.date) = ?");
            params.push(month);
        } else {
            // Default to today if no date or month or employee filter is provided for date context
            if (!employee_id) {
                conditions.push("a.date = CURRENT_DATE");
            }
        }

        sql += " WHERE " + conditions.join(" AND ");
        sql += " ORDER BY a.date DESC, s.id, e.name";

        const report = await dbAll(sql, params);
        res.json(report);
    } catch (error) {
        console.error("Attendance Report Error:", error);
        res.status(500).json({ message: "خطأ في جلب تقرير الحضور" });
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

// تحديث حالة القراءة
app.put('/api/messages/mark-read', async (req, res) => {
    const { employee_id, reader } = req.body;
    try {
        // If reader is admin, mark employee messages as read
        // If reader is employee, mark admin messages as read
        const senderToMark = reader === 'admin' ? 'employee' : 'admin';
        await dbRun(`UPDATE messages SET is_read = 1 WHERE employee_id = ? AND sender = ?`, [employee_id, senderToMark]);
        res.json({ success: true });
    } catch (error) {
        console.error("Mark Read Error:", error);
        res.status(500).json({ message: "خطأ في تحديث حالة القراءة" });
    }
});

// عدد الرسائل غير المقروءة للمدير (لكل موظف)
app.get('/api/messages/unread/admin', async (req, res) => {
    try {
        const counts = await dbAll(`
            SELECT employee_id, COUNT(*) as count 
            FROM messages 
            WHERE sender = 'employee' AND is_read = 0 
            GROUP BY employee_id
        `);
        res.json(counts);
    } catch (error) {
        console.error("Unread Admin Error:", error);
        res.status(500).json({ message: "خطأ" });
    }
});

// عدد الرسائل غير المقروءة للموظف
app.get('/api/messages/unread/employee/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await dbGet(`
            SELECT COUNT(*) as count 
            FROM messages 
            WHERE employee_id = ? AND sender = 'admin' AND is_read = 0
        `, [id]);
        res.json(result);
    } catch (error) {
        console.error("Unread Employee Error:", error);
        res.status(500).json({ message: "خطأ" });
    }
});

// ==========================
// 🔔 نظام الإشعارات
// ==========================
// جلب إشعارات وسجل طلبات الموظف
app.get('/api/employee/:id/requests', async (req, res) => {
    const { id } = req.params;
    try {
        const withdrawals = await dbAll(`SELECT 'withdrawal' as type, amount, reason, status, admin_note, created_at FROM withdrawals WHERE employee_id = ? ORDER BY created_at DESC LIMIT 10`, [id]);
        const leaves = await dbAll(`SELECT 'leave' as type, leave_type as amount, reason, status, admin_notes as admin_note, created_at FROM leave_requests WHERE employee_id = ? ORDER BY created_at DESC LIMIT 10`, [id]);
        
        let all = [...withdrawals, ...leaves].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        res.json(all);
    } catch (error) {
        console.error("Fetch Employee Requests Error:", error);
        res.status(500).json([]);
    }
});

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

// Notifications Sys API
app.get('/api/sys_notifications', async (req, res) => {
    const { recipient_type, recipient_id } = req.query;
    try {
        let sql = `SELECT * FROM sys_notifications WHERE recipient_type = ?`;
        let params = [recipient_type];
        
        if (recipient_type === 'employee' && recipient_id) {
            sql += ` AND recipient_id = ?`;
            params.push(recipient_id);
        }
        
        sql += ` ORDER BY created_at DESC LIMIT 50`;
        const notifications = await dbAll(sql, params);
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
});

app.put('/api/sys_notifications/:id/read', async (req, res) => {
    const { id } = req.params;
    try {
        await dbRun(`UPDATE sys_notifications SET is_read = 1 WHERE id = ?`, [id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
});

app.put('/api/sys_notifications/read_all', async (req, res) => {
    const { recipient_type, recipient_id } = req.body;
    try {
        if(recipient_type === 'employee') {
            await dbRun(`UPDATE sys_notifications SET is_read = 1 WHERE recipient_type = 'employee' AND recipient_id = ?`, [recipient_id]);
        } else {
            await dbRun(`UPDATE sys_notifications SET is_read = 1 WHERE recipient_type = 'admin'`);
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
});

// ==========================
// 🔍 نظام الكشف (Inspections)
// ==========================

// إضافة كشف أو أمر عمل جديد
app.post('/api/inspections', async (req, res) => {
    const {
        inspector_id, customer_name, customer_phone, car_type, car_color, car_model,
        plate_number, odometer, vin, items, total_amount, vat_amount, final_amount,
        paid_amount, remaining_amount, status, car_status, job_order_notes,
        car_defects_diagram, technician_ids
    } = req.body;

    try {
        await dbRun('BEGIN TRANSACTION');

        const effectiveInspectorId = inspector_id || (req.body.inspector ? req.body.inspector.id : 1);

        const inspResult = await dbRun(`
            INSERT INTO inspections (
                inspector_id, customer_name, customer_phone, car_type, car_color, car_model,
                plate_number, odometer, vin, total_amount, vat_amount, final_amount,
                paid_amount, remaining_amount, status, car_status, job_order_notes, car_defects_diagram
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            effectiveInspectorId,
            customer_name || '',
            customer_phone || '',
            car_type || '',
            car_color || '',
            car_model || '',
            plate_number || '',
            odometer || '',
            vin || '',
            total_amount || 0,
            vat_amount || 0,
            final_amount || 0,
            paid_amount || 0,
            remaining_amount || 0,
            status || 'new',
            car_status || (status === 'job_order' ? 'in_progress' : 'pending'),
            job_order_notes || '',
            car_defects_diagram || ''
        ]);

        const inspection_id = inspResult.lastID;

        if (items && Array.isArray(items)) {
            for (const item of items) {
                if (item.service_description) {
                    await dbRun(`
                        INSERT INTO inspection_items (inspection_id, category, service_description, quantity, price, total)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `, [inspection_id, item.category || 'عام', item.service_description, item.quantity || 1, item.price || 0, item.total || 0]);

                    await dbRun(`INSERT OR IGNORE INTO inspection_terms (term) VALUES (?)`, [item.service_description]);
                }
            }
        }

        if (technician_ids && Array.isArray(technician_ids)) {
            for (const tId of technician_ids) {
                if (tId) {
                    await dbRun(`INSERT INTO inspection_technicians (inspection_id, technician_id) VALUES (?, ?)`, [inspection_id, tId]);
                }
            }
        }

        await dbRun('COMMIT');
        res.status(201).json({ message: "تم الحفظ بنجاح", id: inspection_id, status: status || 'new' });
    } catch (error) {
        try { await dbRun('ROLLBACK'); } catch (e) { }
        console.error("Add Inspection Error:", error);
        res.status(500).json({ message: "خطأ في حفظ البيانات: " + error.message });
    }
});

// تحديث كشف أو أمر عمل موجود
app.put('/api/inspections/:id', async (req, res) => {
    const { id } = req.params;
    const {
        customer_name, customer_phone, car_type, car_color, car_model,
        plate_number, odometer, vin, items, total_amount, vat_amount, final_amount,
        paid_amount, remaining_amount, status, car_status, job_order_notes,
        car_defects_diagram, technician_ids
    } = req.body;

    try {
        await dbRun('BEGIN TRANSACTION');

        await dbRun(`
            UPDATE inspections 
            SET customer_name = ?, customer_phone = ?, car_type = ?, car_color = ?, car_model = ?, 
                plate_number = ?, odometer = ?, vin = ?, total_amount = ?, vat_amount = ?, final_amount = ?, 
                paid_amount = ?, remaining_amount = ?,
                status = COALESCE(?, status),
                car_status = COALESCE(?, car_status),
                job_order_notes = COALESCE(?, job_order_notes),
                car_defects_diagram = COALESCE(?, car_defects_diagram)
            WHERE id = ?
        `, [
            customer_name || '',
            customer_phone || '',
            car_type || '',
            car_color || '',
            car_model || '',
            plate_number || '',
            odometer || '',
            vin || '',
            total_amount || 0,
            vat_amount || 0,
            final_amount || 0,
            paid_amount || 0,
            remaining_amount || 0,
            status || null,
            car_status || null,
            job_order_notes !== undefined ? job_order_notes : null,
            car_defects_diagram !== undefined ? car_defects_diagram : null,
            id
        ]);

        if (items && Array.isArray(items)) {
            await dbRun(`DELETE FROM inspection_items WHERE inspection_id = ?`, [id]);
            for (const item of items) {
                if (item.service_description) {
                    await dbRun(`
                        INSERT INTO inspection_items (inspection_id, category, service_description, quantity, price, total)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `, [id, item.category || 'عام', item.service_description, item.quantity || 1, item.price || 0, item.total || 0]);

                    await dbRun(`INSERT OR IGNORE INTO inspection_terms (term) VALUES (?)`, [item.service_description]);
                }
            }
        }

        if (technician_ids && Array.isArray(technician_ids)) {
            await dbRun(`DELETE FROM inspection_technicians WHERE inspection_id = ?`, [id]);
            for (const tId of technician_ids) {
                if (tId) {
                    await dbRun(`INSERT INTO inspection_technicians (inspection_id, technician_id) VALUES (?, ?)`, [id, tId]);
                    // إرسال إشعار فوري للفني
                    try {
                        const carLabel = `${car_type || ''} ${car_model || ''} (${plate_number || ''})`.trim();
                        await dbRun(`
                            INSERT INTO sys_notifications (recipient_type, recipient_id, title, message, type)
                            VALUES ('employee', ?, 'تم إسناد أمر عمل لك 🛠️', ?, 'info')
                        `, [tId, `تم تعيينك للعمل على سيارة: ${carLabel || 'أمر عمل #' + id}`]);
                    } catch (ne) { console.error("Notification Error:", ne); }
                }
            }
        }

        await dbRun('COMMIT');
        res.json({ message: "تم التحديث بنجاح", id: id });
    } catch (error) {
        try { await dbRun('ROLLBACK'); } catch (e) { }
        console.error("Update Inspection Error:", error);
        res.status(500).json({ message: "خطأ في التحديث: " + error.message });
    }
});

// تحويل تسعيرة إلى أمر عمل أو تغيير الحالة
app.patch('/api/inspections/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status, car_status, job_order_notes } = req.body;
    try {
        await dbRun(`
            UPDATE inspections
            SET status = COALESCE(?, status),
                car_status = COALESCE(?, car_status),
                job_order_notes = COALESCE(?, job_order_notes)
            WHERE id = ?
        `, [status || null, car_status || null, job_order_notes !== undefined ? job_order_notes : null, id]);

        // إشعار للإدارة عند جاهزية السيارة للتسليم
        if (car_status === 'ready') {
            try {
                const insp = await dbGet(`SELECT car_type, car_model, plate_number, customer_name FROM inspections WHERE id = ?`, [id]);
                const carLabel = insp ? `${insp.car_type || ''} ${insp.car_model || ''} (${insp.plate_number || ''})`.trim() : `#${id}`;
                await dbRun(`
                    INSERT INTO sys_notifications (recipient_type, title, message, type)
                    VALUES ('admin', 'سيارة جاهزة للتسليم ✅', ?, 'success')
                `, [`السيارة: ${carLabel} أصبحت جاهزة للتسليم للعميل ${insp ? insp.customer_name || '' : ''}`]);
            } catch (ne) { console.error("Notification Error:", ne); }
        }

        res.json({ message: "تم تحديث حالة المستند بنجاح", id, status, car_status });
    } catch (error) {
        console.error("Update Inspection Status Error:", error);
        res.status(500).json({ message: "خطأ في تحديث الحالة" });
    }
});

// تحويل تسعيرة مباشرة إلى أمر عمل
app.post('/api/inspections/:id/convert-to-job', async (req, res) => {
    const { id } = req.params;
    try {
        await dbRun(`
            UPDATE inspections
            SET status = 'job_order',
                car_status = CASE WHEN car_status IS NULL OR car_status = '' THEN 'in_progress' ELSE car_status END
            WHERE id = ?
        `, [id]);

        try {
            const insp = await dbGet(`SELECT car_type, plate_number, customer_name FROM inspections WHERE id = ?`, [id]);
            await dbRun(`
                INSERT INTO sys_notifications (recipient_type, title, message, type)
                VALUES ('admin', 'تحويل تسعيرة لأمر عمل 🚗', ?, 'info')
            `, [`تم تحويل تسعيرة السيارة (${insp ? insp.plate_number || '' : ''}) إلى أمر عمل رقم #${id}`]);
        } catch (ne) { }

        res.json({ message: "تم تحويل التسعيرة إلى أمر عمل بنجاح", id, status: 'job_order' });
    } catch (error) {
        console.error("Convert Inspection Error:", error);
        res.status(500).json({ message: "خطأ في تحويل التسعيرة" });
    }
});

// ==========================
// 📷 مسارات رفع ومعاينة صور الكشوفات وأوامر العمل
// ==========================
app.post('/api/inspections/:id/photos', uploadPhoto.array('photos', 10), async (req, res) => {
    const { id } = req.params;
    const photo_type = req.body.photo_type || 'before'; // 'before', 'damaged_part', 'after'
    const caption = req.body.caption || '';

    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: "لم يتم اختيار أي صور" });
        }

        const insertedPhotos = [];
        for (const file of req.files) {
            const filePath = '/uploads/inspection_photos/' + file.filename;
            const result = await dbRun(`
                INSERT INTO inspection_photos (inspection_id, photo_type, file_path, caption)
                VALUES (?, ?, ?, ?)
            `, [id, photo_type, filePath, caption]);

            insertedPhotos.push({
                id: result.lastID,
                inspection_id: Number(id),
                photo_type,
                file_path: filePath,
                caption,
                created_at: new Date().toISOString()
            });
        }

        res.json({ message: "تم رفع الصور بنجاح", photos: insertedPhotos });
    } catch (error) {
        console.error("Upload Photos Error:", error);
        res.status(500).json({ message: "خطأ في رفع الصور: " + error.message });
    }
});

// جلب صور الكشف
app.get('/api/inspections/:id/photos', async (req, res) => {
    const { id } = req.params;
    try {
        const photos = await dbAll(`
            SELECT * FROM inspection_photos
            WHERE inspection_id = ?
            ORDER BY id DESC
        `, [id]);
        res.json(photos);
    } catch (error) {
        console.error("Get Photos Error:", error);
        res.status(500).json({ message: "خطأ في جلب الصور" });
    }
});

// حذف صورة
app.delete('/api/inspections/photos/:photo_id', async (req, res) => {
    const { photo_id } = req.params;
    try {
        const photo = await dbGet(`SELECT * FROM inspection_photos WHERE id = ?`, [photo_id]);
        if (photo) {
            const fullPath = path.join(__dirname, photo.file_path);
            if (fs.existsSync(fullPath)) {
                try { fs.unlinkSync(fullPath); } catch (e) { console.warn("Failed to delete file:", e); }
            }
            await dbRun(`DELETE FROM inspection_photos WHERE id = ?`, [photo_id]);
        }
        res.json({ message: "تم حذف الصورة بنجاح" });
    } catch (error) {
        console.error("Delete Photo Error:", error);
        res.status(500).json({ message: "خطأ في حذف الصورة" });
    }
});

// ==========================
// 📱 مسار تتبع العميل المباشر (Public Customer Tracking)
// ==========================
app.get('/api/track/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const inspection = await dbGet(`
            SELECT id, customer_name, customer_phone, car_type, car_color, car_model, 
                   plate_number, odometer, status, car_status, total_amount, vat_amount, 
                   final_amount, paid_amount, remaining_amount, created_at
            FROM inspections
            WHERE id = ?
        `, [id]);

        if (!inspection) {
            return res.status(404).json({ message: "لم يتم العثور على سجل أمر العمل أو التسعيرة" });
        }

        const items = await dbAll(`
            SELECT id, category, service_description, quantity, price, total, is_completed, completed_at, completed_by
            FROM inspection_items
            WHERE inspection_id = ?
        `, [id]);

        const photos = await dbAll(`
            SELECT id, photo_type, file_path, caption, created_at
            FROM inspection_photos
            WHERE inspection_id = ?
            ORDER BY id ASC
        `, [id]);

        res.json({
            inspection,
            items,
            photos
        });
    } catch (error) {
        console.error("Track Error:", error);
        res.status(500).json({ message: "خطأ في جلب بيانات المتابعة" });
    }
});

// ==========================
// ☑️ مسار تأشير إنجاز الخدمة في قائمة الفحص (Interactive Service Checklist Toggle)
// ==========================
app.patch('/api/inspections/items/:item_id/toggle', async (req, res) => {
    const { item_id } = req.params;
    const { is_completed, completed_by } = req.body;
    const compVal = is_completed ? 1 : 0;
    const compAt = compVal ? new Date().toISOString() : null;
    const compBy = compVal ? (completed_by || 'فني') : null;

    try {
        const item = await dbGet(`SELECT * FROM inspection_items WHERE id = ?`, [item_id]);
        if (!item) return res.status(404).json({ message: "البند غير موجود" });

        await dbRun(`
            UPDATE inspection_items
            SET is_completed = ?, completed_at = ?, completed_by = ?
            WHERE id = ?
        `, [compVal, compAt, compBy, item_id]);

        const stats = await dbGet(`
            SELECT 
                COUNT(*) as total_items,
                COUNT(CASE WHEN is_completed = 1 THEN 1 END) as completed_items
            FROM inspection_items
            WHERE inspection_id = ?
        `, [item.inspection_id]);

        const total = stats ? stats.total_items || 0 : 0;
        const completed = stats ? stats.completed_items || 0 : 0;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
        const isAllDone = total > 0 && completed === total;

        // إذا اكتملت جميع الخدمات 100%، إرسال إشعار فوري للإدارة
        if (isAllDone) {
            try {
                const insp = await dbGet(`SELECT car_type, plate_number FROM inspections WHERE id = ?`, [item.inspection_id]);
                await dbRun(`
                    INSERT INTO sys_notifications (recipient_type, title, message, type)
                    VALUES ('admin', 'اكتمال بنود الصيانة 🏁', ?, 'success')
                `, [`تم إنجاز كافة خدمات السيارة (${insp ? insp.plate_number || '' : ''}) بأمر عمل #${item.inspection_id}`]);
            } catch (ne) { }
        }

        res.json({
            message: "تم تحديث حالة الخدمة بنجاح",
            item_id: Number(item_id),
            is_completed: compVal,
            completed_at: compAt,
            completed_by: compBy,
            completed_items: completed,
            total_items: total,
            percent,
            isAllDone
        });
    } catch (error) {
        console.error("Toggle Item Error:", error);
        res.status(500).json({ message: "خطأ في تحديث حالة البند" });
    }
});

// حذف كشف أو أمر عمل
app.delete('/api/inspections/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await dbRun('BEGIN TRANSACTION');
        await dbRun(`DELETE FROM inspection_items WHERE inspection_id = ?`, [id]);
        await dbRun(`DELETE FROM inspection_technicians WHERE inspection_id = ?`, [id]);
        await dbRun(`DELETE FROM inspection_photos WHERE inspection_id = ?`, [id]);
        await dbRun(`DELETE FROM inspections WHERE id = ?`, [id]);
        await dbRun('COMMIT');
        res.json({ message: "تم حذف الكشف بنجاح" });
    } catch (error) {
        try { await dbRun('ROLLBACK'); } catch (e) { }
        console.error("Delete Inspection Error:", error);
        res.status(500).json({ message: "خطأ في الحذف" });
    }
});

// جلب قائمة الكشوفات وأوامر العمل مع الفلاتر المتقدمة
app.get('/api/inspections', async (req, res) => {
    const { status, car_status, from, to, inspector_id, technician_id, search, query, limit } = req.query;
    try {
        let whereClauses = [];
        let params = [];

        // فلترة نوع المستند (تسعيرة / أمر عمل)
        if (status && status !== 'all') {
            if (status === 'job_order') {
                whereClauses.push(`i.status = 'job_order'`);
            } else if (status === 'new' || status === 'quotation' || status === 'inspection') {
                whereClauses.push(`(i.status = 'new' OR i.status = 'quotation' OR i.status IS NULL OR i.status = '')`);
            } else {
                whereClauses.push(`i.status = ?`);
                params.push(status);
            }
        }

        // فلترة حالة السيارة في الورشة
        if (car_status && car_status !== 'all') {
            if (car_status === 'active_in_shop') {
                whereClauses.push(`i.status = 'job_order' AND (i.car_status != 'completed' OR i.car_status IS NULL)`);
            } else {
                whereClauses.push(`i.car_status = ?`);
                params.push(car_status);
            }
        }

        // فلترة التاريخ
        if (from) {
            whereClauses.push(`date(i.created_at) >= date(?)`);
            params.push(from);
        }
        if (to) {
            whereClauses.push(`date(i.created_at) <= date(?)`);
            params.push(to);
        }

        // فلترة الكشيف
        if (inspector_id) {
            whereClauses.push(`i.inspector_id = ?`);
            params.push(inspector_id);
        }

        // فلترة الفني المعين
        if (technician_id) {
            whereClauses.push(`i.id IN (SELECT inspection_id FROM inspection_technicians WHERE technician_id = ?)`);
            params.push(technician_id);
        }

        // البحث النصي
        const searchTerm = search || query;
        if (searchTerm && searchTerm.trim() !== '') {
            const term = `%${searchTerm.trim()}%`;
            whereClauses.push(`(
                CAST(i.id AS TEXT) LIKE ? OR
                i.customer_name LIKE ? OR
                i.customer_phone LIKE ? OR
                i.plate_number LIKE ? OR
                i.car_type LIKE ? OR
                i.car_model LIKE ? OR
                i.vin LIKE ?
            )`);
            params.push(term, term, term, term, term, term, term);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const limitCount = parseInt(limit) || 300;

        const sql = `
            SELECT 
                i.*,
                e.name as inspector_name,
                (SELECT COUNT(*) FROM inspection_items WHERE inspection_id = i.id) as items_count,
                (SELECT COUNT(CASE WHEN is_completed = 1 THEN 1 END) FROM inspection_items WHERE inspection_id = i.id) as completed_items_count,
                (
                    SELECT GROUP_CONCAT(t_emp.name, ', ')
                    FROM inspection_technicians it
                    JOIN employees t_emp ON it.technician_id = t_emp.id
                    WHERE it.inspection_id = i.id
                ) as technicians_names
            FROM inspections i
            LEFT JOIN employees e ON i.inspector_id = e.id
            ${whereSql}
            ORDER BY i.created_at DESC
            LIMIT ?
        `;
        params.push(limitCount);

        const rows = await dbAll(sql, params);
        res.json(rows);
    } catch (error) {
        console.error("Fetch Inspections List Error:", error);
        res.status(500).json({ message: "خطأ في جلب البيانات: " + error.message });
    }
});

// إحصائيات وملخص أوامر العمل والسيارات الموجودة في المركز
app.get('/api/job-orders/summary', async (req, res) => {
    try {
        const stats = await dbGet(`
            SELECT 
                COUNT(CASE WHEN status = 'job_order' AND (car_status != 'completed' OR car_status IS NULL) THEN 1 END) as total_in_shop,
                COUNT(CASE WHEN status = 'job_order' AND car_status = 'pending' THEN 1 END) as pending_count,
                COUNT(CASE WHEN status = 'job_order' AND (car_status = 'in_progress' OR car_status IS NULL OR car_status = '') THEN 1 END) as in_progress_count,
                COUNT(CASE WHEN status = 'job_order' AND car_status = 'waiting_parts' THEN 1 END) as waiting_parts_count,
                COUNT(CASE WHEN status = 'job_order' AND car_status = 'ready' THEN 1 END) as ready_count,
                COUNT(CASE WHEN status = 'job_order' AND car_status = 'completed' THEN 1 END) as completed_count,
                COUNT(CASE WHEN status = 'new' OR status = 'quotation' OR status IS NULL OR status = '' THEN 1 END) as total_quotations,
                COUNT(CASE WHEN status = 'job_order' THEN 1 END) as total_job_orders
            FROM inspections
        `);
        res.json(stats);
    } catch (error) {
        console.error("Job Orders Summary Error:", error);
        res.status(500).json({ message: "خطأ في جلب ملخص أوامر العمل" });
    }
});

// جلب تفاصيل كشف أو أمر عمل محدد بالكامل
app.get('/api/inspections/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const inspection = await dbGet(`
            SELECT i.*, e.name as inspector_name
            FROM inspections i
            LEFT JOIN employees e ON i.inspector_id = e.id
            WHERE i.id = ?
        `, [id]);

        if (!inspection) return res.status(404).json({ message: "الكشف أو أمر العمل غير موجود" });

        const items = await dbAll(`SELECT * FROM inspection_items WHERE inspection_id = ?`, [id]);
        const technicians = await dbAll(`
            SELECT it.technician_id as id, emp.name, s.name as section_name
            FROM inspection_technicians it
            JOIN employees emp ON it.technician_id = emp.id
            LEFT JOIN sections s ON emp.section_id = s.id
            WHERE it.inspection_id = ?
        `, [id]);

        const photos = await dbAll(`
            SELECT * FROM inspection_photos
            WHERE inspection_id = ?
            ORDER BY id ASC
        `, [id]);

        res.json({ ...inspection, items, technicians, photos });
    } catch (error) {
        console.error("Fetch Inspection Details Error:", error);
        res.status(500).json({ message: "خطأ في جلب التفاصيل" });
    }
});

// جلب قائمة الفنيين للتعيين
app.get('/api/technicians', async (req, res) => {
    try {
        const technicians = await dbAll(`
            SELECT e.id, e.name, s.name as section_name
            FROM employees e
            LEFT JOIN sections s ON e.section_id = s.id
            WHERE e.is_active = 1
            ORDER BY s.name, e.name
        `);
        res.json(technicians);
    } catch (error) {
        console.error("Fetch Technicians Error:", error);
        res.status(500).json({ message: "خطأ في جلب قائمة الفنيين" });
    }
});

// جلب إحصائيات الكشوفات للمدير
app.get('/api/admin/inspection-stats', async (req, res) => {
    try {
        const stats = await dbAll(`
            SELECT 
                e.name as inspector_name,
                COUNT(i.id) as total_inspections,
                SUM(i.final_amount) as total_value
            FROM employees e
            LEFT JOIN inspections i ON e.id = i.inspector_id
            WHERE e.section_id = (SELECT id FROM sections WHERE name = 'كشف')
            GROUP BY e.id
        `);
        res.json(stats);
    } catch (error) {
        console.error("Admin Inspection Stats Error:", error);
        res.status(500).json({ message: "خطأ في جلب إحصائيات الكشوفات" });
    }
});

// ==========================
// 🛠️ إدارة الخدمات (Pricing & Services)
// ==========================

// جلب جميع الخدمات
app.get('/api/services', async (req, res) => {
    try {
        const services = await dbAll(`SELECT * FROM services ORDER BY category, service_name`);
        res.json(services);
    } catch (error) {
        console.error("Fetch Services Error:", error);
        res.status(500).json({ message: "خطأ في جلب الخدمات" });
    }
});

// إضافة خدمة جديدة
app.post('/api/services', async (req, res) => {
    const { category, service_name, price } = req.body;
    if (!category || !service_name) {
        return res.status(400).json({ message: "الفئة واسم الخدمة مطلوبان" });
    }
    try {
        const result = await dbRun(`INSERT INTO services (category, service_name, price) VALUES (?, ?, ?)`, [category, service_name, price || 0]);
        res.status(201).json({ message: "تمت إضافة الخدمة بنجاح", id: result.lastID });
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT') {
            return res.status(409).json({ message: "هذه الخدمة موجودة بالفعل في هذه الفئة" });
        }
        console.error("Add Service Error:", error);
        res.status(500).json({ message: "خطأ في إضافة الخدمة" });
    }
});

// تحديث خدمة
app.put('/api/services/:id', async (req, res) => {
    const { id } = req.params;
    const { category, service_name, price } = req.body;
    try {
        await dbRun(`UPDATE services SET category = ?, service_name = ?, price = ? WHERE id = ?`, [category, service_name, price, id]);
        res.json({ message: "تم تحديث الخدمة بنجاح" });
    } catch (error) {
        console.error("Update Service Error:", error);
        res.status(500).json({ message: "خطأ في تحديث الخدمة" });
    }
});

// حذف خدمة
app.delete('/api/services/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await dbRun(`DELETE FROM services WHERE id = ?`, [id]);
        res.json({ message: "تم حذف الخدمة بنجاح" });
    } catch (error) {
        console.error("Delete Service Error:", error);
        res.status(500).json({ message: "خطأ في حذف الخدمة" });
    }
});

// ==========================
// 🚀 باقات واختصارات الكشف (Inspection Bundles / Shortcuts)
// ==========================

// جلب جميع باقات الكشف مع بنودها
app.get('/api/inspection-bundles', async (req, res) => {
    try {
        const bundles = await dbAll(`SELECT * FROM inspection_bundles ORDER BY id ASC`);
        const result = [];
        for (const b of bundles) {
            const items = await dbAll(`SELECT * FROM inspection_bundle_items WHERE bundle_id = ? ORDER BY id ASC`, [b.id]);
            result.push({
                id: b.id,
                name: b.name,
                icon: b.icon || '🚀',
                items: items || []
            });
        }
        res.json(result);
    } catch (error) {
        console.error("Fetch Inspection Bundles Error:", error);
        res.status(500).json({ message: "خطأ في جلب باقات واختصارات الكشف" });
    }
});

// إضافة باقة كشف جديدة
app.post('/api/inspection-bundles', async (req, res) => {
    const { name, icon, items } = req.body;
    if (!name) {
        return res.status(400).json({ message: "اسم الباقة مطلوب" });
    }

    try {
        await dbRun('BEGIN TRANSACTION');
        const result = await dbRun(`INSERT INTO inspection_bundles (name, icon) VALUES (?, ?)`, [name, icon || '🚀']);
        const bundleId = result.lastID;

        if (items && Array.isArray(items)) {
            for (const item of items) {
                const desc = item.service_description || item.service;
                if (desc) {
                    await dbRun(
                        `INSERT INTO inspection_bundle_items (bundle_id, service_description, category) VALUES (?, ?, ?)`,
                        [bundleId, desc, item.category || 'كشف']
                    );
                }
            }
        }

        await dbRun('COMMIT');
        res.status(201).json({ message: "تمت إضافة الباقة بنجاح", id: bundleId });
    } catch (error) {
        try { await dbRun('ROLLBACK'); } catch (e) { }
        console.error("Add Bundle Error:", error);
        res.status(500).json({ message: "خطأ في إضافة الباقة: " + error.message });
    }
});

// تحديث باقة كشف موجودة
app.put('/api/inspection-bundles/:id', async (req, res) => {
    const { id } = req.params;
    const { name, icon, items } = req.body;

    try {
        await dbRun('BEGIN TRANSACTION');
        await dbRun(`UPDATE inspection_bundles SET name = ?, icon = ? WHERE id = ?`, [name, icon || '🚀', id]);
        await dbRun(`DELETE FROM inspection_bundle_items WHERE bundle_id = ?`, [id]);

        if (items && Array.isArray(items)) {
            for (const item of items) {
                const desc = item.service_description || item.service;
                if (desc) {
                    await dbRun(
                        `INSERT INTO inspection_bundle_items (bundle_id, service_description, category) VALUES (?, ?, ?)`,
                        [id, desc, item.category || 'كشف']
                    );
                }
            }
        }

        await dbRun('COMMIT');
        res.json({ message: "تم تحديث الباقة بنجاح" });
    } catch (error) {
        try { await dbRun('ROLLBACK'); } catch (e) { }
        console.error("Update Bundle Error:", error);
        res.status(500).json({ message: "خطأ في تحديث الباقة: " + error.message });
    }
});

// حذف باقة كشف
app.delete('/api/inspection-bundles/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await dbRun('BEGIN TRANSACTION');
        await dbRun(`DELETE FROM inspection_bundle_items WHERE bundle_id = ?`, [id]);
        await dbRun(`DELETE FROM inspection_bundles WHERE id = ?`, [id]);
        await dbRun('COMMIT');
        res.json({ message: "تم حذف الباقة بنجاح" });
    } catch (error) {
        try { await dbRun('ROLLBACK'); } catch (e) { }
        console.error("Delete Bundle Error:", error);
        res.status(500).json({ message: "خطأ في حذف الباقة" });
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

// ==========================
// 📊 استيراد الرواتب من Excel
// ==========================
app.post('/api/employees/import-salaries', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "الرجاء اختيار ملف Excel." });
    const filePath = req.file.path;
    const ExcelJS = require('exceljs');
    try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        const worksheet = workbook.worksheets[0];
        
        const allEmployees = await dbAll("SELECT id, name FROM employees WHERE is_active = 1");
        const clean = (s) => String(s || '').toLowerCase()
            .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
            .replace(/[^a-z0-9\u0600-\u06FF]/g, '');
        const dbNamesClean = allEmployees.map(e => ({ id: e.id, name: e.name, cleanName: clean(e.name) }));

        let ind = { n: -1, b: -1, t: -1, d: -1, w: -1, r: -1, nr: -1 };
        worksheet.eachRow((row, rowNumber) => {
            let rowText = String(row.getCell(1).value || '').trim();
            // Also check first few cells if column 1 is empty or has a number
            for(let i=2; i<=3; i++) {
                if(!rowText) rowText = String(row.getCell(i).value || '').trim();
            }

            const has = (txt) => rowText.includes(txt);

            if (has('إجمالي السحوبات') || has('اجمالي السحوبات') || (has('سحوبات') && (has('إجمالي') || has('اجمالي'))) || (rowText === 'السحوبات')) ind.w = rowNumber - 1;
            if (has('الراتب المتبقي') || has('اجمالي المتبقي')) ind.r = rowNumber - 1;
            if (has('الراتب الأساسي') || has('الراتب الاساسي') || has('الراتب الاستحقاق')) ind.b = rowNumber - 1;
            if (has('ايداع مؤسسة') || has('إيداع مؤسسة') || has('إيداع المؤسسة') || has('ايداع كاش')) ind.d = rowNumber - 1;
            if (has('المتبقي الصافي') || has('الصافي') || has('صافي المتبقي')) ind.nr = rowNumber - 1;
            if (has('مكافأة التارقت') || has('بونص التارقت') || (has('التارقت') && rowNumber > 25)) ind.t = rowNumber - 1;

            if (ind.n === -1 && rowNumber < 15) {
                let m = 0;
                row.eachCell(c => { if(clean(c.value) && dbNamesClean.some(db => db.cleanName === clean(c.value))) m++; });
                if (m >= 3) ind.n = rowNumber - 1;
            }
        });

        const getV = (rIdx, cIdx) => {
            if (rIdx === -1) return 0;
            const cell = worksheet.getRow(rIdx + 1).getCell(cIdx + 1);
            let val = 0;
            if (cell.value && typeof cell.value === 'object') val = cell.value.result !== undefined ? cell.value.result : (cell.value.value || 0);
            else val = cell.value;
            return isNaN(parseFloat(val)) ? 0 : parseFloat(val);
        };

        let updated = 0;
        let notFound = [];
        const namesRowIdx = ind.n + 1;
        const namesRow = worksheet.getRow(namesRowIdx);
        
        for (let i = 1; i <= 250; i++) { 
            const cell = namesRow.getCell(i);
            const rawVal = cell.value;
            if (!rawVal) continue;
            
            const cEx = clean(rawVal);
            if (!cEx || cEx.includes('تاريخ')) continue;
            
            const m = dbNamesClean.find(db => 
                db.cleanName === cEx || 
                (cEx.length > 3 && db.cleanName.includes(cEx)) || 
                (db.cleanName.length > 3 && cEx.includes(db.cleanName))
            );

            if (m) {
                await dbRun(`UPDATE employees SET base_salary=?, target_amount=?, deposit_amount=?, total_withdrawals=?, remaining_salary=?, net_remaining=?, last_sync_at=CURRENT_TIMESTAMP WHERE id=?`, 
                    [getV(ind.b, i-1), getV(ind.t, i-1), getV(ind.d, i-1), getV(ind.w, i-1), getV(ind.r, i-1), getV(ind.nr, i-1), m.id]);
                updated++;
            } else {
                if (cEx.length > 1) notFound.push(String(rawVal));
            }
        }
        
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.json({ 
            message: `تمت مزامنة ${updated} موظف بنجاح.`, 
            notFound: [...new Set(notFound)],
            debug: { namesRow: namesRowIdx, headers: ind }
        });
    } catch (error) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.status(500).json({ message: "خطأ: " + error.message });
    }
});
