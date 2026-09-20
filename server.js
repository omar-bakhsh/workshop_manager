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

const docStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, 'uploads', 'documents');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname) || '';
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'doc-' + uniqueSuffix + ext);
    }
});
const uploadDocument = multer({
    storage: docStorage,
    limits: { fileSize: 25 * 1024 * 1024 } // 25MB
});

const upload = multer({ dest: 'uploads/' });
const xlsx = require('xlsx');
const { importClients, normalizePhone } = require('./import_clients');

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
// 🧩 إعداد قاعدة البيانات المركزية (Hosted MySQL / SQLite Fallback)
// ========================== 
const {
    dbRun,
    dbGet,
    dbAll,
    initDatabase,
    autoMigrateFromSqliteIfEmpty,
    isMySQL,
    exportDatabaseJson,
    restoreDatabaseFromJson
} = require('./db');

// تهيئة الجداول وترحيل الحقول عند إقلاع التطبيق
initDatabase().catch(err => {
    console.error('❌ خطأ في تهيئة قاعدة البيانات:', err);
});

// مسار مزامنة واسترجاع البيانات الأولية (الموظفين والعملاء والخدمات) من ملف SQLite
app.post(['/api/admin/sync-seed-data', '/api/backup/sync-seed'], async (req, res) => {
    try {
        if (isMySQL) {
            await autoMigrateFromSqliteIfEmpty();
            res.json({ success: true, message: "تمت مزامنة كافة بيانات الموظفين والعملاء بنجاح إلى MySQL 🚀" });
        } else {
            res.json({ success: true, message: "أنت تعمل بالفعل على قاعدة بيانات SQLite المحلية." });
        }
    } catch (e) {
        console.error("Sync Error:", e);
        res.status(500).json({ success: false, message: "خطأ في المزامنة: " + e.message });
    }
});

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
        if (error.code === 'SQLITE_CONSTRAINT' || error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
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
        const userCheck = await dbGet('SELECT id FROM users WHERE employee_id = ? LIMIT 1', [id]);
        if (userCheck) {
            await dbRun(`UPDATE users SET username = ?, password = ? WHERE id = ?`, [username, password, userCheck.id]);
        }

        res.json({ message: "تم تحديث بيانات الموظف بنجاح" });
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT' || error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
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
// ==========================================
// SECTIONS MANAGEMENT ENDPOINTS
// ==========================================

app.get('/api/sections', async (req, res) => {
    try {
        const sections = await dbAll('SELECT * FROM sections ORDER BY id ASC');
        res.json(sections);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to fetch sections' });
    }
});

app.post('/api/sections', async (req, res) => {
    try {
        const { name, shift_start, shift_end, can_view_income, can_withdraw, can_inspect, can_manage_parts, permissions } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ message: 'اسم القسم مطلوب' });
        const cleanName = name.trim();
        const existing = await dbGet('SELECT id FROM sections WHERE name = ?', [cleanName]);
        if (existing) return res.status(400).json({ message: 'يوجد قسم مسجل بهذا الاسم مسبقاً' });

        const result = await dbRun(
            `INSERT INTO sections (name, shift_start, shift_end, can_view_income, can_withdraw, can_inspect, can_manage_parts, permissions)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                cleanName,
                shift_start || '08:00',
                shift_end || '18:00',
                can_view_income !== undefined ? (can_view_income ? 1 : 0) : 1,
                can_withdraw !== undefined ? (can_withdraw ? 1 : 0) : 1,
                can_inspect !== undefined ? (can_inspect ? 1 : 0) : 0,
                can_manage_parts !== undefined ? (can_manage_parts ? 1 : 0) : 0,
                typeof permissions === 'object' ? JSON.stringify(permissions) : (permissions || null)
            ]
        );
        res.json({ success: true, id: result.insertId || result.lastID, message: 'تمت إضافة القسم بنجاح' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'فشل إضافة القسم: ' + e.message });
    }
});

app.put('/api/sections/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, shift_start, shift_end, can_view_income, can_withdraw, can_inspect, can_manage_parts, permissions } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ message: 'اسم القسم مطلوب' });
        const cleanName = name.trim();

        const duplicate = await dbGet('SELECT id FROM sections WHERE name = ? AND id != ?', [cleanName, id]);
        if (duplicate) return res.status(400).json({ message: 'يوجد قسم آخر بنفس هذا الاسم' });

        await dbRun(
            `UPDATE sections SET
                name = ?,
                shift_start = COALESCE(?, shift_start),
                shift_end = COALESCE(?, shift_end),
                can_view_income = ?,
                can_withdraw = ?,
                can_inspect = ?,
                can_manage_parts = ?,
                permissions = ?
             WHERE id = ?`,
            [
                cleanName,
                shift_start || '08:00',
                shift_end || '18:00',
                can_view_income !== undefined ? (can_view_income ? 1 : 0) : 1,
                can_withdraw !== undefined ? (can_withdraw ? 1 : 0) : 1,
                can_inspect !== undefined ? (can_inspect ? 1 : 0) : 0,
                can_manage_parts !== undefined ? (can_manage_parts ? 1 : 0) : 0,
                typeof permissions === 'object' ? JSON.stringify(permissions) : (permissions || null),
                id
            ]
        );
        res.json({ success: true, message: 'تم حفظ وتحديث بيانات وصلاحيات القسم بنجاح' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'فشل تعديل القسم: ' + e.message });
    }
});

app.delete('/api/sections/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const inUse = await dbGet('SELECT COUNT(*) as count FROM employees WHERE section_id = ?', [id]);
        if (inUse && inUse.count > 0) {
            return res.status(400).json({ message: 'لا يمكن حذف القسم لوجود موظفين مرتبطين به' });
        }
        await dbRun('DELETE FROM sections WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to delete section' });
    }
});

// ==========================================
// 🏦 BANKS MANAGEMENT ENDPOINTS (إدارة البنوك)
// ==========================================

app.get('/api/banks', async (req, res) => {
    try {
        let banks = await dbAll('SELECT * FROM banks ORDER BY id ASC');
        if (!banks || banks.length === 0) {
            const defaultBanks = ['الاهلي', 'الراجحي', 'بنوك محلية', 'كاش'];
            for (const bName of defaultBanks) {
                await dbRun('INSERT IGNORE INTO banks (name) VALUES (?)', [bName]);
            }
            banks = await dbAll('SELECT * FROM banks ORDER BY id ASC');
        }
        res.json(banks);
    } catch (e) {
        console.error('Error fetching banks:', e);
        res.status(500).json({ error: 'Failed to fetch banks' });
    }
});

app.post('/api/banks', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ message: 'اسم البنك مطلوب' });
        const cleanName = name.trim();
        
        const existing = await dbGet('SELECT id FROM banks WHERE name = ?', [cleanName]);
        if (existing) {
            return res.status(400).json({ message: 'هذا البنك مسجل بالفعل مسبقاً' });
        }

        const result = await dbRun('INSERT INTO banks (name) VALUES (?)', [cleanName]);
        res.json({ success: true, id: result.insertId || result.lastID, name: cleanName, message: 'تمت إضافة البنك بنجاح' });
    } catch (e) {
        console.error('Error adding bank:', e);
        res.status(500).json({ message: 'فشل إضافة البنك: ' + e.message });
    }
});

app.put('/api/banks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ message: 'اسم البنك مطلوب' });
        const cleanName = name.trim();

        const oldBank = await dbGet('SELECT name FROM banks WHERE id = ?', [id]);
        if (!oldBank) {
            return res.status(404).json({ message: 'البنك غير موجود' });
        }

        const duplicate = await dbGet('SELECT id FROM banks WHERE name = ? AND id != ?', [cleanName, id]);
        if (duplicate) {
            return res.status(400).json({ message: 'يوجد بنك آخر بنفس هذا الاسم' });
        }

        await dbRun('UPDATE banks SET name = ? WHERE id = ?', [cleanName, id]);

        // تحديث الموظفين المرتبطين بالاسم القديم
        if (oldBank.name !== cleanName) {
            await dbRun('UPDATE employees SET bank_name = ? WHERE bank_name = ?', [cleanName, oldBank.name]);
        }

        res.json({ success: true, message: 'تم تعديل اسم البنك وتحديث سجلات الموظفين بنجاح' });
    } catch (e) {
        console.error('Error updating bank:', e);
        res.status(500).json({ message: 'فشل تعديل البنك: ' + e.message });
    }
});

app.delete('/api/banks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const bank = await dbGet('SELECT name FROM banks WHERE id = ?', [id]);
        if (!bank) {
            return res.status(404).json({ message: 'البنك غير موجود' });
        }

        // تحويل الموظفين المرتبطين إلى كاش لتفادي بقاء أسماء مفقودة
        await dbRun("UPDATE employees SET bank_name = 'كاش' WHERE bank_name = ?", [bank.name]);
        await dbRun('DELETE FROM banks WHERE id = ?', [id]);

        res.json({ success: true, message: 'تم حذف البنك بنجاح' });
    } catch (e) {
        console.error('Error deleting bank:', e);
        res.status(500).json({ message: 'فشل حذف البنك: ' + e.message });
    }
});

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

// ==========================
// 📊 معالج الاستيراد الذكي لملفات الموظفين والرواتب (Smart Excel Parser)
// ==========================
function cleanArabicText(str) {
    return String(str || '')
        .trim()
        .toLowerCase()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي');
}

async function handleSmartEmployeeImport(filePath) {
    const wb = xlsx.readFile(filePath);
    let tableSheet = null;
    let matrixSheet = null;

    for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(ws, { header: 1 });
        if (!data || data.length === 0) continue;

        const row1 = (data[0] || []).map(c => cleanArabicText(c));
        const row2 = (data[1] || []).map(c => cleanArabicText(c));

        const hasNameHeader = row1.some(c => /اسم|name/i.test(c) && !/مستخدم/i.test(c)) || row2.some(c => /اسم|name/i.test(c) && !/مستخدم/i.test(c));
        const hasSectionHeader = row1.some(c => /قسم|section|dept/i.test(c)) || row2.some(c => /قسم|section|dept/i.test(c));

        if (hasNameHeader && (hasSectionHeader || row1.some(c => /راتب|salary|هدف|تارجت|تارقت|target/i.test(c)))) {
            tableSheet = { name: sheetName, data, headerRowIdx: row1.some(c => /اسم|name/i.test(c) && !/مستخدم/i.test(c)) ? 0 : 1 };
            break;
        }

        const col1Texts = data.map(r => cleanArabicText(r && (r[0] || r[1] || r[2])));
        const hasSalaryKeywords = col1Texts.some(t => /سحوبات|راتب|ايداع|صافي|متبقي|تارقت|تارجت/i.test(t));
        if (hasSalaryKeywords) {
            matrixSheet = { name: sheetName, data };
        }
    }

    // سجلات الموظفين الحالية
    const allEmployees = await dbAll("SELECT id, name, section_id FROM employees WHERE is_active = 1");
    const existingNamesMap = new Map();
    allEmployees.forEach(e => {
        existingNamesMap.set(cleanArabicText(e.name), e);
    });

    const existingUsers = await dbAll("SELECT username FROM users");
    const existingUsernames = new Set(existingUsers.map(u => String(u.username).toLowerCase()));

    // كاش ومطابقة الأقسام أو إنشاؤها تلقائياً
    const sectionCache = new Map();
    const dbSections = await dbAll("SELECT id, name FROM sections");
    dbSections.forEach(s => sectionCache.set(cleanArabicText(s.name), s.id));

    let createdSectionsCount = 0;
    const getOrCreateSectionId = async (sectionName) => {
        const cleanSec = cleanArabicText(sectionName || 'عام');
        if (!cleanSec) return dbSections[0]?.id || 1;
        if (sectionCache.has(cleanSec)) return sectionCache.get(cleanSec);

        for (const [sName, sId] of sectionCache.entries()) {
            if (sName.includes(cleanSec) || cleanSec.includes(sName)) {
                return sId;
            }
        }

        // إنشاء قسم جديد تلقائياً
        const rawName = String(sectionName).trim() || 'قسم عام';
        try {
            const res = await dbRun("INSERT INTO sections (name, shift_start, shift_end, can_view_income, can_withdraw) VALUES (?, '08:00', '18:00', 1, 1)", [rawName]);
            const newId = res.insertId || res.lastID;
            if (newId) {
                sectionCache.set(cleanSec, newId);
                createdSectionsCount++;
                return newId;
            }
        } catch (e) {
            console.warn('Auto create section warning:', e.message);
        }
        return dbSections[0]?.id || 1;
    };

    let addedCount = 0;
    let updatedCount = 0;

    if (tableSheet) {
        // --- النمط 1: جدول موظفين مباشر (مثل موظفين.xlsx) ---
        const headerRow = tableSheet.data[tableSheet.headerRowIdx].map(c => cleanArabicText(c));
        const headers = {};
        headerRow.forEach((h, idx) => {
            if (/اسم|name/i.test(h) && !/مستخدم/i.test(h)) headers.name = idx;
            else if (/قسم|section|dept/i.test(h)) headers.section = idx;
            else if (/هدف|تارجت|تارقت|target/i.test(h)) headers.target = idx;
            else if (/راتب|salary|اساس|base/i.test(h)) headers.salary = idx;
            else if (/مستخدم|دخول|user/i.test(h)) headers.username = idx;
            else if (/مرور|password|pass/i.test(h)) headers.password = idx;
            else if (/بنك|bank/i.test(h)) headers.bank = idx;
        });

        for (let r = tableSheet.headerRowIdx + 1; r < tableSheet.data.length; r++) {
            const row = tableSheet.data[r];
            if (!row || row.length === 0) continue;
            const name = String(row[headers.name] || '').trim();
            if (!name || name.length < 2) continue;

            const cleanName = cleanArabicText(name);
            const sectionRaw = headers.section !== undefined ? String(row[headers.section] || '').trim() : '';
            const section_id = await getOrCreateSectionId(sectionRaw);
            const base_salary = headers.salary !== undefined ? parseFloat(row[headers.salary]) || 0 : 0;
            const target = headers.target !== undefined ? parseFloat(row[headers.target]) || 0 : 0;
            const bank_name = headers.bank !== undefined ? String(row[headers.bank] || 'كاش').trim() : 'كاش';

            let username = headers.username !== undefined ? String(row[headers.username] || '').trim() : '';
            let password = headers.password !== undefined ? String(row[headers.password] || '').trim() : '';

            if (existingNamesMap.has(cleanName)) {
                const existingEmp = existingNamesMap.get(cleanName);
                await dbRun(
                    `UPDATE employees SET
                        section_id = COALESCE(NULLIF(?, 0), section_id),
                        base_salary = CASE WHEN ? > 0 THEN ? ELSE base_salary END,
                        target = CASE WHEN ? > 0 THEN ? ELSE target END,
                        bank_name = COALESCE(NULLIF(?, ''), bank_name),
                        last_sync_at = CURRENT_TIMESTAMP
                     WHERE id = ?`,
                    [section_id, base_salary, base_salary, target, target, bank_name, existingEmp.id]
                );
                if (password) {
                    await dbRun("UPDATE users SET password = ? WHERE employee_id = ?", [password, existingEmp.id]);
                }
                updatedCount++;
            } else {
                if (!username) {
                    let baseUsername = name.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/gi, '');
                    if (!baseUsername) baseUsername = 'user';
                    username = baseUsername;
                    let counter = 1;
                    while (existingUsernames.has(username.toLowerCase())) {
                        username = baseUsername + counter;
                        counter++;
                    }
                }
                existingUsernames.add(username.toLowerCase());
                if (!password) password = '1234';

                const empResult = await dbRun(
                    `INSERT INTO employees (name, section_id, target, base_salary, target_amount, hide_income, bank_name, is_active, last_sync_at)
                     VALUES (?, ?, ?, ?, ?, 0, ?, 1, CURRENT_TIMESTAMP)`,
                    [name, section_id, target, base_salary, target, bank_name || 'كاش']
                );
                const empId = empResult.insertId || empResult.lastID;
                if (empId) {
                    await dbRun(
                        `INSERT INTO users (employee_id, username, password, role) VALUES (?, ?, ?, 'employee')`,
                        [empId, username, password]
                    );
                    existingNamesMap.set(cleanName, { id: empId, name });
                    addedCount++;
                }
            }
        }

        return {
            success: true,
            type: 'table',
            sheetName: tableSheet.name,
            message: `تم استيراد ${addedCount} موظف جديد وتحديث ${updatedCount} موظف بنجاح${createdSectionsCount > 0 ? ` (وتم إنشاء ${createdSectionsCount} قسم جديد)` : ''}.`,
            addedCount,
            updatedCount,
            createdSectionsCount
        };
    } else if (matrixSheet) {
        // --- النمط 2: مصفوفة كشف الرواتب (مثل Salaries-9.xlsx) ---
        const data = matrixSheet.data;
        let nameRowIdx = 0;
        let nameCount = 0;
        for (let r = 0; r < Math.min(5, data.length); r++) {
            const names = (data[r] || []).filter(c => c && String(c).trim().length > 1 && !/تاريخ|date/i.test(cleanArabicText(c)));
            if (names.length > nameCount) {
                nameCount = names.length;
                nameRowIdx = r;
            }
        }

        const nameRow = data[nameRowIdx] || [];
        let ind = { b: -1, t: -1, d: -1, w: -1, r: -1, nr: -1 };
        data.forEach((row, rowIdx) => {
            const rowText = cleanArabicText((row && (row[0] || row[1] || row[2])) || '');
            const has = (txt) => rowText.includes(txt);
            if (has('اجمالي السحوبات') || has('سحوبات') || rowText === 'السحوبات') ind.w = rowIdx;
            if (has('الراتب المتبقي') || has('اجمالي المتبقي')) ind.r = rowIdx;
            if (has('الراتب الاساسي') || has('الراتب الاستحقاق') || (has('راتب') && has('اساسي'))) ind.b = rowIdx;
            if (has('ايداع موسسه') || has('ايداع كاش') || has('ايداع')) ind.d = rowIdx;
            if (has('المتبقي الصافي') || has('الصافي') || has('صافي المتبقي')) ind.nr = rowIdx;
            if (has('مكافاه التارقت') || has('بونص التارقت') || (has('التارقت') && rowIdx > 20) || (has('التارجت') && rowIdx > 20)) ind.t = rowIdx;
        });

        for (let col = 0; col < nameRow.length; col++) {
            const rawName = String(nameRow[col] || '').trim();
            if (!rawName || rawName.length < 2 || /تاريخ|date/i.test(cleanArabicText(rawName))) continue;

            const getNum = (rIdx) => {
                if (rIdx === -1 || !data[rIdx]) return 0;
                const v = parseFloat(data[rIdx][col]);
                return isNaN(v) ? 0 : v;
            };

            const base_salary = getNum(ind.b);
            const target_amount = getNum(ind.t);
            const deposit_amount = getNum(ind.d);
            const total_withdrawals = getNum(ind.w);
            const net_remaining = getNum(ind.nr) || getNum(ind.r);

            const cleanName = cleanArabicText(rawName);
            let matchedEmp = existingNamesMap.get(cleanName);

            if (!matchedEmp) {
                for (const [eName, eObj] of existingNamesMap.entries()) {
                    if (eName.includes(cleanName) || cleanName.includes(eName)) {
                        matchedEmp = eObj;
                        break;
                    }
                }
            }

            if (matchedEmp) {
                await dbRun(
                    `UPDATE employees SET
                        base_salary = CASE WHEN ? > 0 THEN ? ELSE base_salary END,
                        target_amount = ?,
                        deposit_amount = ?,
                        total_withdrawals = ?,
                        net_remaining = ?,
                        last_sync_at = CURRENT_TIMESTAMP
                     WHERE id = ?`,
                    [base_salary, base_salary, target_amount, deposit_amount, total_withdrawals, net_remaining, matchedEmp.id]
                );
                updatedCount++;
            } else {
                let baseUsername = rawName.split(/[\s-_]+/)[0].toLowerCase().replace(/[^a-z0-9]/gi, '');
                if (!baseUsername) baseUsername = 'user';
                let username = baseUsername;
                let counter = 1;
                while (existingUsernames.has(username.toLowerCase())) {
                    username = baseUsername + counter;
                    counter++;
                }
                existingUsernames.add(username.toLowerCase());

                const defaultSecId = dbSections[0]?.id || 1;
                const empResult = await dbRun(
                    `INSERT INTO employees (name, section_id, target, base_salary, target_amount, deposit_amount, total_withdrawals, net_remaining, hide_income, bank_name, is_active, last_sync_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'كاش', 1, CURRENT_TIMESTAMP)`,
                    [rawName, defaultSecId, 0, base_salary, target_amount, deposit_amount, total_withdrawals, net_remaining]
                );
                const empId = empResult.insertId || empResult.lastID;
                if (empId) {
                    await dbRun(
                        `INSERT INTO users (employee_id, username, password, role) VALUES (?, ?, '1234', 'employee')`,
                        [empId, username]
                    );
                    existingNamesMap.set(cleanName, { id: empId, name: rawName });
                    addedCount++;
                }
            }
        }

        return {
            success: true,
            type: 'matrix',
            sheetName: matrixSheet.name,
            message: `تمت مزامنة بيانات الرواتب بنجاح: تحديث ${updatedCount} موظف وإضافة ${addedCount} موظف جديد.`,
            addedCount,
            updatedCount
        };
    } else {
        throw new Error('لم يتم التعرف على بنية ملف الإكسل. يرجى التأكد من اختيار ملف موظفين أو ملف رواتب صحيح.');
    }
}

// 📊 استيراد الموظفين من ملف Excel (يدعم Salaries-9.xlsx و موظفين.xlsx)
app.post(['/api/employees/import-excel', '/api/employees/import-from-salary-sheet'], upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'الرجاء رفع ملف Excel.' });
    const filePath = req.file.path;
    try {
        const result = await handleSmartEmployeeImport(filePath);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.json(result);
    } catch (error) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        console.error('Import Excel Error:', error);
        res.status(500).json({ success: false, message: error.message || 'خطأ في معالجة الملف' });
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
        // جلب بيانات الموظف والصلاحيات والوردية الخاصة بقسمه
        const info = await dbGet(`
            SELECT 
                e.*, 
                s.name AS section_name,
                COALESCE(s.can_view_income, 1) AS can_view_income,
                COALESCE(s.can_withdraw, 1) AS can_withdraw,
                COALESCE(s.can_inspect, 0) AS can_inspect,
                COALESCE(s.can_manage_parts, 0) AS can_manage_parts,
                COALESCE(s.shift_start, '08:00') AS shift_start,
                COALESCE(s.shift_end, '18:00') AS shift_end
            FROM employees e 
            LEFT JOIN sections s ON e.section_id = s.id 
            WHERE e.id = ? AND e.is_active = 1
        `, [id]);

        if (!info) {
            return res.status(404).json({ message: "لم يتم العثور على الموظف أو أنه غير نشط." });
        }

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

        const isIncomeHidden = (info.hide_income == 1 || info.can_view_income === 0);

        const permissions = {
            can_view_income: !isIncomeHidden,
            can_withdraw: info.can_withdraw !== 0,
            can_inspect: info.can_inspect == 1,
            can_manage_parts: info.can_manage_parts == 1
        };

        res.json({
            ...info,
            info,
            permissions,
            shift_start: info.shift_start,
            shift_end: info.shift_end,
            total_income: isIncomeHidden ? -1 : totalIncomeRow.total_income,
            total_withdrawal: totalWithdrawalRow.total_withdrawal,
            entries: isIncomeHidden ? [] : entries,
            withdrawals,
            absences,
            income_hidden: isIncomeHidden
        });
    } catch (error) {
        console.error("Fetch Employee Stats Error:", error);
        res.status(500).json({ message: "خطأ في جلب إحصائيات الموظف" });
    }
});

// جلب أوامر العمل والسيارات المسندة للموظف
app.get('/api/employee/:id/assigned-jobs', async (req, res) => {
    const { id } = req.params;
    try {
        const emp = await dbGet('SELECT id, name, section_id FROM employees WHERE id = ?', [id]);
        if (!emp) return res.status(404).json({ message: 'الموظف غير موجود' });

        const jobs = await dbAll(`
            SELECT 
                i.id,
                i.customer_name,
                i.customer_phone,
                i.car_type,
                i.car_color,
                i.car_model,
                i.plate_number,
                i.status,
                i.car_status,
                i.assigned_technician_id,
                i.created_at,
                COALESCE(i.final_amount, i.total_amount, 0) as grand_total,
                (SELECT COUNT(*) FROM inspection_items WHERE inspection_id = i.id) as items_count,
                (SELECT COUNT(*) FROM inspection_items WHERE inspection_id = i.id AND is_completed = 1) as approved_items_count
            FROM inspections i
            WHERE i.assigned_technician_id = ?
               OR i.inspector_id = ?
               OR EXISTS (SELECT 1 FROM inspection_technicians it WHERE it.inspection_id = i.id AND it.technician_id = ?)
            ORDER BY i.created_at DESC
            LIMIT 30
        `, [id, id, id]);

        res.json(jobs || []);
    } catch (e) {
        console.error('Assigned jobs fetch error:', e);
        res.status(500).json({ error: 'Failed to fetch assigned jobs' });
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

// إنشاء طلب إجازة جديد (Employee) مع دعم إرفاق السكليف / التقرير الطبي
app.post('/api/leave-requests', uploadDocument.single('attachment'), async (req, res) => {
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

        let attachmentPath = null;
        let attachmentName = null;
        if (req.file) {
            attachmentPath = 'uploads/documents/' + req.file.filename;
            attachmentName = req.file.originalname;
        }

        await dbRun(`
            INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, days_count, reason, attachment_path, attachment_name)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [employee_id, leave_type || 'annual', start_date, end_date, days_count, reason, attachmentPath, attachmentName]);

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

// ==========================================
// 📂 Employee Documents & Sick Leaves API
// ==========================================
// رفع مستند / سكليف من الموظف
app.post('/api/employee/documents', uploadDocument.single('file'), async (req, res) => {
    try {
        const { employee_id, document_type, title, notes } = req.body;
        if (!employee_id || !title) {
            return res.status(400).json({ message: 'معرف الموظف وعنوان المستند مطلوبان' });
        }
        if (!req.file) {
            return res.status(400).json({ message: 'يرجى اختيار ملف المستند للرفع' });
        }

        const filePath = 'uploads/documents/' + req.file.filename;
        const fileName = req.file.originalname;
        const fileSize = req.file.size;
        const mimeType = req.file.mimetype;

        const result = await dbRun(`
            INSERT INTO employee_documents (employee_id, document_type, title, notes, file_path, file_name, file_size, mime_type, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        `, [employee_id, document_type || 'other', title, notes || '', filePath, fileName, fileSize, mimeType]);

        // إشعار للإدارة
        const emp = await dbGet('SELECT name FROM employees WHERE id = ?', [employee_id]);
        const empName = emp ? emp.name : 'موظف';
        await dbRun(`
            INSERT INTO sys_notifications (recipient_type, recipient_id, title, message, type)
            VALUES ('admin', 0, 'مستند جديد من موظف', ?, 'info')
        `, [`قام الموظف (${empName}) برفع مستند جديد: ${title}`]);

        res.json({ message: 'تم رفع المستند بنجاح وتحويله لمراجعة الإدارة', id: result.lastID, file_path: filePath });
    } catch (error) {
        console.error('Upload document error:', error);
        res.status(500).json({ message: 'خطأ في رفع المستند' });
    }
});

// جلب مستندات موظف محدد
app.get('/api/employee/:id/documents', async (req, res) => {
    try {
        const docs = await dbAll(`
            SELECT * FROM employee_documents
            WHERE employee_id = ?
            ORDER BY created_at DESC
        `, [req.params.id]);
        res.json(docs);
    } catch (error) {
        console.error('Fetch employee docs error:', error);
        res.status(500).json({ message: 'خطأ في جلب المستندات' });
    }
});

// جلب جميع المستندات للإدارة مع الفلترة
app.get('/api/admin/documents', async (req, res) => {
    try {
        const { status, document_type, employee_id } = req.query;
        let sql = `
            SELECT ed.*, e.name as employee_name, s.name as section_name
            FROM employee_documents ed
            JOIN employees e ON ed.employee_id = e.id
            LEFT JOIN sections s ON e.section_id = s.id
            WHERE 1=1
        `;
        const params = [];
        if (status) {
            sql += ' AND ed.status = ?';
            params.push(status);
        }
        if (document_type) {
            sql += ' AND ed.document_type = ?';
            params.push(document_type);
        }
        if (employee_id) {
            sql += ' AND ed.employee_id = ?';
            params.push(employee_id);
        }
        sql += ' ORDER BY ed.created_at DESC';

        const docs = await dbAll(sql, params);
        res.json(docs);
    } catch (error) {
        console.error('Fetch admin docs error:', error);
        res.status(500).json({ message: 'خطأ في جلب المستندات' });
    }
});

// اعتماد أو رفض مستند من الإدارة
app.put('/api/admin/documents/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, admin_notes } = req.body;
        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'حالة غير صالحة' });
        }

        await dbRun(`
            UPDATE employee_documents
            SET status = ?, admin_notes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [status, admin_notes || '', id]);

        const doc = await dbGet('SELECT * FROM employee_documents WHERE id = ?', [id]);
        if (doc) {
            const statusLabel = status === 'approved' ? 'تم اعتماد' : 'تم رفض';
            await dbRun(`
                INSERT INTO sys_notifications (recipient_type, recipient_id, title, message, type)
                VALUES ('employee', ?, 'تحديث حالة مستند', ?, ?)
            `, [doc.employee_id, `${statusLabel} مستندك: "${doc.title}"${admin_notes ? ` (ملاحظة: ${admin_notes})` : ''}`, status === 'approved' ? 'success' : 'warning']);
        }

        res.json({ message: `تم تحديث حالة المستند إلى ${status === 'approved' ? 'معتمد' : 'مرفوض'}` });
    } catch (error) {
        console.error('Update doc status error:', error);
        res.status(500).json({ message: 'خطأ في تحديث المستند' });
    }
});

// حذف مستند
app.delete('/api/employee/documents/:id', async (req, res) => {
    try {
        const doc = await dbGet('SELECT * FROM employee_documents WHERE id = ?', [req.params.id]);
        if (doc) {
            const fullPath = path.join(__dirname, doc.file_path);
            if (fs.existsSync(fullPath)) {
                try { fs.unlinkSync(fullPath); } catch (e) {}
            }
            await dbRun('DELETE FROM employee_documents WHERE id = ?', [req.params.id]);
        }
        res.json({ message: 'تم حذف المستند بنجاح' });
    } catch (error) {
        console.error('Delete doc error:', error);
        res.status(500).json({ message: 'خطأ في حذف المستند' });
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
// 📅 جدول العمل الأسبوعي (Work Schedule)
// ==========================
app.get('/api/work-schedule', async (req, res) => {
    try {
        const schedule = await dbAll(`SELECT * FROM work_schedule ORDER BY id`);
        res.json(schedule);
    } catch (error) {
        console.error("Error fetching work schedule:", error);
        res.status(500).json({ message: "خطأ في جلب جدول الدوام" });
    }
});

app.post('/api/work-schedule', async (req, res) => {
    const { schedule } = req.body;
    if (!Array.isArray(schedule)) {
        return res.status(400).json({ message: "بيانات الجدول غير صالحة" });
    }
    try {
        for (const item of schedule) {
            await dbRun(`
                UPDATE work_schedule 
                SET start_time = ?, end_time = ?, is_closed = ?
                WHERE day_of_week = ?
            `, [item.start_time || '', item.end_time || '', item.is_closed ? 1 : 0, item.day_of_week]);
        }
        res.json({ message: "تم حفظ جدول الدوام بنجاح" });
    } catch (error) {
        console.error("Error saving work schedule:", error);
        res.status(500).json({ message: "خطأ في حفظ جدول الدوام" });
    }
});

// ==========================
// 🏗️ إدارة الرافعات (Workshop Lifts)
// ==========================
app.get('/api/lifts', async (req, res) => {
    try {
        const lifts = await dbAll(`
            SELECT l.*, e.name AS technician_name 
            FROM workshop_lifts l
            LEFT JOIN employees e ON l.technician_id = e.id
            ORDER BY l.id
        `);
        res.json(lifts);
    } catch (error) {
        console.error("Error fetching lifts:", error);
        res.status(500).json({ message: "خطأ في جلب بيانات الرافعات" });
    }
});

app.put('/api/lifts/:id', async (req, res) => {
    const { id } = req.params;
    const { status, technician_id, issue_description } = req.body;
    try {
        const existing = await dbGet(`SELECT * FROM workshop_lifts WHERE id = ?`, [id]);
        if (!existing) {
            return res.status(404).json({ message: "الرافعة غير موجودة" });
        }
        const newStatus = status !== undefined ? status : existing.status;
        const newTech = technician_id !== undefined ? technician_id : existing.technician_id;
        const newDesc = issue_description !== undefined ? issue_description : existing.issue_description;

        await dbRun(`UPDATE workshop_lifts SET status = ?, technician_id = ?, issue_description = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?`,
            [newStatus, newTech, newDesc, id]);
        res.json({ message: "تم تحديث الرافعة بنجاح" });
    } catch (error) {
        console.error("Error updating lift:", error);
        res.status(500).json({ message: "خطأ في تحديث الرافعة" });
    }
});

app.post('/api/lifts/:id/release', async (req, res) => {
    const { id } = req.params;
    try {
        await dbRun(`UPDATE workshop_lifts SET status = 'idle', technician_id = NULL, issue_description = NULL, last_updated = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
        res.json({ message: "تم إخلاء الرافعة بنجاح" });
    } catch (error) {
        console.error("Error releasing lift:", error);
        res.status(500).json({ message: "خطأ في إخلاء الرافعة" });
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

// ==========================
// 🧩 إعدادات النظام
// ==========================

// Terms & Conditions API
app.get('/api/terms', (req, res) => {
    res.json([
        { id: 1, term: "يتم دفع كامل المبلغ قبل استلام السيارة." },
        { id: 2, term: "في حالة احتياج لقطع الغيار يبلغ صاحبها بما يحتاج ويعطى مهلة خمسة أيام لتأمين القطع، وفي حالة تأخره عن تأمين القطع أو في حالة تم تجهيز السيارة ولم يستلمها العميل لأكثر من 3 أيام فإن المركز غير مسؤول عن أي مخالفات تصدر عليها." },
        { id: 3, term: "المركز لا يتحمل مسؤولية غير زيت الجيربوكس أو تزويد ((لا يوجد ضمان))." },
        { id: 4, term: "المركز غير مسؤول عن قطع التي تم تغييرها وتركها في المركز عن مدة تزيد عن 3 أيام." },
        { id: 5, term: "المركز غير مسؤول عن الأعطال التي تظهر والتي لم يتم الاتفاق على إصلاحها." },
        { id: 6, term: "المركز غير مسؤول عن كشف السيارة بعد 7 أيام من تاريخ الكشف." }
    ]);
});

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

// حذف رسالة محادثة
app.delete('/api/messages/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await dbRun(`DELETE FROM messages WHERE id = ?`, [id]);
        res.json({ success: true, message: "تم حذف الرسالة بنجاح 🗑️" });
    } catch (error) {
        console.error("Delete Message Error:", error);
        res.status(500).json({ message: "خطأ في حذف الرسالة" });
    }
});

// ==========================
// 🔔 نظام الإشعارات وسجل الطلبات
// ==========================
// جلب إشعارات وسجل طلبات الموظف كاملة مع تفاصيل الطباعة
app.get('/api/employee/:id/requests', async (req, res) => {
    const { id } = req.params;
    try {
        const withdrawals = await dbAll(`
            SELECT 
                'withdrawal' as type, 
                w.id, 
                w.amount, 
                w.reason, 
                w.status, 
                w.admin_note, 
                w.date, 
                w.created_at,
                e.name as employee_name,
                e.bank_name,
                s.name as section_name
            FROM withdrawals w
            JOIN employees e ON w.employee_id = e.id
            LEFT JOIN sections s ON e.section_id = s.id
            WHERE w.employee_id = ? 
            ORDER BY w.created_at DESC LIMIT 30
        `, [id]);

        const leaves = await dbAll(`
            SELECT 
                'leave' as type, 
                lr.id, 
                lr.leave_type as amount, 
                lr.leave_type, 
                lr.start_date, 
                lr.end_date, 
                lr.days_count, 
                lr.reason, 
                lr.status, 
                lr.admin_notes as admin_note, 
                lr.created_at,
                e.name as employee_name,
                s.name as section_name
            FROM leave_requests lr
            JOIN employees e ON lr.employee_id = e.id
            LEFT JOIN sections s ON e.section_id = s.id
            WHERE lr.employee_id = ? 
            ORDER BY lr.created_at DESC LIMIT 30
        `, [id]);
        
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
        paid_amount, remaining_amount, discount_code, discount_amount, discount_type, discount_value,
        status, car_status, job_order_notes, car_defects_diagram, technician_ids
    } = req.body;

    try {
        await dbRun('BEGIN TRANSACTION');

        let effectiveInspectorId = inspector_id || (req.body.inspector ? req.body.inspector.id : null);

        // التحقق من أن inspector_id موجود فعلاً في جدول الموظفين
        if (effectiveInspectorId) {
            const empCheck = await dbGet('SELECT id FROM employees WHERE id = ? AND is_active = 1', [effectiveInspectorId]);
            if (!empCheck) effectiveInspectorId = null;
        }
        // إذا لم يُحدد مفتش صالح، نأخذ أول موظف نشط في القاعدة
        if (!effectiveInspectorId) {
            const firstEmp = await dbGet('SELECT id FROM employees WHERE is_active = 1 ORDER BY id LIMIT 1');
            effectiveInspectorId = firstEmp ? firstEmp.id : null;
        }
        if (!effectiveInspectorId) {
            return res.status(400).json({ message: 'لا يوجد موظفون في النظام. الرجاء إضافة موظف واحد على الأقل قبل حفظ التسعيرة.' });
        }

        const inspResult = await dbRun(`
            INSERT INTO inspections (
                inspector_id, customer_name, customer_phone, car_type, car_color, car_model,
                plate_number, odometer, vin, total_amount, vat_amount, final_amount,
                paid_amount, remaining_amount, discount_code, discount_amount, discount_type, discount_value,
                status, car_status, job_order_notes, car_defects_diagram
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            discount_code || null,
            discount_amount || 0,
            discount_type || null,
            discount_value || 0,
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

        // تحديث عداد مرات استخدام كود الخصم
        if (discount_code) {
            await dbRun(`UPDATE promo_codes SET times_used = times_used + 1 WHERE UPPER(code) = UPPER(?)`, [discount_code]);
        }

        await dbRun('COMMIT');
        
        // مزامنة تلقائية لبيانات العميل في جدول العملاء
        if (customer_phone || customer_name) {
            upsertClient(customer_name, customer_phone).catch(e => console.error("upsertClient error:", e));
        }

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
        paid_amount, remaining_amount, discount_code, discount_amount, discount_type, discount_value,
        status, car_status, job_order_notes,
        car_defects_diagram, technician_ids
    } = req.body;

    try {
        await dbRun('BEGIN TRANSACTION');

        await dbRun(`
            UPDATE inspections 
            SET customer_name = ?, customer_phone = ?, car_type = ?, car_color = ?, car_model = ?, 
                plate_number = ?, odometer = ?, vin = ?, total_amount = ?, vat_amount = ?, final_amount = ?, 
                paid_amount = ?, remaining_amount = ?,
                discount_code = ?, discount_amount = ?, discount_type = ?, discount_value = ?,
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
            discount_code || null,
            discount_amount || 0,
            discount_type || null,
            discount_value || 0,
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
        
        // مزامنة تلقائية لبيانات العميل في جدول العملاء
        if (customer_phone || customer_name) {
            upsertClient(customer_name, customer_phone).catch(e => console.error("upsertClient error:", e));
        }

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

// حفظ ملاحظات أمر العمل
app.patch('/api/inspections/:id/notes', async (req, res) => {
    const { id } = req.params;
    const { notes } = req.body;
    try {
        await dbRun(`UPDATE inspections SET job_order_notes = ? WHERE id = ?`, [notes || '', id]);
        res.json({ message: "تم حفظ ملاحظات أمر العمل بنجاح" });
    } catch (error) {
        console.error("Error saving job order notes:", error);
        res.status(500).json({ message: "خطأ في حفظ الملاحظات" });
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
        if (error.code === 'SQLITE_CONSTRAINT' || error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
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
// 💾 مسارات النسخ الاحتياطي واستعادة قاعدة البيانات
// ==========================

// تحميل نسخة احتياطية بصيغة JSON
app.get('/api/backup/download-json', async (req, res) => {
    try {
        const backupData = await exportDatabaseJson();
        res.setHeader('Content-type', 'application/json; charset=utf-8');
        return res.json(backupData);
    } catch (err) {
        console.error("Backup JSON Download Error:", err);
        res.status(500).json({ error: "Could not download JSON backup: " + err.message });
    }
});

// تحميل نسخة احتياطية (ملف مباشر)
app.get('/api/backup', async (req, res) => {
    try {
        const date = new Date().toISOString().split('T')[0];
        if (isMySQL || req.query.format === 'json') {
            const backupData = await exportDatabaseJson();
            const backupJson = JSON.stringify(backupData, null, 2);
            res.setHeader('Content-disposition', `attachment; filename=backup_workshop_${date}.json`);
            res.setHeader('Content-type', 'application/json');
            return res.send(backupJson);
        } else {
            const currentDbPath = path.join(__dirname, 'db.sqlite');
            const filename = `backup_workshop_${date}.sqlite`;
            res.download(currentDbPath, filename, (err) => {
                if (err) {
                    console.error("Backup Download Error:", err);
                    res.status(500).send("Could not download backup");
                }
            });
        }
    } catch (err) {
        console.error("Backup Download Error:", err);
        res.status(500).send("Could not download backup: " + err.message);
    }
});

// رفع واستعادة نسخة احتياطية
const restoreUpload = multer({
    dest: 'uploads/',
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

const handleDbRestore = async (req, res) => {
    const file = req.file || (req.files && req.files[0]);
    if (!file) {
        return res.status(400).json({ message: "الرجاء اختيار ملف قاعدة البيانات (.json أو .sqlite أو .db)" });
    }

    const uploadedPath = file.path;
    try {
        // فحص ما إذا كان الملف المرفوع JSON
        let isJson = false;
        let jsonData = null;
        try {
            const fileContentSample = fs.readFileSync(uploadedPath, { encoding: 'utf8', flag: 'r' }).trim();
            if (fileContentSample.startsWith('{') && fileContentSample.endsWith('}')) {
                jsonData = JSON.parse(fileContentSample);
                isJson = Boolean(jsonData && jsonData.tables);
            }
        } catch (e) { }

        if (isJson) {
            console.log('🔄 جاري استعادة البيانات من ملف JSON...');
            await restoreDatabaseFromJson(jsonData);
            if (fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath);
            return res.json({
                success: true,
                message: "تمت استعادة قاعدة البيانات بنجاح من ملف JSON 🚀"
            });
        }

        // في حال كان ملف SQLite
        const buffer = Buffer.alloc(16);
        const fd = fs.openSync(uploadedPath, 'r');
        fs.readSync(fd, buffer, 0, 16, 0);
        fs.closeSync(fd);

        const headerStr = buffer.toString('utf8');
        if (!headerStr.startsWith('SQLite format 3')) {
            if (fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath);
            return res.status(400).json({ message: "الملف المرفوع ليس ملف قاعدة بيانات صالح (.json أو .sqlite)!" });
        }

        if (isMySQL) {
            console.log('🔄 جاري تحويل واستيراد ملف SQLite إلى قاعدة MySQL المدارة...');
            const sqlite3 = require('sqlite3').verbose();
            const srcDb = new sqlite3.Database(uploadedPath, sqlite3.OPEN_READONLY);
            const sqliteGetAll = (query) => new Promise((resolve, reject) => {
                srcDb.all(query, (err, rows) => err ? reject(err) : resolve(rows || []));
            });

            const tablesToTransfer = [
                'sections', 'banks', 'employees', 'users', 'settings', 'branch_shifts',
                'services', 'inspection_terms', 'inspection_bundles', 'inspection_bundle_items',
                'clients', 'inspections', 'inspection_items', 'inspection_technicians',
                'entries', 'withdrawals', 'absences', 'attendance', 'messages',
                'sys_notifications', 'inspection_photos', 'workshop_lifts', 'work_schedule', 'promo_codes'
            ];

            const { pool } = require('./db');
            if (pool) await pool.query('SET FOREIGN_KEY_CHECKS = 0');

            for (const tableName of tablesToTransfer) {
                try {
                    const tableExists = await sqliteGetAll(`SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`);
                    if (!tableExists || tableExists.length === 0) continue;

                    const rows = await sqliteGetAll(`SELECT * FROM ${tableName}`);
                    if (!rows || rows.length === 0) continue;

                    for (const row of rows) {
                        const keys = Object.keys(row);
                        const quotedKeys = keys.map(k => `\`${k}\``).join(', ');
                        const placeholders = keys.map(() => '?').join(', ');
                        const values = keys.map(k => row[k]);

                        await dbRun(`REPLACE INTO \`${tableName}\` (${quotedKeys}) VALUES (${placeholders})`, values);
                    }
                } catch (tblErr) {
                    console.warn(`⚠️ تعذر استيراد جدول ${tableName}:`, tblErr.message);
                }
            }

            if (pool) await pool.query('SET FOREIGN_KEY_CHECKS = 1');
            srcDb.close();
            if (fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath);

            return res.json({
                success: true,
                message: "تم استيراد كافة بيانات SQLite إلى قاعدة بيانات MySQL بنجاح 🚀"
            });
        } else {
            // بيئة SQLite المحلية
            const dbPath = path.join(__dirname, 'db.sqlite');
            if (fs.existsSync(dbPath)) {
                const safetyBackup = path.join(__dirname, `backup_auto_safety_${Date.now()}.sqlite`);
                try { fs.copyFileSync(dbPath, safetyBackup); } catch (be) { }
            }
            fs.copyFileSync(uploadedPath, dbPath);
            if (fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath);
            await initDatabase();

            return res.json({
                success: true,
                message: "تمت استعادة قاعدة بيانات SQLite المحلية بنجاح 🚀"
            });
        }
    } catch (error) {
        console.error("Restore DB Error:", error);
        if (fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath);
        res.status(500).json({ message: "حدث خطأ أثناء استعادة قاعدة البيانات: " + error.message });
    }
};

app.post('/api/backup/restore', restoreUpload.any(), handleDbRestore);
app.post('/api/backup/restore-file', restoreUpload.any(), handleDbRestore);

// ==========================
// 👥 إدارة واستيراد وتصدير العملاء (Clients Management)
// ==========================

// دالة مساعدة لحفظ أو تحديث العميل تلقائياً
async function upsertClient(name, phone, intl_phone = '', notes = '') {
    if (!name && !phone) return;
    try {
        const { phone: cleanPhone, intl_phone: autoIntl } = normalizePhone(phone, intl_phone);
        if (!cleanPhone && !name) return;

        let existing = null;
        if (cleanPhone) {
            existing = await dbGet(`SELECT id, name, phone FROM clients WHERE phone = ?`, [cleanPhone]);
        }
        if (!existing && name && name.trim()) {
            existing = await dbGet(`SELECT id, name, phone FROM clients WHERE name = ?`, [name.trim()]);
        }

        if (existing) {
            if (name && (!existing.name || existing.name.length < name.length || existing.name === 'عميل غير مسجل')) {
                await dbRun(`UPDATE clients SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [name.trim(), existing.id]);
            }
        } else {
            await dbRun(`INSERT INTO clients (name, phone, intl_phone, notes) VALUES (?, ?, ?, ?)`, 
                [name ? name.trim() : 'عميل غير مسجل', cleanPhone || '', autoIntl || '', notes || '']);
        }
    } catch (e) {
        console.error("Error in upsertClient:", e.message);
    }
}

// 1. البحث السريع الذكي للعملاء (بالرقم أو الاسم مع جلب آخر سيارة)
app.get('/api/clients/search', async (req, res) => {
    try {
        const query = String(req.query.q || '').trim();
        if (!query || query.length < 2) {
            return res.json([]);
        }

        const digitsOnly = query.replace(/\D/g, '');
        let rows = [];

        if (digitsOnly.length >= 2) {
            // البحث بالأرقام (يدعم البحث بالرقم المباشر أو بصفر البداية أو بالصيغة الدولية)
            const p1 = `%${digitsOnly}%`;
            const p2 = digitsOnly.startsWith('0') ? `%${digitsOnly.substring(1)}%` : `%0${digitsOnly}%`;
            rows = await dbAll(`
                SELECT id, name, phone, intl_phone, notes 
                FROM clients 
                WHERE phone LIKE ? OR phone LIKE ? OR intl_phone LIKE ? OR name LIKE ?
                ORDER BY 
                    CASE 
                        WHEN phone = ? THEN 1 
                        WHEN phone LIKE ? THEN 2
                        WHEN phone LIKE ? THEN 3
                        ELSE 4 
                    END
                LIMIT 15
            `, [p1, p2, p1, `%${query}%`, digitsOnly, `${digitsOnly}%`, p2]);
        } else {
            // البحث بالاسم مع دعم مرونة الهمزات (أ, إ, آ, ا)
            const normQuery = query.replace(/[أإآ]/g, 'ا');
            rows = await dbAll(`
                SELECT id, name, phone, intl_phone, notes 
                FROM clients 
                WHERE name LIKE ? OR name LIKE ?
                ORDER BY 
                    CASE 
                        WHEN name = ? THEN 1
                        WHEN name LIKE ? THEN 2
                        ELSE 3
                    END
                LIMIT 15
            `, [`%${query}%`, `%${normQuery}%`, query, `${query}%`]);
        }

        // إثراء النتائج بآخر سيارة مسجلة للعميل في الكشوفات السابقة إن وجدت
        const enriched = await Promise.all(rows.map(async (client) => {
            let lastCar = null;
            if (client.phone) {
                const phoneAlt = client.phone.startsWith('0') ? client.phone.substring(1) : ('0' + client.phone);
                lastCar = await dbGet(`
                    SELECT car_type, car_color, car_model, plate_number, odometer, vin 
                    FROM inspections 
                    WHERE (customer_phone = ? OR customer_phone = ?)
                      AND ((car_type IS NOT NULL AND car_type != '') OR (plate_number IS NOT NULL AND plate_number != ''))
                    ORDER BY id DESC 
                    LIMIT 1
                `, [client.phone, phoneAlt]);
            }
            return {
                id: client.id,
                name: client.name,
                phone: client.phone,
                intl_phone: client.intl_phone,
                notes: client.notes,
                last_car: lastCar || null
            };
        }));

        res.json(enriched);
    } catch (error) {
        console.error('Error searching clients:', error);
        res.status(500).json({ error: error.message });
    }
});

// 2. استعراض العملاء مع البحث والترقيم (Pagination)
app.get('/api/clients', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(10, parseInt(req.query.limit) || 25));
        const offset = (page - 1) * limit;
        const search = String(req.query.search || '').trim();

        let countSql = `SELECT COUNT(*) as total FROM clients`;
        let dataSql = `SELECT * FROM clients`;
        let params = [];

        if (search) {
            const digits = search.replace(/\D/g, '');
            if (digits.length >= 2) {
                const p1 = `%${digits}%`;
                const p2 = digits.startsWith('0') ? `%${digits.substring(1)}%` : `%0${digits}%`;
                countSql += ` WHERE phone LIKE ? OR phone LIKE ? OR intl_phone LIKE ? OR name LIKE ?`;
                dataSql += ` WHERE phone LIKE ? OR phone LIKE ? OR intl_phone LIKE ? OR name LIKE ?`;
                params = [p1, p2, p1, `%${search}%`];
            } else {
                countSql += ` WHERE name LIKE ?`;
                dataSql += ` WHERE name LIKE ?`;
                params = [`%${search}%`];
            }
        }

        dataSql += ` ORDER BY id DESC LIMIT ? OFFSET ?`;

        const countRow = await dbGet(countSql, params);
        const total = countRow ? countRow.total : 0;
        const clients = await dbAll(dataSql, [...params, limit, offset]);

        res.json({
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit) || 1,
            clients
        });
    } catch (error) {
        console.error("Error fetching clients:", error);
        res.status(500).json({ message: "خطأ في جلب بيانات العملاء: " + error.message });
    }
});

// 3. إضافة أو تعديل عميل يدوياً
app.post('/api/clients', async (req, res) => {
    try {
        const { id, name, phone, intl_phone, notes } = req.body;
        if (!name && !phone) {
            return res.status(400).json({ message: "يجب إدخال اسم العميل أو رقم الجوال." });
        }

        const { phone: cleanPhone, intl_phone: autoIntl } = normalizePhone(phone, intl_phone);

        if (id) {
            await dbRun(`
                UPDATE clients 
                SET name = ?, phone = ?, intl_phone = ?, notes = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `, [name ? name.trim() : 'عميل غير مسجل', cleanPhone || '', autoIntl || '', notes || '', id]);
            res.json({ success: true, message: "تم تحديث بيانات العميل بنجاح." });
        } else {
            const result = await dbRun(`
                INSERT INTO clients (name, phone, intl_phone, notes)
                VALUES (?, ?, ?, ?)
            `, [name ? name.trim() : 'عميل غير مسجل', cleanPhone || '', autoIntl || '', notes || '']);
            res.status(201).json({ success: true, message: "تمت إضافة العميل بنجاح.", id: result.lastID });
        }
    } catch (error) {
        console.error("Error saving client:", error);
        res.status(500).json({ message: "خطأ في حفظ العميل: " + error.message });
    }
});

// 4. حذف عميل
app.delete('/api/clients/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await dbRun(`DELETE FROM clients WHERE id = ?`, [id]);
        res.json({ success: true, message: "تم حذف العميل بنجاح." });
    } catch (error) {
        console.error("Error deleting client:", error);
        res.status(500).json({ message: "خطأ في حذف العميل: " + error.message });
    }
});

// 5. استيراد الملف الافتراضي CLIENTS NO.xls
app.post('/api/clients/import-default', async (req, res) => {
    try {
        const defaultPath = path.join(__dirname, 'CLIENTS NO.xls');
        if (!fs.existsSync(defaultPath)) {
            return res.status(404).json({ message: "ملف CLIENTS NO.xls غير موجود في المجلد الرئيسي." });
        }

        const result = await importClients(defaultPath);
        res.json({
            success: true,
            message: `تم استيراد ${result.importedCount} عميل بنجاح من أصل ${result.totalRows} سجل.`,
            details: result
        });
    } catch (error) {
        console.error("Error importing default clients:", error);
        res.status(500).json({ message: "خطأ في استيراد ملف العملاء: " + error.message });
    }
});

// 6. استيراد ملف Excel خارجي (.xls أو .xlsx)
app.post('/api/clients/import', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: "الرجاء اختيار ملف Excel صالح (.xls أو .xlsx)." });
    }

    const filePath = req.file.path;
    try {
        const result = await importClients(filePath);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.json({
            success: true,
            message: `تم استيراد ${result.importedCount} عميل بنجاح من أصل ${result.totalRows} سجل في الملف.`,
            details: result
        });
    } catch (error) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        console.error("Error importing uploaded clients file:", error);
        res.status(500).json({ message: "فشل استيراد الملف: " + error.message });
    }
});

// 7. تصدير قاعدة بيانات العملاء إلى ملف Excel
app.get('/api/clients/export', async (req, res) => {
    try {
        const rows = await dbAll(`SELECT name, phone, intl_phone, notes, created_at FROM clients ORDER BY id ASC`);
        
        const wb = xlsx.utils.book_new();
        const exportData = rows.map(r => ({
            'اسم العميل': r.name,
            'رقم الجوال': r.phone,
            'الرقم بالصيغة الدوليه': r.intl_phone || '',
            'تاريخ التسجيل': r.created_at || '',
            'ملاحظات': r.notes || ''
        }));

        const ws = xlsx.utils.json_to_sheet(exportData);
        xlsx.utils.book_append_sheet(wb, ws, 'QR_Transfer_Mobile');

        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        
        const timestamp = new Date().toISOString().slice(0, 10);
        res.setHeader('Content-Disposition', `attachment; filename="CLIENTS_${timestamp}.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (error) {
        console.error("Error exporting clients:", error);
        res.status(500).json({ message: "خطأ في تصدير ملف العملاء: " + error.message });
    }
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
// 📊 استيراد وتحديث الرواتب والموظفين من Excel (ذكي)
// ==========================
app.post('/api/employees/import-salaries', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: "الرجاء اختيار ملف Excel." });
    const filePath = req.file.path;
    try {
        const result = await handleSmartEmployeeImport(filePath);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.json(result);
    } catch (error) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.status(500).json({ success: false, message: "خطأ: " + error.message });
    }
});

// ==========================================
// 🏷️ إدارة أكواد الخصم والتسويق (PROMO CODES & MARKETING)
// ==========================================

// دالة مساعدة لتحديد الأقسام والبنود المستثناة من الخصم (مخرطة وأخرى / قطع غيار)
function isDiscountExemptCategory(category) {
    if (!category) return false;
    const cat = String(category).trim().toLowerCase();
    return cat.includes('مخرطة') || cat.includes('أخرى') || cat.includes('قطع غيار') || cat.includes('قطع');
}

// 1. جلب كافة أكواد الخصم
app.get('/api/promo-codes', async (req, res) => {
    try {
        const codes = await dbAll(`
            SELECT * FROM promo_codes 
            ORDER BY id DESC
        `);
        res.json(codes);
    } catch (error) {
        console.error("Fetch Promo Codes Error:", error);
        res.status(500).json({ message: "خطأ في جلب أكواد الخصم: " + error.message });
    }
});

// 2. إضافة كود خصم جديد
app.post('/api/promo-codes', async (req, res) => {
    const {
        code, discount_type, discount_value, min_order_amount,
        max_discount_amount, usage_limit, is_active, start_date,
        end_date, description
    } = req.body;

    if (!code || !code.trim()) {
        return res.status(400).json({ message: "رمز كود الخصم مطلوب" });
    }

    const cleanCode = code.trim().toUpperCase();
    const type = discount_type === 'fixed' ? 'fixed' : 'percentage';
    const value = parseFloat(discount_value) || 0;

    if (value <= 0) {
        return res.status(400).json({ message: "قيمة الخصم يجب أن تكون أكبر من الصفر" });
    }

    if (type === 'percentage' && (value <= 0 || value > 100)) {
        return res.status(400).json({ message: "نسبة الخصم يجب أن تكون بين 1% و 100%" });
    }

    try {
        // التحقق من عدم تكرار الكود
        const existing = await dbGet('SELECT id FROM promo_codes WHERE UPPER(code) = ?', [cleanCode]);
        if (existing) {
            return res.status(400).json({ message: `كود الخصم (${cleanCode}) مسجل مسبقاً` });
        }

        const result = await dbRun(`
            INSERT INTO promo_codes (
                code, discount_type, discount_value, min_order_amount,
                max_discount_amount, usage_limit, times_used, is_active,
                start_date, end_date, description
            )
            VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
        `, [
            cleanCode,
            type,
            value,
            parseFloat(min_order_amount) || 0,
            max_discount_amount ? parseFloat(max_discount_amount) : null,
            usage_limit ? parseInt(usage_limit) : null,
            is_active !== undefined ? (is_active ? 1 : 0) : 1,
            start_date || null,
            end_date || null,
            description || ''
        ]);

        res.status(201).json({ 
            message: "تم إنشاء كود الخصم بنجاح 🎉", 
            id: result.lastID,
            code: cleanCode 
        });
    } catch (error) {
        console.error("Create Promo Code Error:", error);
        res.status(500).json({ message: "خطأ في إنشاء كود الخصم: " + error.message });
    }
});

// 3. تعديل كود خصم
app.put('/api/promo-codes/:id', async (req, res) => {
    const { id } = req.params;
    const {
        code, discount_type, discount_value, min_order_amount,
        max_discount_amount, usage_limit, is_active, start_date,
        end_date, description
    } = req.body;

    if (!code || !code.trim()) {
        return res.status(400).json({ message: "رمز كود الخصم مطلوب" });
    }

    const cleanCode = code.trim().toUpperCase();
    const type = discount_type === 'fixed' ? 'fixed' : 'percentage';
    const value = parseFloat(discount_value) || 0;

    if (value <= 0) {
        return res.status(400).json({ message: "قيمة الخصم يجب أن تكون أكبر من الصفر" });
    }

    if (type === 'percentage' && (value <= 0 || value > 100)) {
        return res.status(400).json({ message: "نسبة الخصم يجب أن تكون بين 1% و 100%" });
    }

    try {
        // التحقق من عدم التكرار مع كود آخر
        const existing = await dbGet('SELECT id FROM promo_codes WHERE UPPER(code) = ? AND id != ?', [cleanCode, id]);
        if (existing) {
            return res.status(400).json({ message: `كود الخصم (${cleanCode}) مستخدم لكود آخر` });
        }

        await dbRun(`
            UPDATE promo_codes
            SET code = ?,
                discount_type = ?,
                discount_value = ?,
                min_order_amount = ?,
                max_discount_amount = ?,
                usage_limit = ?,
                is_active = ?,
                start_date = ?,
                end_date = ?,
                description = ?
            WHERE id = ?
        `, [
            cleanCode,
            type,
            value,
            parseFloat(min_order_amount) || 0,
            max_discount_amount ? parseFloat(max_discount_amount) : null,
            usage_limit ? parseInt(usage_limit) : null,
            is_active ? 1 : 0,
            start_date || null,
            end_date || null,
            description || '',
            id
        ]);

        res.json({ message: "تم تحديث كود الخصم بنجاح ✅" });
    } catch (error) {
        console.error("Update Promo Code Error:", error);
        res.status(500).json({ message: "خطأ في تعديل كود الخصم: " + error.message });
    }
});

// 4. تفعيل / تعطيل كود الخصم
app.patch('/api/promo-codes/:id/toggle', async (req, res) => {
    const { id } = req.params;
    try {
        const promo = await dbGet('SELECT is_active FROM promo_codes WHERE id = ?', [id]);
        if (!promo) return res.status(404).json({ message: "كود الخصم غير موجود" });

        const newState = promo.is_active ? 0 : 1;
        await dbRun('UPDATE promo_codes SET is_active = ? WHERE id = ?', [newState, id]);

        res.json({ message: newState ? "تم تفعيل كود الخصم 🟢" : "تم تعطيل كود الخصم 🔴", is_active: newState });
    } catch (error) {
        console.error("Toggle Promo Code Error:", error);
        res.status(500).json({ message: "خطأ في تغيير حالة الكود: " + error.message });
    }
});

// 5. حذف كود خصم
app.delete('/api/promo-codes/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await dbRun('DELETE FROM promo_codes WHERE id = ?', [id]);
        res.json({ message: "تم حذف كود الخصم بنجاح 🗑️" });
    } catch (error) {
        console.error("Delete Promo Code Error:", error);
        res.status(500).json({ message: "خطأ في حذف كود الخصم: " + error.message });
    }
});

// 6. فحص وتطبيق كود الخصم (مع استثناء أقسام المخرطة وأخرى/قطع غيار)
app.post('/api/promo-codes/validate', async (req, res) => {
    try {
        const { code, items } = req.body;
        if (!code || typeof code !== 'string') {
            return res.status(400).json({ valid: false, message: 'الرجاء إدخال كود الخصم' });
        }

        const cleanCode = code.trim().toUpperCase();
        const promo = await dbGet('SELECT * FROM promo_codes WHERE UPPER(code) = ?', [cleanCode]);

        if (!promo) {
            return res.status(404).json({ valid: false, message: `كود الخصم (${cleanCode}) غير صحيح أو غير موجود` });
        }

        if (!promo.is_active) {
            return res.status(400).json({ valid: false, message: 'كود الخصم غير مفعّل حالياً' });
        }

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        if (promo.start_date && promo.start_date > todayStr) {
            return res.status(400).json({ valid: false, message: `كود الخصم لم يبدأ تفعيله بعد (يبدأ في ${promo.start_date})` });
        }

        if (promo.end_date && promo.end_date < todayStr) {
            return res.status(400).json({ valid: false, message: `عذراً، كود الخصم انتهت صلاحيته في (${promo.end_date})` });
        }

        if (promo.usage_limit !== null && promo.usage_limit !== undefined && promo.usage_limit > 0) {
            if (promo.times_used >= promo.usage_limit) {
                return res.status(400).json({ valid: false, message: 'تم استنفاد الحد الأقصى لمرات استخدام هذا الكود' });
            }
        }

        // احتساب المبالغ الخاضعة للخصم والمستثناة (مخرطة وأخرى / قطع غيار)
        let rawSubtotal = 0;
        let eligibleSubtotal = 0;
        let exemptSubtotal = 0;
        let exemptItemsCount = 0;
        const itemsList = Array.isArray(items) ? items : [];

        itemsList.forEach(item => {
            const price = parseFloat(item.price) || 0;
            const qty = parseFloat(item.quantity) || 1;
            const rowTotal = parseFloat(item.total) || (price * qty);
            rawSubtotal += rowTotal;

            if (isDiscountExemptCategory(item.category)) {
                exemptSubtotal += rowTotal;
                exemptItemsCount++;
            } else {
                eligibleSubtotal += rowTotal;
            }
        });

        if (promo.min_order_amount && rawSubtotal < promo.min_order_amount) {
            return res.status(400).json({ 
                valid: false, 
                message: `الحد الأدنى لقيمة الفاتورة لتطبيق هذا الكود هو ${promo.min_order_amount} ﷼ (الإجمالي الحالي: ${rawSubtotal.toFixed(2)} ﷼)` 
            });
        }

        if (eligibleSubtotal <= 0) {
            return res.status(400).json({
                valid: false,
                message: 'لا توجد خدمات خاضعة للخصم (الخصم لا يشمل بنود المخرطة وقطع الغيار)'
            });
        }

        let discountAmount = 0;
        if (promo.discount_type === 'percentage') {
            discountAmount = +(eligibleSubtotal * (promo.discount_value / 100)).toFixed(2);
            if (promo.max_discount_amount && discountAmount > promo.max_discount_amount) {
                discountAmount = promo.max_discount_amount;
            }
        } else {
            // Fixed amount discount
            discountAmount = Math.min(eligibleSubtotal, promo.discount_value);
        }

        discountAmount = +discountAmount.toFixed(2);
        const subtotalAfterDiscount = +(Math.max(0, rawSubtotal - discountAmount)).toFixed(2);
        const vatAmount = +(subtotalAfterDiscount * 0.15).toFixed(2);
        const finalAmount = +(subtotalAfterDiscount + vatAmount).toFixed(2);

        res.json({
            valid: true,
            code: promo.code,
            description: promo.description || '',
            discount_type: promo.discount_type,
            discount_value: promo.discount_value,
            raw_subtotal: rawSubtotal,
            eligible_subtotal: eligibleSubtotal,
            exempt_subtotal: exemptSubtotal,
            exempt_items_count: exemptItemsCount,
            discount_amount: discountAmount,
            subtotal_after_discount: subtotalAfterDiscount,
            vat_amount: vatAmount,
            final_amount: finalAmount,
            message: `تم تطبيق كود (${promo.code}) بنجاح! خصم: ${promo.discount_type === 'percentage' ? promo.discount_value + '%' : promo.discount_value + ' ﷼'} ${exemptSubtotal > 0 ? `(تم استثناء ${exemptSubtotal.toFixed(2)} ﷼ مخرطة/قطع)` : ''}`
        });

    } catch (error) {
        console.error('Validate Promo Code Error:', error);
        res.status(500).json({ valid: false, message: 'خطأ في فحص كود الخصم: ' + error.message });
    }
});
