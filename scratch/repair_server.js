const fs = require('fs');

const serverFile = 'server.js';
let content = fs.readFileSync(serverFile, 'utf8');

// Section 1: Fix initializeDatabase after tables.forEach
const splitPointStart = content.indexOf('const defaultSettings = [');
const splitPointEnd = content.indexOf("// حذف/تعطيل موظف (Soft Delete)");

if (splitPointStart !== -1 && splitPointEnd !== -1) {
    const head = content.substring(0, splitPointStart);
    const tail = content.substring(splitPointEnd);
    
    const repairInit = `const defaultSettings = [
            ['workshop_name', 'مركز الورشة المتخصص'],
            ['workshop_desc', 'صيانة سيارات - سمكرة - دهان'],
            ['workshop_phone', '0500000000'],
            ['vat_number', '300000000000003'],
            ['show_logo', 'true']
        ];
        defaultSettings.forEach(([key, val]) => {
             db.run(\`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)\`, [key, val]);
        });

        const migrations = [
            "ALTER TABLE inspections ADD COLUMN status TEXT DEFAULT 'new'",
            "ALTER TABLE inspections ADD COLUMN assigned_technician_id INTEGER",
            "ALTER TABLE inspections ADD COLUMN job_order_notes TEXT",
            "ALTER TABLE inspections ADD COLUMN car_defects_diagram TEXT"
        ];
        migrations.forEach(sql => {
            db.run(sql, (err) => {
                if (err && !err.message.includes('duplicate column name')) console.log(\`ℹ️ Migration: \${err.message}\`);
            });
        });

        db.run(\`INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)\`,
            ['admin', 'admin123', 'admin']
        );

        const defaultSections = ['مكانيكا', 'كهرباء', 'كشف', 'ادارة'];
        defaultSections.forEach(sectionName => {
            db.run(\`INSERT OR IGNORE INTO sections (name) VALUES (?)\`, [sectionName]);
        });

        const lifts = ['A', 'B', 'C', 'D', 'E'];
        lifts.forEach(id => {
            db.run(\`INSERT OR IGNORE INTO workshop_lifts (id, name) VALUES (?, ?)\`, [id, \`رافعة \${id}\`]);
        });

        const defaultServices = {
            "نظام التعليق الامامي": [
                { "service": "غيار أقمشة أمامية + مسح هوبات (مخرطة)", "price": 100 },
                { "service": "غيار مساعدات أمامية + كراسي مساعدات", "price": 200 }
            ],
            "كهرباء وتكييف": [
                { "service": "تحديث المحرك PCM", "price": 300 }
            ]
        };

        db.get("SELECT COUNT(*) as count FROM services", (err, row) => {
            if (row && row.count === 0) {
                Object.keys(defaultServices).forEach(cat => {
                    defaultServices[cat].forEach(s => {
                        db.run("INSERT INTO services (category, service_name, price) VALUES (?, ?, ?)", [cat, s.service, s.price]);
                    });
                });
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
        const user = await dbGet(\`
            SELECT u.*, e.name AS employee_name, e.id AS employee_id, e.section_id
            FROM users u
            LEFT JOIN employees e ON u.employee_id = e.id
            WHERE u.username = ? AND u.password = ?
        \`, [username, password]);

        if (user) {
            delete user.password;
            return res.json({ message: "تم تسجيل الدخول بنجاح", ...user });
        }
        res.status(401).json({ message: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    } catch (error) { res.status(500).json({ message: "خطأ في الخادم" }); }
});

// ==========================
// 👥 إدارة الموظفين (Admin)
// ==========================

app.post('/api/employees', async (req, res) => {
    const { name, section_id, target, base_salary, username, password, hide_income, bank_type } = req.body;
    if (!name || !section_id || !target || !username || !password) {
        return res.status(400).json({ message: "الرجاء إدخال جميع البيانات المطلوبة." });
    }
    try {
        const empResult = await dbRun(\`INSERT INTO employees (name, section_id, target, base_salary, hide_income, bank_type) VALUES (?, ?, ?, ?, ?, ?)\`, 
            [name, section_id, target, base_salary || 0, hide_income || 0, bank_type || '-']);
        const employee_id = empResult.lastID;
        await dbRun(\`INSERT INTO users (employee_id, username, password, role) VALUES (?, ?, ?, 'employee')\`, [employee_id, username, password]);
        res.status(201).json({ message: "تمت إضافة الموظف بنجاح", id: employee_id });
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT') return res.status(409).json({ message: "اسم المستخدم موجود بالفعل." });
        res.status(500).json({ message: "خطأ في إضافة الموظف" });
    }
});

app.put('/api/employees/:id', async (req, res) => {
    const { id } = req.params;
    const { 
        name, section_id, target, base_salary, username, password, hide_income, bank_type,
        new_income, target_amount, deposit_amount, total_withdrawals, net_remaining 
    } = req.body;

    try {
        await dbRun(\`UPDATE employees SET 
            name = ?, section_id = ?, target = ?, base_salary = ?, hide_income = ?, bank_type = ?,
            target_amount = ?, deposit_amount = ?, total_withdrawals = ?, net_remaining = ?, remaining_salary = ?
            WHERE id = ?\`, 
            [name, section_id, target, base_salary, hide_income || 0, bank_type || '-', 
             target_amount || 0, deposit_amount || 0, total_withdrawals || 0, net_remaining || 0, net_remaining || 0, id]);

        if (new_income !== null && new_income !== undefined && new_income !== '') {
            await dbRun("DELETE FROM entries WHERE employee_id = ?", [id]);
            await dbRun("INSERT INTO entries (employee_id, section_id, income, details) VALUES (?, ?, ?, ?)", 
                [id, section_id, new_income, 'تحديث يدوي للدخل']);
        }

        const userCheck = await dbGet('SELECT id FROM users WHERE employee_id = ?', [id]);
        if (userCheck) await dbRun(\`UPDATE users SET username = ?, password = ? WHERE employee_id = ?\`, [username, password, id]);

        res.json({ message: "تم تحديث بيانات الموظف بنجاح" });
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT') return res.status(409).json({ message: "اسم المستخدم موجود بالفعل." });
        res.status(500).json({ message: "خطأ في تحديث بيانات الموظف" });
    }
});
`;
    
    fs.writeFileSync(serverFile, head + repairInit + tail);
    console.log('Server repaired and updated successfully.');
} else {
    console.log('Could not find split points.');
}
