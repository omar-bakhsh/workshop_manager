const fs = require('fs');

function restoreAdmin() {
    const backupPath = 'scratch/unzipped_old/admin.html';
    if (!fs.existsSync(backupPath)) {
        console.error('Backup not found');
        return;
    }

    let buffer = fs.readFileSync(backupPath);
    let content = '';
    // Detect encoding
    if (buffer[1] === 0 && buffer[3] === 0) {
        content = buffer.toString('utf16le');
    } else {
        content = buffer.toString('utf8');
    }

    // REMOVE ALL OLD CHAT WIDGETS AND LOGIC IF ANY (to avoid duplicates)
    // Be very careful not to delete too much. 
    // I'll search for the specific markers.
    content = content.replace(/<!-- Admin Chat Widget -->[\s\S]*?<\/script>/g, '');
    content = content.replace(/function toggleAdminChat\(\) \{[\s\S]*?sendAdminMessage\(\) \{[\s\S]*?\}[\s\n]+<\/script>/g, '');

    // Cleanup Lifts
    content = content.replace(/<button class="btn btn-info" onclick="window\.location\.href='lifts\.html'"[\s\S]*?<\/button>/g, '');

    // Add Chat Button if missing
    if (!content.includes('toggleAdminChat()')) {
        const settingsBtn = /<button class="btn btn-secondary" onclick="window\.location\.href='settings\.html'"[\s\S]*?<\/button>/;
        const chatBtn = `
                <button class="btn btn-info" onclick="toggleAdminChat()" style="background-color: #8b5cf6; color: white;">
                    <span>💬</span>
                    <span>المحادثة</span>
                </button>`;
        content = content.replace(settingsBtn, (m) => m + chatBtn);
    }

    // Add CORRECT Chat Widget and Script at the end
    const chatWidgetHtml = `
    <!-- Admin Chat Widget -->
    <div id="adminChatWidget" class="modal" style="display: none; background: rgba(0,0,0,0.5); z-index: 10001;">
        <div class="modal-content" style="max-width: 500px; height: 80vh; display: flex; flex-direction: column; position: relative;">
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
    content = content.replace('</body>', chatWidgetHtml + '\n</body>');

    fs.writeFileSync('admin.html', content, 'utf8');
    console.log('✅ admin.html: Recovered and Refined.');
}

restoreAdmin();
