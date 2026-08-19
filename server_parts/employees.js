const express = require('express');
const router = express.Router();
const { dbRun, dbAll, dbGet } = require('../db');

// Add new employee
router.post('/', async (req, res) => {
    const { name, section_id, target, base_salary, username, password, hide_income, bank_name } = req.body;
    if (!name || !section_id || !target || !username || !password) {
        return res.status(400).json({ message: "البيانات ناقصة." });
    }
    try {
        const empResult = await dbRun(`INSERT INTO employees (name, section_id, target, base_salary, hide_income, bank_name) VALUES (?, ?, ?, ?, ?, ?)`, 
            [name, section_id, target, base_salary || 0, hide_income || 0, bank_name || 'كاش']);
        const employee_id = empResult.lastID;
        await dbRun(`INSERT INTO users (employee_id, username, password, role) VALUES (?, ?, ?, 'employee')`, [employee_id, username, password]);
        res.status(201).json({ message: "تمت إضافة الموظف بنجاح", id: employee_id });
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT') return res.status(409).json({ message: "اسم المستخدم موجود بالفعل." });
        res.status(500).json({ message: "خطأ في إضافة الموظف" });
    }
});

// Update employee
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { name, section_id, target, base_salary, username, password, hide_income, bank_name } = req.body;
    try {
        await dbRun(`UPDATE employees SET name = ?, section_id = ?, target = ?, base_salary = ?, hide_income = ?, bank_name = ? WHERE id = ?`, 
            [name, section_id, target, base_salary, hide_income || 0, bank_name || 'كاش', id]);
        const userCheck = await dbGet('SELECT id FROM users WHERE employee_id = ?', [id]);
        if (userCheck) await dbRun(`UPDATE users SET username = ?, password = ? WHERE employee_id = ?`, [username, password, id]);
        res.json({ message: "تم تحديث بيانات الموظف بنجاح" });
    } catch (error) {
        res.status(500).json({ message: "خطأ في تحديث بيانات الموظف" });
    }
});

// Delete employee
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await dbRun(`DELETE FROM entries WHERE employee_id = ?`, [id]);
        await dbRun(`DELETE FROM withdrawals WHERE employee_id = ?`, [id]);
        await dbRun(`DELETE FROM absences WHERE employee_id = ?`, [id]);
        await dbRun(`DELETE FROM users WHERE employee_id = ?`, [id]);
        await dbRun(`DELETE FROM employees WHERE id = ?`, [id]);
        res.json({ message: "تم حذف الموظف وجميع بياناته بنجاح" });
    } catch (error) {
        res.status(500).json({ message: "خطأ في حذف الموظف" });
    }
});

// Get all employees
router.get('/', async (req, res) => {
    try {
        const employees = await dbAll(`
            SELECT e.*, s.name AS section_name, u.username, u.password,
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
        res.status(500).json({ message: "خطأ في جلب بيانات الموظفين" });
    }
});

module.exports = router;
