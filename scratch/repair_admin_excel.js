const fs = require('fs');

function repairAdmin() {
    let content = fs.readFileSync('admin.html', 'utf8');

    // 1. Add Excel Upload Button in Header
    if (!content.includes('handleExcelUpload')) {
        const insertionPoint = '<button class="logout-btn"';
        const uploadBtn = `
                <button class="btn btn-secondary" onclick="document.getElementById('excelInput').click()" style="background-color: #059669; color: white;">
                    <span>📊</span>
                    <span>رفع الرواتب</span>
                </button>
                <input type="file" id="excelInput" style="display: none" accept=".xlsx, .xls" onchange="handleExcelUpload(event)">
        `;
        content = content.replace(insertionPoint, uploadBtn + insertionPoint);
        
        // 2. Add handleExcelUpload Logic
        const scriptEnd = '</body>';
        const excelLogic = `
    <script>
        async function handleExcelUpload(event) {
            const file = event.target.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('file', file);

            try {
                const res = await fetch('/api/employees/import-salaries', {
                    method: 'POST',
                    body: formData
                });
                const result = await res.json();
                
                if (res.ok) {
                    let msg = result.message;
                    if (result.notFound && result.notFound.length > 0) {
                        msg += "\\n\\nلم يتم العثور على: " + result.notFound.join(', ');
                    }
                    alert(msg);
                    loadData(); // Re-load table
                } else {
                    alert('خطأ: ' + (result.message || 'فشل الرفع'));
                }
            } catch (error) {
                console.error(error);
                alert('خطأ في الاتصال بالسيرفر');
            }
            event.target.value = ''; // Reset input
        }
    </script>
        `;
        content = content.replace(scriptEnd, excelLogic + scriptEnd);
    }

    fs.writeFileSync('admin.html', content, 'utf8');
    console.log('✅ admin.html: Excel Upload restored.');
}

repairAdmin();
