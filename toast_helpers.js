/**
 * دوال مساعدة لاستبدال alert التقليدي بنظام Toast
 * 
 * الاستخدام:
 * بدلاً من: alert('تم الحفظ بنجاح')
 * استخدم: showSuccessToast('تم الحفظ بنجاح')
 */

// استبدال alert بـ toast ذكي
function smartAlert(message) {
    // تحديد نوع الرسالة بناءً على المحتوى
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('نجح') || lowerMessage.includes('تم') || lowerMessage.includes('success')) {
        return showSuccess(message);
    } else if (lowerMessage.includes('خطأ') || lowerMessage.includes('فشل') || lowerMessage.includes('error')) {
        return showError(message);
    } else if (lowerMessage.includes('تحذير') || lowerMessage.includes('warning') || lowerMessage.includes('انتبه')) {
        return showWarning(message);
    } else {
        return showInfo(message);
    }
}

// دوال محددة للعمليات الشائعة
function showSuccessToast(message = 'تمت العملية بنجاح') {
    return showSuccess(message);
}

function showErrorToast(message = 'حدث خطأ، يرجى المحاولة مرة أخرى') {
    return showError(message);
}

function showDeleteSuccess(itemName = 'العنصر') {
    return showSuccess(`تم حذف ${itemName} بنجاح`);
}

function showUpdateSuccess(itemName = 'البيانات') {
    return showSuccess(`تم تحديث ${itemName} بنجاح`);
}

function showAddSuccess(itemName = 'العنصر') {
    return showSuccess(`تم إضافة ${itemName} بنجاح`);
}

function showSaveSuccess() {
    return showSuccess('تم الحفظ بنجاح');
}

function showLoadingError() {
    return showError('فشل تحميل البيانات');
}

function showConnectionError() {
    return showError('خطأ في الاتصال بالخادم');
}

function showValidationError(message = 'يرجى التحقق من البيانات المدخلة') {
    return showWarning(message);
}

// دالة للتأكيد مع Toast
async function confirmWithToast(message, onConfirm, onCancel) {
    const result = confirm(message);
    if (result && onConfirm) {
        await onConfirm();
    } else if (!result && onCancel) {
        await onCancel();
    }
    return result;
}

// تصدير الدوال للاستخدام العام
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        smartAlert,
        showSuccessToast,
        showErrorToast,
        showDeleteSuccess,
        showUpdateSuccess,
        showAddSuccess,
        showSaveSuccess,
        showLoadingError,
        showConnectionError,
        showValidationError,
        confirmWithToast
    };
}
