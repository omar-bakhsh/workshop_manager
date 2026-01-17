const fs = require('fs');
const http = require('http');
const xlsx = require('xlsx');
const path = require('path');

// 1. Create a sample Excel file
const wb = xlsx.utils.book_new();
const data = [
    { "اسم الموظف": "wesam", "الراتب الأساسي": 5000, "سلف/سحب": 200 }, // Normal
    { "اسم الموظف ": "ahmed", " الراتب الأساسي": 6000, "سلف/سحب": 0 }, // Extra spaces
    { "اسم الموظف": "fatima", "الراتب الأساسي": "7000", "سلف/سحب": 100 }, // String number
    { "اسم الموظف": "unknown", "الراتب الأساسي": 5000, "سلف/سحب": 0 } // Unknown employee
];
const ws = xlsx.utils.json_to_sheet(data);
xlsx.utils.book_append_sheet(wb, ws, "Salaries");
const filePath = path.join(__dirname, 'test_salaries.xlsx');
xlsx.writeFile(wb, filePath);
console.log('Created test Excel file:', filePath);

// 2. Upload the file
const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
const fileContent = fs.readFileSync(filePath);

const postDataStart = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="salariesFile"; filename="test_salaries.xlsx"',
    'Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '',
    ''
].join('\r\n');

const postDataEnd = `\r\n--${boundary}--`;

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/upload-salaries',
    method: 'POST',
    headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': Buffer.byteLength(postDataStart) + fileContent.length + Buffer.byteLength(postDataEnd)
    }
};

const req = http.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        console.log('Response Status:', res.statusCode);
        console.log('Response Body:', body);

        // Cleanup
        try {
            fs.unlinkSync(filePath);
            console.log('Deleted test file');
        } catch (e) {
            console.error('Failed to delete test file', e);
        }
    });
});

req.on('error', (e) => {
    console.error('Request Error:', e);
});

req.write(postDataStart);
req.write(fileContent);
req.write(postDataEnd);
req.end();
