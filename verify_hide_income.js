const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

async function runVerification() {
    try {
        console.log("🚀 Starting Verification...");

        // 1. Create a new employee with hide_income = 1
        console.log("1️⃣ Creating employee with hide_income = 1...");
        const newEmp = {
            name: "Test Hidden Income",
            section_id: 1,
            target: 5000,
            username: "hidden_user_" + Math.floor(Math.random() * 1000),
            password: "password123",
            hide_income: 1
        };

        let response = await axios.post(`${BASE_URL}/employees`, newEmp);
        const empId = response.data.id;
        console.log(`✅ Employee created with ID: ${empId}`);

        // 2. Check stats - should be hidden
        console.log("2️⃣ Checking stats (expecting hidden)...");
        response = await axios.get(`${BASE_URL}/employee-stats/${empId}`);
        const statsHidden = response.data;

        if (statsHidden.income_hidden === true && statsHidden.total_income === -1 && statsHidden.entries.length === 0) {
            console.log("✅ Income is correctly hidden.");
        } else {
            console.error("❌ Income failed to hide:", statsHidden);
        }

        // 3. Update employee to hide_income = 0
        console.log("3️⃣ Updating employee to hide_income = 0...");
        await axios.put(`${BASE_URL}/employees/${empId}`, {
            ...newEmp,
            hide_income: 0
        });
        console.log("✅ Employee updated.");

        // 4. Check stats - should be visible
        console.log("4️⃣ Checking stats (expecting visible)...");
        response = await axios.get(`${BASE_URL}/employee-stats/${empId}`);
        const statsVisible = response.data;

        if (statsVisible.income_hidden === false && statsVisible.total_income !== -1) {
            console.log("✅ Income is correctly visible.");
        } else {
            console.error("❌ Income failed to show:", statsVisible);
        }

        // Cleanup
        console.log("🧹 Cleaning up...");
        await axios.delete(`${BASE_URL}/employees/${empId}`);
        console.log("✅ Test employee deleted.");

        console.log("🎉 Verification Complete!");

    } catch (error) {
        console.error("❌ Verification Failed:", error.response ? error.response.data : error.message);
    }
}

runVerification();
