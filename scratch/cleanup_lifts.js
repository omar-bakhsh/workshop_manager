const fs = require('fs');

// 1. Repair server.js (Remove Lifts)
let server = fs.readFileSync('server.js', 'utf8');

// Remove table creation
server = server.replace(/`CREATE TABLE IF NOT EXISTS workshop_lifts[\s\S]*?`,?/, '');

// Remove table population
server = server.replace(/const lifts = \['A', 'B', 'C', 'D', 'E'\];[\s\S]*?\}\);/, '');

// Remove API endpoints
server = server.replace(/\/\/ جلب حالة جميع الرافعات[\s\S]*?\/\/ ==========================[\s\n]+\/\/ 🧩 تقديم صفحات HTML/, '// ==========================\n// 🧩 تقديم صفحات HTML');

fs.writeFileSync('server.js', server);
console.log('✅ server.js: Lifts removed.');

// 2. Repair admin.html (Remove Lifts, Check Features)
let admin = fs.readFileSync('admin.html', 'utf8');

// Remove Lifts button
admin = admin.replace(/<button class="btn btn-info" onclick="window.location.href='lifts.html'"[\s\S]*?<\/button>/, '');

// Ensure Chat button exists
if (!admin.includes('toggleAdminChat()')) {
    // Insert after settings button?
    const settingsBtn = /<button class="btn btn-secondary" onclick="window.location.href='settings\.html'"[\s\S]*?<\/button>/;
    const chatBtn = `
                <button class="btn btn-info" onclick="toggleAdminChat()" style="background-color: #8b5cf6; color: white;">
                    <span>💬</span>
                    <span>المحادثة</span>
                </button>`;
    admin = admin.replace(settingsBtn, (match) => match + chatBtn);
}

// Ensure adminChatWidget HTML exists near end of body
if (!admin.includes('id="adminChatWidget"')) {
    const chatWidgetHtml = `
    <!-- Admin Chat Widget -->
    <div id="adminChatWidget" class="modal" style="display: none; background: rgba(0,0,0,0.5);">
        <div class="modal-content" style="max-width: 500px; height: 80vh; display: flex; flex-direction: column;">
            <div class="modal-header">
                <h2>💬 محادثة الموظفين</h2>
                <button class="close-btn" onclick="toggleAdminChat()">&times;</button>
            </div>
            <div class="modal-body" style="flex: 1; display: flex; flex-direction: column; overflow: hidden; padding: 10px;">
                <select id="chatEmployeeSelect" onchange="loadAdminChat(this.value)" style="margin-bottom: 10px; padding: 10px; border-radius: 8px;">
                    <option value="">-- اختر موظف للمحادثة --</option>
                </select>
                <div id="adminChatBody" style="flex: 1; overflow-y: auto; background: #f9fafb; border-radius: 8px; padding: 10px; margin-bottom: 10px;">
                    <!-- Messages here -->
                </div>
                <div style="display: flex; gap: 10px;">
                    <input type="text" id="adminChatInput" placeholder="اكتب رسالتك..." style="flex: 1; padding: 10px; border-radius: 8px; border: 1px solid #ddd;">
                    <button class="btn btn-primary" onclick="sendAdminMessage()">إرسال</button>
                </div>
            </div>
        </div>
    </div>`;
    admin = admin.replace('</body>', chatWidgetHtml + '\n</body>');
}

// Add Missing Chat JS if needed
if (!admin.includes('function toggleAdminChat')) {
    const chatJs = `
        function toggleAdminChat() {
            const widget = document.getElementById('adminChatWidget');
            if (widget.style.display === 'none') {
                widget.style.display = 'flex';
                // Populate select
                const select = document.getElementById('chatEmployeeSelect');
                select.innerHTML = '<option value="">-- اختر موظف --</option>';
                employees.forEach(e => {
                    select.innerHTML += \`<option value="\${e.id}">\${e.name}</option>\`;
                });
            } else {
                widget.style.display = 'none';
            }
        }

        async function loadAdminChat(empId) {
            if (!empId) return;
            try {
                // Mark as read
                await fetch('/api/messages/mark-read', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ employee_id: empId, reader: 'admin' })
                });

                const res = await fetch(\`/api/messages/\${empId}\`);
                const messages = await res.json();
                const body = document.getElementById('adminChatBody');
                body.innerHTML = messages.map(m => {
                    const isMe = m.sender === 'admin';
                    return \`
                        <div style="margin-bottom: 10px; text-align: \${isMe ? 'left' : 'right'}">
                            <div style="display: inline-block; padding: 8px 12px; border-radius: 12px; background: \${isMe ? '#4f46e5' : '#e5e7eb'}; color: \${isMe ? 'white' : 'black'}; max-width: 80%;">
                                \${m.message}
                            </div>
                        </div>\`;
                }).join('');
                body.scrollTop = body.scrollHeight;
            } catch (e) { console.error(e); }
        }

        async function sendAdminMessage() {
            const empId = document.getElementById('chatEmployeeSelect').value;
            const input = document.getElementById('adminChatInput');
            const msg = input.value.trim();
            if (!empId || !msg) return;

            try {
                const res = await fetch('/api/messages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ employee_id: empId, sender: 'admin', message: msg })
                });
                if (res.ok) { input.value = ''; loadAdminChat(empId); }
            } catch (e) { console.error(e); }
        }
    `;
    admin = admin.replace('</script>', chatJs + '\n</script>');
}

fs.writeFileSync('admin.html', admin);
console.log('✅ admin.html: Lifts removed, Chat added.');

// 3. Repair employee.html (Remove Lifts, Ensure Clean Links)
let employee = fs.readFileSync('employee.html', 'utf8');

// Remove Lift Ticker HTML
employee = employee.replace(/<div id="liftTicker"[\s\S]*?<\/div>\s*<\/div>/, '');

// Remove Lifts nav link
employee = employee.replace(/<a href="lifts.html" class="nav-btn">[\s\S]*?<\/a>/, '');

// Remove Lift Ticker JS
employee = employee.replace(/\/\/ Lift Ticker[\s\S]*?startLiftTicker\(\);/, '');
employee = employee.replace(/\/\/ Ticker Logic[\s\S]*?updateTicker\(\); \/\/ Initial call/, '');

fs.writeFileSync('employee.html', employee);
console.log('✅ employee.html: Lifts removed.');

// 4. Delete lifts.html
if (fs.existsSync('lifts.html')) {
    fs.unlinkSync('lifts.html');
    console.log('✅ lifts.html deleted.');
}
