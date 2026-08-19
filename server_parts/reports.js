const express = require('express');
const router = express.Router();
const { dbAll, dbGet } = require('../db');

// Withdrawal List for Printing
router.get('/withdrawal-list', async (req, res) => {
    try {
        const employees = await dbAll(`
            SELECT 
                e.name, e.bank_name, e.net_remaining,
                ((e.base_salary + e.target_amount) - (e.total_withdrawals + e.deposit_amount)) AS remaining_salary
            FROM employees e
            WHERE e.is_active = 1
            ORDER BY e.bank_name, e.name
        `);
        const settings = await dbAll(`SELECT * FROM settings WHERE key = 'max_withdrawal_limit'`);
        const maxLimit = settings.length > 0 ? settings[0].value : '500';
        res.json({ employees, maxWithdrawalLimit: maxLimit });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching report' });
    }
});

// Settings Management
router.get('/settings', async (req, res) => {
    try {
        const settings = await dbAll(`SELECT * FROM settings`);
        const settingsObj = {};
        settings.forEach(s => settingsObj[s.key] = s.value);
        res.json(settingsObj);
    } catch (e) { res.status(500).send(e.message); }
});

module.exports = router;
