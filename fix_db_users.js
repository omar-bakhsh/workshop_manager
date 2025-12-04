const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log("🚀 Starting Database Cleanup...");

    // 1. Delete users linked to inactive employees
    db.run(`DELETE FROM users WHERE employee_id IN (SELECT id FROM employees WHERE is_active = 0)`, function (err) {
        if (err) console.error("Error deleting users:", err);
        else console.log(`✅ Deleted ${this.changes} users linked to inactive employees.`);
    });

    // 2. Delete inactive employees
    db.run(`DELETE FROM employees WHERE is_active = 0`, function (err) {
        if (err) console.error("Error deleting employees:", err);
        else console.log(`✅ Deleted ${this.changes} inactive employees.`);
    });

    // 3. Delete orphan users (users with employee_id that doesn't exist in employees table)
    // Note: We need to be careful not to delete the admin user which might have null employee_id or a special one.
    // Based on schema, admin user has employee_id = NULL usually, or we should check role.
    // Let's only delete users with role='employee' that have an invalid employee_id
    db.run(`DELETE FROM users WHERE role = 'employee' AND employee_id NOT IN (SELECT id FROM employees)`, function (err) {
        if (err) console.error("Error deleting orphan users:", err);
        else console.log(`✅ Deleted ${this.changes} orphan users.`);
    });

    // 4. Delete orphan data in other tables if any (just in case)
    const tables = ['entries', 'withdrawals', 'absences'];
    tables.forEach(table => {
        db.run(`DELETE FROM ${table} WHERE employee_id NOT IN (SELECT id FROM employees)`, function (err) {
            if (err) console.error(`Error deleting orphan ${table}:`, err);
            else if (this.changes > 0) console.log(`✅ Deleted ${this.changes} orphan records from ${table}.`);
        });
    });

});

db.close(() => {
    console.log("🏁 Cleanup finished.");
});
