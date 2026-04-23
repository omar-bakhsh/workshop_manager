const http = require('http');

function req(path, method = 'GET') {
    return new Promise((resolve) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };
        const req = http.request(options, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        req.on('error', e => resolve({ error: e }));
        req.end();
    });
}

async function test() {
    console.log("Testing GET /api/inspections (List)...");
    const list = await req('/api/inspections');
    console.log("List Status:", list.status);
    if(list.status !== 200) console.log("List Body:", list.data);

    console.log("\nTesting GET /api/inspections/1 (Detail)...");
    const detail = await req('/api/inspections/1');
    console.log("Detail Status:", detail.status);
    console.log("Detail Body:", detail.data);
}

test();
