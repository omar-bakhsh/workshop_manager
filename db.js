const path = require('path');
const fs = require('fs');

// Environment variables provided by AiroApp or .env
const DB_HOST = process.env.DB_HOST;
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_NAME = process.env.DB_NAME;
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD || '';

const isMySQL = Boolean(DB_HOST && DB_NAME && DB_USER);

let pool = null;
let sqliteDb = null;

// ==========================
// 🔌 إعداد اتصال قاعدة البيانات
// ==========================
if (isMySQL) {
    console.log(`🌐 [Database] جاري تهيئة تجمع اتصالات MySQL المدارة (Host: ${DB_HOST}, Port: ${DB_PORT}, DB: ${DB_NAME}, User: ${DB_USER})...`);
    const mysql = require('mysql2/promise');
    pool = mysql.createPool({
        host: DB_HOST,
        port: DB_PORT,
        database: DB_NAME,
        user: DB_USER,
        password: DB_PASSWORD,
        waitForConnections: true,
        connectionLimit: 15,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
        charset: 'utf8mb4'
    });
} else {
    console.log('⚠️ [Database] لم يتم توفير متغيرات اتصال MySQL (DB_HOST, DB_NAME, DB_USER). يتم استخدام SQLite المحلي.');
    const sqlite3 = require('sqlite3').verbose();
    const dbPath = path.join(__dirname, 'db.sqlite');
    const defaultSeedPath = path.join(__dirname, 'default_seed.sqlite');

    if (!fs.existsSync(dbPath) && fs.existsSync(defaultSeedPath)) {
        try {
            fs.copyFileSync(defaultSeedPath, dbPath);
            console.log('🔄 تم استنساخ default_seed.sqlite إلى db.sqlite محلياً.');
        } catch (e) {
            console.warn('⚠️ تعذر نسخ default_seed.sqlite:', e.message);
        }
    }

    sqliteDb = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('❌ خطأ في فتح SQLite:', err.message);
        } else {
            console.log('✅ تم فتح قاعدة بيانات SQLite المحلية بنجاح.');
        }
    });
}

// ==========================
// 🔄 مواءمة استعلامات SQL بين المحركات
// ==========================
function normalizeQuery(sql) {
    let normalized = sql;

    if (isMySQL) {
        // تحويل أوامر SQLite إلى صيغ MySQL المتوافقة
        normalized = normalized.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, 'INSERT IGNORE INTO');
        normalized = normalized.replace(/INSERT\s+OR\s+REPLACE\s+INTO/gi, 'REPLACE INTO');

        // تأمين الكلمة المحجوزة key في جدول settings
        normalized = normalized.replace(/\bsettings\s*\(\s*key\s*,\s*value\s*\)/gi, 'settings (`key`, `value`)');
        normalized = normalized.replace(/\bWHERE\s+key\s*=/gi, 'WHERE `key` =');
        normalized = normalized.replace(/\bSET\s+key\s*=/gi, 'SET `key` =');

        // استبدال دوال التواريخ الخاصة بـ SQLite
        normalized = normalized.replace(/strftime\s*\(\s*'%Y-%m'\s*,\s*([a-zA-Z0-9_.]+)\s*\)/gi, "DATE_FORMAT($1, '%Y-%m')");

        // تحويل أوامر بدء المعاملات إلى صيغة MySQL
        normalized = normalized.replace(/\bBEGIN\s+TRANSACTION\b/gi, 'START TRANSACTION');
    } else {
        // تحويل أوامر MySQL إلى صيغ SQLite المتوافقة في البيئة المحلية
        normalized = normalized.replace(/INSERT\s+IGNORE\s+INTO/gi, 'INSERT OR IGNORE INTO');
    }

    return normalized;
}

// ==========================
// ⚡ الدوال الأساسية لتنفيذ الاستعلامات
// ==========================
async function dbRun(sql, params = []) {
    const trimmed = (sql || '').trim();

    // في بيئة MySQL، أوامر المعاملات المنفردة عبر تجمع الاتصالات (Pool) تدار تلقائياً
    // ويتم تجاوزها هنا لتجنب خطأ Prepared Statements أو اختلاف صياغة BEGIN TRANSACTION
    if (isMySQL && /^\s*(BEGIN(\s+TRANSACTION)?|START\s+TRANSACTION|COMMIT|ROLLBACK)\s*;?$/i.test(trimmed)) {
        return {
            lastID: 0,
            insertId: 0,
            changes: 0,
            affectedRows: 0
        };
    }

    const query = normalizeQuery(sql);

    if (isMySQL) {
        const [result] = await pool.execute(query, params);
        return {
            lastID: result.insertId,
            insertId: result.insertId,
            changes: result.affectedRows,
            affectedRows: result.affectedRows
        };
    } else {
        return new Promise((resolve, reject) => {
            sqliteDb.run(query, params, function (err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    }
}

async function dbGet(sql, params = []) {
    const query = normalizeQuery(sql);

    if (isMySQL) {
        const [rows] = await pool.execute(query, params);
        return rows.length > 0 ? rows[0] : null;
    } else {
        return new Promise((resolve, reject) => {
            sqliteDb.get(query, params, (err, row) => {
                if (err) reject(err);
                else resolve(row || null);
            });
        });
    }
}

async function dbAll(sql, params = []) {
    const query = normalizeQuery(sql);

    if (isMySQL) {
        const [rows] = await pool.execute(query, params);
        return rows;
    } else {
        return new Promise((resolve, reject) => {
            sqliteDb.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    }
}

// ==========================
// 🛠️ دالة مساعدة لإضافة الأعمدة بأمان
// ==========================
async function safeAddColumn(tableName, columnName, columnDefinition) {
    try {
        if (isMySQL) {
            await pool.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${columnDefinition}`);
        } else {
            await new Promise((resolve) => {
                sqliteDb.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`, () => resolve());
            });
        }
    } catch (err) {
        // تجاهل الخطأ في حال كان العمود موجوداً مسبقاً
        if (err.code === 'ER_DUP_FIELDNAME' || err.message?.includes('duplicate column')) {
            // Already exists
        } else {
            // صامت أو تنبيه خفيف
        }
    }
}

// ==========================
// 🏗️ تهيئة بنية الجداول (Schema Initialization)
// ==========================
async function initDatabase() {
    console.log(`🔧 جاري تهيئة وتدقيق جداول قاعدة البيانات (${isMySQL ? 'Hosted MySQL' : 'Local SQLite'})...`);

    if (isMySQL) {
        await pool.query('SET FOREIGN_KEY_CHECKS = 0');
    }

    const mysqlTables = [
        `CREATE TABLE IF NOT EXISTS sections (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(191) UNIQUE NOT NULL,
            shift_start VARCHAR(20) DEFAULT '08:00',
            shift_end VARCHAR(20) DEFAULT '18:00',
            can_view_income TINYINT DEFAULT 1,
            can_withdraw TINYINT DEFAULT 1,
            can_inspect TINYINT DEFAULT 0,
            can_manage_parts TINYINT DEFAULT 0,
            permissions TEXT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

        `CREATE TABLE IF NOT EXISTS banks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) UNIQUE NOT NULL,
            is_default TINYINT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

        `CREATE TABLE IF NOT EXISTS employees (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(191) NOT NULL,
            section_id INT,
            target INT NOT NULL DEFAULT 0,
            base_salary INT DEFAULT 0,
            target_amount DOUBLE DEFAULT 0,
            deposit_amount DOUBLE DEFAULT 0,
            total_withdrawals DOUBLE DEFAULT 0,
            remaining_salary DOUBLE DEFAULT 0,
            net_remaining DOUBLE DEFAULT 0,
            bank_name VARCHAR(100) DEFAULT 'كاش',
            last_sync_at TIMESTAMP NULL,
            is_active TINYINT DEFAULT 1,
            hide_income TINYINT DEFAULT 0,
            FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

        `CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            employee_id INT NULL,
            username VARCHAR(191) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            role VARCHAR(50) NOT NULL,
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

        `CREATE TABLE IF NOT EXISTS settings (
            \`key\` VARCHAR(191) PRIMARY KEY,
            \`value\` TEXT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

        `CREATE TABLE IF NOT EXISTS entries (
            id INT AUTO_INCREMENT PRIMARY KEY,
            employee_id INT NOT NULL,
            section_id INT NOT NULL,
            income INT NOT NULL,
            details TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
            FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

        `CREATE TABLE IF NOT EXISTS withdrawals (
            id INT AUTO_INCREMENT PRIMARY KEY,
            employee_id INT NOT NULL,
            amount INT NOT NULL,
            reason TEXT,
            status VARCHAR(50) DEFAULT 'pending',
            admin_note TEXT,
            date DATE NULL,
            payment_method VARCHAR(50) DEFAULT 'cash',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

        `CREATE TABLE IF NOT EXISTS absences (
            id INT AUTO_INCREMENT PRIMARY KEY,
            employee_id INT NOT NULL,
            date DATE NOT NULL,
            reason TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

        `CREATE TABLE IF NOT EXISTS leave_requests (
            id INT AUTO_INCREMENT PRIMARY KEY,
            employee_id INT NOT NULL,
            leave_type VARCHAR(50) DEFAULT 'annual',
            start_date VARCHAR(50) NOT NULL,
            end_date VARCHAR(50) NOT NULL,
            days_count INT NOT NULL,
            reason TEXT,
            status VARCHAR(50) DEFAULT 'pending',
            admin_notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

        `CREATE TABLE IF NOT EXISTS branch_shifts (
            day_of_week INT PRIMARY KEY,
            shift_start VARCHAR(20) DEFAULT '08:00',
            shift_end VARCHAR(20) DEFAULT '18:00',
            is_closed TINYINT DEFAULT 0
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

        `CREATE TABLE IF NOT EXISTS attendance (
            id INT AUTO_INCREMENT PRIMARY KEY,
            employee_id INT NOT NULL,
            date DATE NULL,
            check_in TIMESTAMP NULL,
            check_out TIMESTAMP NULL,
            status VARCHAR(50) DEFAULT 'present',
            delay_minutes INT DEFAULT 0,
            late_minutes INT DEFAULT 0,
            early_departure_minutes INT DEFAULT 0,
            early_leaving_minutes INT DEFAULT 0,
            overtime_minutes INT DEFAULT 0,
            total_hours DOUBLE DEFAULT 0,
            shift_start VARCHAR(20) NULL,
            shift_end VARCHAR(20) NULL,
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

        `CREATE TABLE IF NOT EXISTS messages (
            id INT AUTO_INCREMENT PRIMARY KEY,
            employee_id INT NOT NULL,
            sender VARCHAR(50) NOT NULL,
            message TEXT NOT NULL,
            is_read TINYINT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

        `CREATE TABLE IF NOT EXISTS inspections (
            id INT AUTO_INCREMENT PRIMARY KEY,
            inspector_id INT NOT NULL,
            customer_name VARCHAR(191) NULL,
            customer_phone VARCHAR(50) NULL,
            car_type VARCHAR(100) NULL,
            car_color VARCHAR(100) NULL,
            car_model VARCHAR(100) NULL,
            plate_number VARCHAR(50) NULL,
            odometer VARCHAR(50) NULL,
            vin VARCHAR(100) NULL,
            total_amount DOUBLE DEFAULT 0,
            vat_amount DOUBLE DEFAULT 0,
            final_amount DOUBLE DEFAULT 0,
            paid_amount DOUBLE DEFAULT 0,
            remaining_amount DOUBLE DEFAULT 0,
            status VARCHAR(50) DEFAULT 'new',
            car_status VARCHAR(50) DEFAULT 'in_progress',
            assigned_technician_id INT NULL,
            job_order_notes TEXT,
            car_defects_diagram LONGTEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (inspector_id) REFERENCES employees(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

        `CREATE TABLE IF NOT EXISTS sys_notifications (
            id INT AUTO_INCREMENT PRIMARY KEY,
            recipient_type VARCHAR(50) NOT NULL,
            recipient_id INT NULL,
            title VARCHAR(191) NULL,
            message TEXT NULL,
            type VARCHAR(50) DEFAULT 'info',
            is_read TINYINT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

        `CREATE TABLE IF NOT EXISTS inspection_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            inspection_id INT NOT NULL,
            category VARCHAR(191) NULL,
            service_description TEXT NULL,
            quantity INT DEFAULT 1,
            price DOUBLE DEFAULT 0,
            total DOUBLE DEFAULT 0,
            is_completed TINYINT DEFAULT 0,
            completed_at DATETIME NULL,
            completed_by VARCHAR(191) NULL,
            FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

        `CREATE TABLE IF NOT EXISTS inspection_terms (
            id INT AUTO_INCREMENT PRIMARY KEY,
            term VARCHAR(191) UNIQUE NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

        `CREATE TABLE IF NOT EXISTS services (
            id INT AUTO_INCREMENT PRIMARY KEY,
            category VARCHAR(191) NOT NULL,
            service_name VARCHAR(191) NOT NULL,
            price DOUBLE DEFAULT 0,
            UNIQUE KEY uk_cat_service (category, service_name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

        `CREATE TABLE IF NOT EXISTS inspection_bundles (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(191) UNIQUE NOT NULL,
            icon VARCHAR(50) NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

        `CREATE TABLE IF NOT EXISTS inspection_bundle_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            bundle_id INT NOT NULL,
            service_description VARCHAR(255) NOT NULL,
            category VARCHAR(191) NULL,
            FOREIGN KEY (bundle_id) REFERENCES inspection_bundles(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

        `CREATE TABLE IF NOT EXISTS inspection_technicians (
            id INT AUTO_INCREMENT PRIMARY KEY,
            inspection_id INT NOT NULL,
            technician_id INT NOT NULL,
            FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE,
            FOREIGN KEY (technician_id) REFERENCES employees(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

        `CREATE TABLE IF NOT EXISTS inspection_photos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            inspection_id INT NOT NULL,
            photo_type VARCHAR(50) DEFAULT 'before',
            file_path TEXT NOT NULL,
            caption TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

        `CREATE TABLE IF NOT EXISTS clients (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(191) NOT NULL,
            phone VARCHAR(50) NOT NULL,
            intl_phone VARCHAR(50) NULL,
            notes TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_clients_phone (phone),
            INDEX idx_clients_name (name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

        `CREATE TABLE IF NOT EXISTS workshop_lifts (
            id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(191) NOT NULL,
            status VARCHAR(50) DEFAULT 'idle',
            technician_id INT NULL,
            issue_description TEXT NULL,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (technician_id) REFERENCES employees(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

        `CREATE TABLE IF NOT EXISTS work_schedule (
            id INT PRIMARY KEY,
            day_of_week VARCHAR(50) UNIQUE,
            start_time VARCHAR(20),
            end_time VARCHAR(20),
            is_closed TINYINT DEFAULT 0
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

        `CREATE TABLE IF NOT EXISTS promo_codes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            code VARCHAR(50) UNIQUE NOT NULL,
            discount_type VARCHAR(20) NOT NULL DEFAULT 'percentage',
            discount_value DOUBLE NOT NULL DEFAULT 0,
            min_order_amount DOUBLE DEFAULT 0,
            max_discount_amount DOUBLE DEFAULT NULL,
            usage_limit INT DEFAULT NULL,
            times_used INT DEFAULT 0,
            is_active TINYINT DEFAULT 1,
            start_date DATE NULL,
            end_date DATE NULL,
            description VARCHAR(255) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
    ];

    const sqliteTables = [
        `CREATE TABLE IF NOT EXISTS sections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            shift_start TEXT DEFAULT '08:00',
            shift_end TEXT DEFAULT '18:00',
            can_view_income INTEGER DEFAULT 1,
            can_withdraw INTEGER DEFAULT 1,
            can_inspect INTEGER DEFAULT 0,
            can_manage_parts INTEGER DEFAULT 0,
            permissions TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS banks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            is_default INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS employees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            section_id INTEGER,
            target REAL DEFAULT 0,
            base_salary REAL DEFAULT 0,
            target_amount REAL DEFAULT 0,
            deposit_amount REAL DEFAULT 0,
            total_withdrawals REAL DEFAULT 0,
            remaining_salary REAL DEFAULT 0,
            net_remaining REAL DEFAULT 0,
            hide_income INTEGER DEFAULT 0,
            bank_name TEXT DEFAULT 'كاش',
            is_active INTEGER DEFAULT 1,
            last_sync_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE SET NULL
        )`,
        `CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'employee',
            employee_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )`,
        `CREATE TABLE IF NOT EXISTS entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            section_id INTEGER NOT NULL,
            date DATE NOT NULL,
            income REAL NOT NULL DEFAULT 0,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
            FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS withdrawals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            reason TEXT NOT NULL,
            date DATE NOT NULL,
            notes TEXT,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS absences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            date DATE NOT NULL,
            reason TEXT,
            is_excused INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS leave_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            leave_type TEXT NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            days_count INTEGER NOT NULL,
            reason TEXT,
            status TEXT DEFAULT 'pending',
            admin_notes TEXT,
            reviewed_by INTEGER,
            reviewed_at DATETIME,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS branch_shifts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            date DATE NOT NULL,
            check_in_time TEXT,
            check_out_time TEXT,
            status TEXT DEFAULT 'present',
            delay_minutes INTEGER DEFAULT 0,
            early_departure_minutes INTEGER DEFAULT 0,
            overtime_minutes INTEGER DEFAULT 0,
            shift_start TEXT,
            shift_end TEXT,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER NOT NULL,
            recipient_id INTEGER,
            message TEXT NOT NULL,
            is_broadcast INTEGER DEFAULT 0,
            is_read INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
            discount_code TEXT,
            discount_amount REAL DEFAULT 0,
            discount_type TEXT,
            discount_value REAL DEFAULT 0,
            status TEXT DEFAULT 'new',
            car_status TEXT DEFAULT 'in_progress',
            assigned_technician_id INTEGER,
            job_order_notes TEXT,
            car_defects_diagram TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (inspector_id) REFERENCES employees(id) ON DELETE CASCADE
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
            is_completed INTEGER DEFAULT 0,
            completed_at DATETIME,
            completed_by TEXT,
            FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS inspection_terms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            term TEXT NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS services (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL,
            service_name TEXT NOT NULL,
            price REAL NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS inspection_bundles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS inspection_bundle_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bundle_id INTEGER NOT NULL,
            service_description TEXT NOT NULL,
            category TEXT,
            FOREIGN KEY (bundle_id) REFERENCES inspection_bundles(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS inspection_technicians (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            inspection_id INTEGER NOT NULL,
            technician_id INTEGER NOT NULL,
            FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE,
            FOREIGN KEY (technician_id) REFERENCES employees(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS inspection_photos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            inspection_id INTEGER NOT NULL,
            photo_type TEXT DEFAULT 'before',
            file_path TEXT NOT NULL,
            caption TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE
        )`,
        `CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            intl_phone TEXT,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS workshop_lifts (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            status TEXT DEFAULT 'idle',
            technician_id INTEGER,
            issue_description TEXT,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS work_schedule (
            id INTEGER PRIMARY KEY,
            day_of_week TEXT NOT NULL,
            start_time TEXT,
            end_time TEXT,
            is_closed INTEGER DEFAULT 0
        )`,
        `CREATE TABLE IF NOT EXISTS promo_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            discount_type TEXT NOT NULL DEFAULT 'percentage',
            discount_value REAL NOT NULL DEFAULT 0,
            min_order_amount REAL DEFAULT 0,
            max_discount_amount REAL DEFAULT NULL,
            usage_limit INTEGER DEFAULT NULL,
            times_used INTEGER DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            start_date TEXT,
            end_date TEXT,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone)`,
        `CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name)`,
        `CREATE INDEX IF NOT EXISTS idx_promo_code ON promo_codes(code)`
    ];

    const tablesToRun = isMySQL ? mysqlTables : sqliteTables;

    for (const sql of tablesToRun) {
        try {
            if (isMySQL) {
                await pool.query(sql);
            } else {
                await new Promise((res, rej) => {
                    sqliteDb.run(sql, (err) => err ? rej(err) : res());
                });
            }
        } catch (tableErr) {
            console.error('❌ خطأ في إنشاء الجدول:', tableErr.message);
        }
    }

    if (isMySQL) {
        await pool.query('SET FOREIGN_KEY_CHECKS = 1');
    }

    // migrations للأعمدة الإضافية
    await safeAddColumn('sections', 'shift_start', "VARCHAR(20) DEFAULT '08:00'");
    await safeAddColumn('sections', 'shift_end', "VARCHAR(20) DEFAULT '18:00'");
    await safeAddColumn('sections', 'can_view_income', "TINYINT DEFAULT 1");
    await safeAddColumn('sections', 'can_withdraw', "TINYINT DEFAULT 1");
    await safeAddColumn('sections', 'can_inspect', "TINYINT DEFAULT 0");
    await safeAddColumn('sections', 'can_manage_parts', "TINYINT DEFAULT 0");
    await safeAddColumn('sections', 'permissions', "TEXT NULL");
    await safeAddColumn('employees', 'bank_name', "VARCHAR(100) DEFAULT 'كاش'");
    await safeAddColumn('attendance', 'early_departure_minutes', "INT DEFAULT 0");
    await safeAddColumn('attendance', 'overtime_minutes', "INT DEFAULT 0");
    await safeAddColumn('attendance', 'shift_start', "VARCHAR(20) NULL");
    await safeAddColumn('attendance', 'shift_end', "VARCHAR(20) NULL");
    await safeAddColumn('inspections', 'status', "VARCHAR(50) DEFAULT 'new'");
    await safeAddColumn('inspections', 'car_status', "VARCHAR(50) DEFAULT 'in_progress'");
    await safeAddColumn('inspections', 'assigned_technician_id', "INT NULL");
    await safeAddColumn('inspections', 'job_order_notes', "TEXT NULL");
    await safeAddColumn('inspections', 'car_defects_diagram', "LONGTEXT NULL");
    await safeAddColumn('inspections', 'odometer', "VARCHAR(50) NULL");
    await safeAddColumn('inspections', 'vin', "VARCHAR(100) NULL");
    await safeAddColumn('inspections', 'discount_code', "VARCHAR(100) NULL");
    await safeAddColumn('inspections', 'discount_amount', "DOUBLE DEFAULT 0");
    await safeAddColumn('inspections', 'discount_type', "VARCHAR(50) NULL");
    await safeAddColumn('inspections', 'discount_value', "DOUBLE DEFAULT 0");
    await safeAddColumn('inspection_items', 'is_completed', "TINYINT DEFAULT 0");
    await safeAddColumn('inspection_items', 'completed_at', "DATETIME NULL");
    await safeAddColumn('inspection_items', 'completed_by', "VARCHAR(191) NULL");

    // تحقق من الهجرة التلقائية الأولى إذا كانت قاعدة MySQL فارغة تماماً
    if (isMySQL) {
        await autoMigrateFromSqliteIfEmpty();
    }

    // بذر البيانات الأساسية في حال كانت الجداول فارغة
    await seedInitialData();

    console.log(`✅ اكتملت تهيئة قاعدة البيانات بنجاح (${isMySQL ? 'MySQL' : 'SQLite'}).`);
}

// ==========================
// 📦 الهجرة التلقائية من ملف SQLite إذا كانت قاعدة MySQL فارغة
// ==========================
async function autoMigrateFromSqliteIfEmpty() {
    try {
        if (!isMySQL || !pool) return;

        const candidateSeedPaths = [
            path.join(__dirname, 'default_seed.sqlite'),
            path.join(__dirname, 'db.sqlite')
        ];

        let seedPath = candidateSeedPaths.find(p => fs.existsSync(p));
        if (!seedPath) {
            console.log('ℹ️ [Migration] لم يتم العثور على ملف seed أولي للهجرة.');
            return;
        }

        const sqlite3 = require('sqlite3').verbose();
        const srcDb = new sqlite3.Database(seedPath, sqlite3.OPEN_READONLY);

        const sqliteGetAll = (query) => new Promise((resolve, reject) => {
            srcDb.all(query, (err, rows) => err ? reject(err) : resolve(rows || []));
        });

        // قائمة الجداول المراد نقلها بالترتيب المناسب للعلاقات
        const tablesToTransfer = [
            'sections',
            'banks',
            'employees',
            'users',
            'settings',
            'branch_shifts',
            'services',
            'inspection_terms',
            'inspection_bundles',
            'inspection_bundle_items',
            'clients',
            'inspections',
            'inspection_items',
            'inspection_technicians',
            'entries',
            'withdrawals',
            'absences',
            'attendance',
            'messages'
        ];

        await pool.query('SET FOREIGN_KEY_CHECKS = 0');

        let migratedAny = false;
        for (const tableName of tablesToTransfer) {
            try {
                // فحص عدد السجلات الحالية في هذا الجدول داخل MySQL
                let shouldMigrate = false;
                try {
                    const currentCount = await dbGet(`SELECT COUNT(*) as count FROM \`${tableName}\``);
                    if (!currentCount || currentCount.count === 0) {
                        shouldMigrate = true;
                    } else if (tableName === 'users' && currentCount.count <= 1) {
                        // في حال كان جدول المستخدمين يحتوي فقط على المدير الافتراضي، نضيف حسابات الموظفين
                        shouldMigrate = true;
                    }
                } catch (ce) {
                    shouldMigrate = true;
                }

                if (!shouldMigrate) continue;

                const tableExists = await sqliteGetAll(`SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`);
                if (!tableExists || tableExists.length === 0) continue;

                const rows = await sqliteGetAll(`SELECT * FROM ${tableName}`);
                if (!rows || rows.length === 0) continue;

                console.log(`📥 [Migration] نقل جدول ${tableName}: ${rows.length} سجل من ${path.basename(seedPath)} إلى MySQL...`);
                for (const row of rows) {
                    const keys = Object.keys(row);
                    const quotedKeys = keys.map(k => `\`${k}\``).join(', ');
                    const placeholders = keys.map(() => '?').join(', ');
                    const values = keys.map(k => row[k]);

                    await pool.execute(
                        `INSERT IGNORE INTO \`${tableName}\` (${quotedKeys}) VALUES (${placeholders})`,
                        values
                    );
                }
                migratedAny = true;
            } catch (tblErr) {
                console.warn(`⚠️ تعذر نقل جدول ${tableName}:`, tblErr.message);
            }
        }

        await pool.query('SET FOREIGN_KEY_CHECKS = 1');
        srcDb.close();
        if (migratedAny) {
            console.log('🎉 [Migration] اكتملت هجرة البيانات الأولية بنجاح إلى MySQL!');
        }
    } catch (migErr) {
        console.warn('⚠️ [Migration] حدث خطأ أثناء فحص/تنفيذ الهجرة التلقائية:', migErr.message);
    }
}

// ==========================
// 🌱 بذر البيانات الأولية الافتراضية
// ==========================
async function seedInitialData() {
    try {
        // الإعدادات
        await dbRun(`INSERT IGNORE INTO settings (\`key\`, \`value\`) VALUES ('app_name', 'Atenza App')`);
        await dbRun(`INSERT IGNORE INTO settings (\`key\`, \`value\`) VALUES ('workshop_name', 'Atenza App')`);
        await dbRun(`INSERT IGNORE INTO settings (\`key\`, \`value\`) VALUES ('max_withdrawal_limit', '500')`);

        // المستخدم المدير الافتراضي
        await dbRun(`INSERT IGNORE INTO users (username, password, role) VALUES (?, ?, ?)`,
            ['admin', 'admin123', 'admin']
        );

        // الأقسام الافتراضية
        const defaultSections = ['مكانيكا', 'كهرباء', 'كشف', 'ادارة'];
        for (const sName of defaultSections) {
            await dbRun(`INSERT IGNORE INTO sections (name) VALUES (?)`, [sName]);
        }

        // البنوك الافتراضية
        const defaultBanks = ['الاهلي', 'الراجحي', 'بنوك محلية', 'كاش'];
        for (const bName of defaultBanks) {
            await dbRun(`INSERT IGNORE INTO banks (name) VALUES (?)`, [bName]);
        }

        // مواعيد الفرع الافتراضية
        const meShifts = [
            { day: 0, start: '08:00', end: '18:00', closed: 0 },
            { day: 1, start: '08:00', end: '18:00', closed: 0 },
            { day: 2, start: '08:00', end: '18:00', closed: 0 },
            { day: 3, start: '08:00', end: '18:00', closed: 0 },
            { day: 4, start: '08:00', end: '18:00', closed: 0 },
            { day: 5, start: '08:00', end: '18:00', closed: 1 },
            { day: 6, start: '08:30', end: '17:30', closed: 0 }
        ];

        for (const s of meShifts) {
            await dbRun(`INSERT IGNORE INTO branch_shifts (day_of_week, shift_start, shift_end, is_closed) VALUES (?, ?, ?, ?)`,
                [s.day, s.start, s.end, s.closed]
            );
        }

        // بذر الخدمات الافتراضية إذا كان الجدول فارغاً
        const sCount = await dbGet("SELECT COUNT(*) as count FROM services");
        if (sCount && sCount.count === 0) {
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

            for (const cat of Object.keys(defaultServices)) {
                for (const item of defaultServices[cat]) {
                    await dbRun("INSERT IGNORE INTO services (category, service_name, price) VALUES (?, ?, ?)",
                        [cat, item.service, item.price]);
                }
            }
            console.log('🌱 تم بذر الخدمات الافتراضية');
        }

        // بذر باقات الكشف
        const bCount = await dbGet("SELECT COUNT(*) as count FROM inspection_bundles");
        if (bCount && bCount.count === 0) {
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

            for (const b of defaultBundles) {
                const bRes = await dbRun("INSERT IGNORE INTO inspection_bundles (name, icon) VALUES (?, ?)", [b.name, b.icon]);
                const bundleId = bRes.lastID || bRes.insertId;
                if (bundleId) {
                    for (const item of b.items) {
                        await dbRun("INSERT IGNORE INTO inspection_bundle_items (bundle_id, service_description, category) VALUES (?, ?, ?)",
                            [bundleId, item.service, item.category]);
                    }
                }
            }
            console.log('🌱 تم بذر باقات الكشف الافتراضية');
        }

        // بذر جدول العمل الأسبوعي
        const schedCount = await dbGet("SELECT COUNT(*) as count FROM work_schedule");
        if (schedCount && schedCount.count === 0) {
            const defaultDays = [
                { id: 1, day: 'Sunday', start: '08:30', end: '17:30', closed: 0 },
                { id: 2, day: 'Monday', start: '08:30', end: '17:30', closed: 0 },
                { id: 3, day: 'Tuesday', start: '08:30', end: '17:30', closed: 0 },
                { id: 4, day: 'Wednesday', start: '08:30', end: '17:30', closed: 0 },
                { id: 5, day: 'Thursday', start: '08:30', end: '17:30', closed: 0 },
                { id: 6, day: 'Friday', start: '', end: '', closed: 1 },
                { id: 7, day: 'Saturday', start: '08:30', end: '17:30', closed: 0 }
            ];
            for (const d of defaultDays) {
                await dbRun("INSERT IGNORE INTO work_schedule (id, day_of_week, start_time, end_time, is_closed) VALUES (?, ?, ?, ?, ?)",
                    [d.id, d.day, d.start, d.end, d.closed]);
            }
        }

        // بذر الرافعات الافتراضية
        const liftsCount = await dbGet("SELECT COUNT(*) as count FROM workshop_lifts");
        if (liftsCount && liftsCount.count === 0) {
            const defaultLifts = ['A', 'B', 'C', 'D', 'E'];
            for (const lid of defaultLifts) {
                await dbRun("INSERT IGNORE INTO workshop_lifts (id, name, status) VALUES (?, ?, 'idle')",
                    [lid, `رافعة ${lid}`]);
            }
        }
    } catch (seedErr) {
        console.error('❌ خطأ في بذر البيانات الافتراضية:', seedErr.message);
    }
}

// ==========================
// 📤 وظائف النسخ الاحتياطي والاستعادة العامة
// ==========================
async function exportDatabaseJson() {
    const tables = [
        'sections',
        'banks',
        'employees',
        'users',
        'settings',
        'branch_shifts',
        'services',
        'inspection_terms',
        'inspection_bundles',
        'inspection_bundle_items',
        'clients',
        'inspections',
        'inspection_items',
        'inspection_technicians',
        'entries',
        'withdrawals',
        'absences',
        'attendance',
        'messages',
        'sys_notifications',
        'inspection_photos',
        'workshop_lifts',
        'work_schedule',
        'promo_codes'
    ];

    const backupData = {
        version: "5.0.0",
        exported_at: new Date().toISOString(),
        tables: {}
    };

    for (const table of tables) {
        try {
            backupData.tables[table] = await dbAll(`SELECT * FROM \`${table}\``);
        } catch (e) {
            backupData.tables[table] = [];
        }
    }

    return backupData;
}

async function restoreDatabaseFromJson(jsonData) {
    if (!jsonData || !jsonData.tables) {
        throw new Error('بيانات النسخ الاحتياطي غير صالحة');
    }

    if (isMySQL) {
        await pool.query('SET FOREIGN_KEY_CHECKS = 0');
    }

    for (const tableName of Object.keys(jsonData.tables)) {
        const rows = jsonData.tables[tableName];
        if (!Array.isArray(rows) || rows.length === 0) continue;

        for (const row of rows) {
            const keys = Object.keys(row);
            const quotedKeys = keys.map(k => `\`${k}\``).join(', ');
            const placeholders = keys.map(() => '?').join(', ');
            const values = keys.map(k => row[k]);

            await dbRun(
                `REPLACE INTO \`${tableName}\` (${quotedKeys}) VALUES (${placeholders})`,
                values
            );
        }
    }

    if (isMySQL) {
        await pool.query('SET FOREIGN_KEY_CHECKS = 1');
    }

    return true;
}

module.exports = {
    pool,
    sqliteDb,
    isMySQL,
    dbRun,
    dbGet,
    dbAll,
    initDatabase,
    autoMigrateFromSqliteIfEmpty,
    exportDatabaseJson,
    restoreDatabaseFromJson
};
