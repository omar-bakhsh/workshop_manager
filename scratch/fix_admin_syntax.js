const fs = require('fs');
let content = fs.readFileSync('admin.html', 'utf8');

// 1. Remove the misplaced block from the print function
const misplacedStart = /<!-- Admin Chat Widget -->/;
const misplacedEnd = /async function sendAdminMessage\(\) \{[\s\S]*?\}[\s\n]+<\/script>/;

// Find the whole block from <!-- Admin Chat Widget --> to the end of its <script>
const fullMisplacedBlock = /<!-- Admin Chat Widget -->[\s\S]*?async function sendAdminMessage\(\) \{[\s\S]*?\}[\s\n]+<\/script>/;

if (fullMisplacedBlock.test(content)) {
    content = content.replace(fullMisplacedBlock, '');
    console.log('✅ Misplaced chat block removed.');
}

// 2. Fix the broken print template string (restore </body></html>)
// In the view_file, after removal, it likely looks like:
// </body>
// </html>
// `);
// Wait! If I removed it, I might have removed the concluding part of the template.
// Let's be precise.

// Search for the broken print function end
const brokenPrintEnd = /async function sendAdminMessage\(\) \{[\s\S]*?\}[\s\n]+<\/script>[\s\n]+<\/body>[\s\n]+<\/html>[\s\n]+`\);/;
// Wait! If I already replaced it with '', I need to restore the template string part if I deleted it.

// Let's just read the file again after removal logic.
// Better: do it all in one go with a smarter regex or just rewrite the problematic area.

// 3. Define the Correct Chat Block (with z-index for visibility)
const correctChatBlock = `
    <!-- Admin Chat Widget -->
    <div id="adminChatWidget" class="modal" style="display: none; background: rgba(0,0,0,0.5); z-index: 10001;">
        <div class="modal-content" style="max-width: 500px; height: 80vh; display: flex; flex-direction: column; position: relative; z-index: 10002;">
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
    </div>
    <script>
        function toggleAdminChat() {
            const widget = document.getElementById('adminChatWidget');
            if (widget.style.display === 'none') {
                widget.style.display = 'flex';
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
    </script>
`;

// Remove faulty insertion and fix print string
const faultyPattern = /<!-- Admin Chat Widget -->[\s\S]*?async function sendAdminMessage\(\) \{[\s\S]*?\}[\s\n]+<\/script>[\s\n]+<\/body>[\s\n]+<\/html>/;
if (faultyPattern.test(content)) {
    content = content.replace(faultyPattern, '        </body>\n                </html>');
    console.log('✅ Faulty insertion fixed.');
}

// Append correctly to end of body
content = content.replace('</body>', correctChatBlock + '\n</body>');

fs.writeFileSync('admin.html', content);
console.log('✅ admin.html: Chat widget moved to correct location.');
