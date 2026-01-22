/**
 * نظام الإشعارات Toast
 * يدعم: success, error, warning, info
 */

class ToastNotification {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        // إنشاء الحاوية إذا لم تكن موجودة
        if (!document.querySelector('.toast-container')) {
            this.container = document.createElement('div');
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        } else {
            this.container = document.querySelector('.toast-container');
        }
    }

    show(message, type = 'info', duration = 3000) {
        const toast = this.createToast(message, type);
        this.container.appendChild(toast);

        // إضافة شريط التقدم
        const progress = document.createElement('div');
        progress.className = 'toast-progress';
        progress.style.animationDuration = `${duration}ms`;
        toast.appendChild(progress);

        // الإخفاء التلقائي
        setTimeout(() => {
            this.hide(toast);
        }, duration);

        return toast;
    }

    createToast(message, type) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        const titles = {
            success: 'نجح',
            error: 'خطأ',
            warning: 'تحذير',
            info: 'معلومة'
        };

        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || icons.info}</div>
            <div class="toast-content">
                <div class="toast-title">${titles[type] || titles.info}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;

        return toast;
    }

    hide(toast) {
        toast.classList.add('hiding');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }

    success(message, duration = 3000) {
        return this.show(message, 'success', duration);
    }

    error(message, duration = 4000) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration = 3500) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration = 3000) {
        return this.show(message, 'info', duration);
    }
}

// إنشاء instance عام
const toast = new ToastNotification();

// دوال مساعدة عامة
function showToast(message, type = 'info', duration = 3000) {
    return toast.show(message, type, duration);
}

function showSuccess(message) {
    return toast.success(message);
}

function showError(message) {
    return toast.error(message);
}

function showWarning(message) {
    return toast.warning(message);
}

function showInfo(message) {
    return toast.info(message);
}
