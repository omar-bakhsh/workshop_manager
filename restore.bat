@echo off
:: =============================================
:: نظام الاسترجاع - Workshop Manager
:: =============================================

echo.
echo ========================================
echo  📋 النسخ المحفوظة المتاحة:
echo ========================================
git log --oneline -10
echo.

set /p COMMIT="أدخل رقم النسخة المراد استرجاعها (أول 7 أحرف): "

echo.
echo ========================================
echo  🔄 اختر الملف للاسترجاع:
echo ========================================
echo  1. admin.html فقط
echo  2. server.js فقط
echo  3. employee.html فقط  
echo  4. جميع الملفات الرئيسية
echo ========================================

set /p CHOICE="اختيارك (1-4): "

if "%CHOICE%"=="1" (
    git checkout %COMMIT% -- admin.html
    echo ✅ تم استرجاع admin.html
)
if "%CHOICE%"=="2" (
    git checkout %COMMIT% -- server.js
    echo ✅ تم استرجاع server.js
)
if "%CHOICE%"=="3" (
    git checkout %COMMIT% -- employee.html
    echo ✅ تم استرجاع employee.html
)
if "%CHOICE%"=="4" (
    git checkout %COMMIT% -- admin.html server.js employee.html inspector.html login.html
    echo ✅ تم استرجاع جميع الملفات
)

echo.
echo  🚀 أعد تشغيل السيرفر لتطبيق التغييرات
pause
