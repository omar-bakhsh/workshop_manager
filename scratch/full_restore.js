const fs = require('fs');
const path = require('path');

const source = 'scratch/unzipped_old';
const dest = '.';

const filesToRestore = [
    'server.js',
    'admin.html',
    'employee.html',
    'inspector.html',
    'services_manager.html',
    'shortcuts_manager.html',
    'login.html',
    'income_report.html',
    'lifts.html'
];

filesToRestore.forEach(file => {
    const srcPath = path.join(source, file);
    const destPath = path.join(dest, file);
    if (fs.existsSync(srcPath)) {
        let buffer = fs.readFileSync(srcPath);
        // Correct encoding if it was UTF-16
        let content = '';
        if (buffer[1] === 0) content = buffer.toString('utf16le');
        else content = buffer.toString('utf8');
        
        fs.writeFileSync(destPath, content, 'utf8');
        console.log(`✅ Restored: ${file}`);
    }
});

console.log('🚀 SYSTEM RESTORED TO LAST STABLE VERSION.');
