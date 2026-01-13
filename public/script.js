// دالة تصحيح الأخطاء
async function debugSystem() {
    const debugInfo = document.getElementById("debug-info");
    debugInfo.innerHTML = "جاري فحص النظام...";
    
    try {
        // فحص الموظفين
        const empResponse = await fetch("/api/debug/employees");
        const employees = await empResponse.json();
        
        // فحص الأقسام
        const secResponse = await fetch("/api/debug/sections");
        const sections = await secResponse.json();
        
        debugInfo.innerHTML = `
            <h4>نتيجة الفحص:</h4>
            <p>✅ عدد الموظفين: ${employees.length}</p>
            <p>✅ عدد الأقسام: ${sections.length}</p>
            <p>✅ اتصال قاعدة البيانات: نشط</p>
            ${employees.length === 0 ? '<p style="color: red;">❌ لا يوجد موظفين مضافين</p>' : ''}
            ${sections.length === 0 ? '<p style="color: red;">❌ لا يوجد أقسام</p>' : ''}
        `;
        
    } catch (error) {
        debugInfo.innerHTML = `<p style="color: red;">❌ خطأ في الفحص: ${error.message}</p>`;
    }
}