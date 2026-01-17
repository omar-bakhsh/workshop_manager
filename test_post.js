const http = require('http');

const data = JSON.stringify({
    employee_id: 5,
    amount: 100,
    reason: "Manual Test Request"
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/withdrawals',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    res.on('data', (d) => {
        process.stdout.write(d);
    });
});

req.on('error', (error) => {
    console.error(error);
});

req.write(data);
req.end();
