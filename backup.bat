@echo off
:: =============================================
:: نظام النسخ الاحتياطي التلقائي - Workshop Manager
:: قم بتشغيل هذا الملف قبل أي تعديل جديد
:: =============================================

set "TIMESTAMP=%date:~-4%-%date:~3,2%-%date:~0,2%_%time:~0,2%-%time:~3,2%"
set "TIMESTAMP=%TIMESTAMP: =0%"

echo.
echo ========================================
echo  💾 حفظ نسخة احتياطية...
echo ========================================

:: حفظ في Git
git add admin.html employee.html server.js inspector.html login.html income_report.html services_manager.html shortcuts_manager.html 2>nul
git commit -m "BACKUP %TIMESTAMP%" 2>nul

if %errorlevel% == 0 (
    echo ✅ تم الحفظ في Git بنجاح
) else (
    echo ℹ️  لا توجد تغييرات جديدة للحفظ
)

echo.
echo ========================================
echo  📋 آخر 5 نسخ محفوظة:
echo ========================================
git log --oneline -5

echo.
echo ========================================
echo  🔄 للرجوع لنسخة سابقة استخدم:
echo     git checkout [COMMIT_ID] -- admin.html
echo     git checkout [COMMIT_ID] -- server.js
echo ========================================
echo.
pause
