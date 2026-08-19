const express = require('express');
const router = express.Router();
const { dbRun, dbAll, dbGet } = require('../db');

// Add Entry (Income)
router.post('/entries', async (req, res) => {
    const { employee_id, section_id, income, details } = req.body;
    try {
        await dbRun(`INSERT INTO entries (employee_id, section_id, income, details) VALUES (?, ?, ?, ?)`,
            [employee_id, section_id, income, details]);
        res.status(201).json({ message: "تم تسجيل الدخل بنجاح" });
    } catch (error) {
        res.status(500).json({ message: "خطأ في تسجيل الدخل" });
    }
});

// Add Withdrawal
router.post('/withdrawals', async (req, res) => {
    const { employee_id, amount, reason, status } = req.body;
    try {
        await dbRun(`INSERT INTO withdrawals (employee_id, amount, reason, status) VALUES (?, ?, ?, ?)`,
            [employee_id, amount, reason, status || 'pending']);
        res.status(201).json({ message: "تم تسجيل السحب بنجاح" });
    } catch (error) {
        res.status(500).json({ message: "خطأ في تسجيل السحب" });
    }
});

// Leave Requests
router.post('/leave-requests', async (req, res) => {
    const { employee_id, leave_type, start_date, end_date, days_count, reason } = req.body;
    try {
        await dbRun(`INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, days_count, reason) VALUES (?, ?, ?, ?, ?, ?)`,
            [employee_id, leave_type, start_date, end_date, days_count, reason]);
        res.status(201).json({ message: "تم إرسال طلب الإجازة" });
    } catch (error) {
        res.status(500).json({ message: "خطأ في إرسال الطلب" });
    }
});

// Update Leave Status
router.put('/leave-requests/:id', async (req, res) => {
    const { id } = req.params;
    const { status, admin_notes } = req.body;
    try {
        await dbRun(`UPDATE leave_requests SET status = ?, admin_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [status, admin_notes, id]);
        res.json({ message: "تم تحديث حالة الطلب" });
    } catch (error) {
        res.status(500).json({ message: "خطأ في التحديث" });
    }
});

module.exports = router;
