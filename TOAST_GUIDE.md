# 🔔 نظام الإشعارات Toast - دليل الاستخدام

## 📦 الملفات المطلوبة

1. **toast.css** - ملف التنسيقات
2. **toast.js** - المكتبة الأساسية
3. **toast_helpers.js** - دوال مساعدة (اختياري)

## 🚀 التثبيت

### 1. إضافة الملفات في HTML

```html
<head>
    <!-- في قسم head -->
    <link rel="stylesheet" href="toast.css">
    <script src="toast.js"></script>
    <script src="toast_helpers.js"></script> <!-- اختياري -->
</head>
```

## 💡 الاستخدام الأساسي

### الدوال الرئيسية

```javascript
// إشعار نجاح (أخضر)
showSuccess('تم الحفظ بنجاح');

// إشعار خطأ (أحمر)
showError('حدث خطأ أثناء العملية');

// إشعار تحذير (برتقالي)
showWarning('يرجى التحقق من البيانات');

// إشعار معلومة (أزرق)
showInfo('تم تحديث النظام');
```

### الدالة العامة

```javascript
// showToast(message, type, duration)
showToast('رسالة مخصصة', 'success', 5000);
```

**المعاملات:**
- `message`: نص الرسالة
- `type`: نوع الإشعار (`success`, `error`, `warning`, `info`)
- `duration`: مدة العرض بالميلي ثانية (افتراضي: 3000)

## 🎯 أمثلة عملية

### استبدال alert التقليدي

#### قبل:
```javascript
if (res.ok) {
    alert('تم الحفظ بنجاح');
} else {
    alert('فشل الحفظ');
}
```

#### بعد:
```javascript
if (res.ok) {
    showSuccess('تم الحفظ بنجاح');
} else {
    showError('فشل الحفظ');
}
```

### عمليات CRUD

```javascript
// إضافة
async function addEmployee() {
    try {
        const res = await fetch('/api/employees', {...});
        if (res.ok) {
            showAddSuccess('الموظف');
            loadData();
        }
    } catch (error) {
        showConnectionError();
    }
}

// تحديث
async function updateEmployee() {
    try {
        const res = await fetch('/api/employees/1', {...});
        if (res.ok) {
            showUpdateSuccess('بيانات الموظف');
        }
    } catch (error) {
        showError('فشل التحديث');
    }
}

// حذف
async function deleteEmployee() {
    if (confirm('هل أنت متأكد؟')) {
        try {
            const res = await fetch('/api/employees/1', {method: 'DELETE'});
            if (res.ok) {
                showDeleteSuccess('الموظف');
            }
        } catch (error) {
            showError('فشل الحذف');
        }
    }
}
```

### استخدام الدوال المساعدة

```javascript
// حفظ عام
showSaveSuccess();

// خطأ في التحميل
showLoadingError();

// خطأ في الاتصال
showConnectionError();

// خطأ في التحقق
showValidationError('يرجى ملء جميع الحقول');

// Alert ذكي (يحدد النوع تلقائياً)
smartAlert('تم الحفظ بنجاح'); // سيظهر كـ success
smartAlert('حدث خطأ'); // سيظهر كـ error
```

## 🎨 التخصيص

### تغيير المدة الافتراضية

```javascript
// إشعار يبقى لمدة 5 ثواني
showSuccess('رسالة مهمة', 5000);

// إشعار يبقى لمدة ثانيتين
showInfo('رسالة سريعة', 2000);
```

### إغلاق يدوي

```javascript
const toast = showSuccess('رسالة');

// إغلاق بعد 1 ثانية
setTimeout(() => {
    toast.remove();
}, 1000);
```

## 📱 التوافق مع الأجهزة

النظام متجاوب تماماً ويعمل على:
- ✅ سطح المكتب
- ✅ الأجهزة اللوحية
- ✅ الهواتف المحمولة

## 🔧 الميزات

- ✨ تصميم عصري وجذاب
- 🎯 4 أنواع من الإشعارات
- ⏱️ إخفاء تلقائي مع شريط تقدم
- 🖱️ إمكانية الإغلاق اليدوي
- 📱 متجاوب مع جميع الشاشات
- 🌐 دعم كامل للغة العربية (RTL)
- 🎭 رسوم متحركة سلسة
- 📚 إمكانية عرض عدة إشعارات في نفس الوقت

## 🎬 التجربة

افتح ملف `toast_demo.html` في المتصفح لرؤية أمثلة حية!

## 📝 ملاحظات

1. تأكد من تحميل `toast.js` قبل استخدام أي دالة
2. يمكن عرض عدة إشعارات في نفس الوقت
3. الإشعارات تظهر في الزاوية العلوية اليمنى
4. يمكن تخصيص الألوان من ملف `toast.css`

## 🔄 الترقية من alert

للترقية السريعة، يمكنك استبدال جميع استدعاءات `alert`:

```javascript
// ابحث عن: alert(
// استبدل بـ: smartAlert(
```

أو استخدم البحث والاستبدال في محرر الأكواد!
