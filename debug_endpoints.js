const http = require('http');

function makeRequest(path, method, body = null) {
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: path,
        method: method,
        headers: {
            'Content-Type': 'application/json'
        }
    };

    const req = http.request(options, (res) => {
        console.log(`\n--- ${method} ${path} ---`);
        console.log(`STATUS: ${res.statusCode}`);
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            console.log(`BODY: ${data}`);
        });
    });

    req.on('error', (e) => {
        console.error(`problem with request: ${e.message}`);
    });

    if (body) {
        req.write(JSON.stringify(body));
    }
    req.end();
}

// Test Employee Stats (assuming employee ID 1 exists)
makeRequest('/api/employee-stats/1', 'GET');

// Test Batch Withdrawal
makeRequest('/api/withdrawals/batch', 'POST', {
    employee_ids: [1],
    amount: 500,
    reason: "Debug Test",
    date: "2023-11-22"
});

// Test Sections Summary
makeRequest('/api/sections-summary', 'GET');
