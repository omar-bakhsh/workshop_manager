/**
 * =================================================================
 * 🛠️ Utility Functions - Workshop Manager
 * =================================================================
 * Contains shared functionality for:
 * - Toast Notifications
 * - Dark Mode Toggle
 * - Loading Spinners
 * - Common UI interactions
 * =================================================================
 */

// ================================
// 🔔 Toast Notification System
// ================================
const Toast = {
  container: null,

  init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      document.body.appendChild(this.container);
    }
  },

  show(message, type = 'info', duration = 5000) {
    this.init();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type} slide-up`;

    const icons = {
      success: '✓',
      error: '✗',
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

    this.container.appendChild(toast);

    // Auto remove after duration
    if (duration > 0) {
      setTimeout(() => {
        this.remove(toast);
      }, duration);
    }

    return toast;
  },

  remove(toast) {
    toast.classList.add('removing');
    setTimeout(() => {
      toast.remove();
    }, 300);
  },

  success(message, duration) {
    return this.show(message, 'success', duration);
  },

  error(message, duration) {
    return this.show(message, 'error', duration);
  },

  warning(message, duration) {
    return this.show(message, 'warning', duration);
  },

  info(message, duration) {
    return this.show(message, 'info', duration);
  }
};

// ================================
// 🌙 Dark Mode Toggle
// ================================
const ThemeManager = {
  currentTheme: 'light',
  
  init() {
    // Load saved theme
    this.currentTheme = localStorage.getItem('theme') || 'light';
    this.apply(this.currentTheme);
    
    // Create toggle button
    this.createToggleButton();
  },

  apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    this.currentTheme = theme;
    localStorage.setItem('theme', theme);
    
    // Update toggle button icon
    const toggleBtn = document.querySelector('.theme-toggle');
    if (toggleBtn) {
      toggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
  },

  toggle() {
    const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    
    // Add transitioning class to prevent animation during theme change
    document.body.classList.add('theme-transitioning');
    
    this.apply(newTheme);
    
    // Remove transitioning class after a brief moment
    setTimeout(() => {
      document.body.classList.remove('theme-transitioning');
    }, 50);
  },

  createToggleButton() {
    // Check if button already exists
    if (document.querySelector('.theme-toggle')) return;

    const button = document.createElement('button');
    button.className = 'theme-toggle';
    button.textContent = this.currentTheme === 'dark' ? '☀️' : '🌙';
    button.setAttribute('aria-label', 'Toggle dark mode');
    button.onclick = () => this.toggle();
    
    document.body.appendChild(button);
  }
};

// ================================
// ⏳ Loading Spinner
// ================================
const Loading = {
  overlay: null,

  show() {
    if (!this.overlay) {
      this.overlay = document.createElement('div');
      this.overlay.className = 'spinner-overlay';
      this.overlay.innerHTML = '<div class="spinner"></div>';
    }
    document.body.appendChild(this.overlay);
  },

  hide() {
    if (this.overlay && this.overlay.parentElement) {
      this.overlay.remove();
    }
  }
};

// ================================
// 🔐 Authentication Helper
// ================================
const Auth = {
  check() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (!token || !user) {
      window.location.href = 'login.html';
      return null;
    }
    
    try {
      return JSON.parse(user);
    } catch (e) {
      this.logout();
      return null;
    }
  },

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
  },

  getUser() {
    const user = localStorage.getItem('user');
    try {
      return JSON.parse(user);
    } catch (e) {
      return null;
    }
  }
};

// ================================
// 📡 API Helper (with error handling)
// ================================
const API = {
  async request(url, options = {}) {
    try {
      Loading.show();
      
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      const data = await response.json();

      Loading.hide();

      if (!response.ok) {
        throw new Error(data.message || 'حدث خطأ في الخادم');
      }

      return data;
    } catch (error) {
      Loading.hide();
      Toast.error(error.message || 'حدث خطأ في الاتصال');
      throw error;
    }
  },

  get(url) {
    return this.request(url, { method: 'GET' });
  },

  post(url, data) {
    return this.request(url, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  put(url, data) {
    return this.request(url, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  delete(url) {
    return this.request(url, { method: 'DELETE' });
  }
};

// ================================
// 📅 Date Formatter
// ================================
const DateFormatter = {
  toArabic(date) {
    if (!date) return '';
    const d = new Date(date);
    return new Intl.DateTimeFormat('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  },

  toShort(date) {
    if (!date) return '';
    const d = new Date(date);
    return new Intl.DateTimeFormat('ar-SA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);
  },

  relative(date) {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'الآن';
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
    if (diffDays < 7) return `منذ ${diffDays} يوم`;
    return this.toShort(date);
  }
};

// ================================
// 💰 Currency Formatter
// ================================
const Currency = {
  format(amount) {
    if (amount == null || isNaN(amount)) return '0 ر.س';
    return new Intl.NumberFormat('ar-SA', {
      style: 'currency',
      currency: 'SAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
  }
};

// ================================
// 🔍 Confirm Dialog Helper
// ================================
const Confirm = {
  async show(message, title = 'تأكيد') {
    return new Promise((resolve) => {
      // Create a better looking confirm dialog instead of default browser confirm
      const result = confirm(`${title}\n\n${message}`);
      resolve(result);
    });
    // TODO: Create custom modal dialog for better UX
  }
};

// ================================
// 🎯 Initialize on page load
// ================================
document.addEventListener('DOMContentLoaded', () => {
  ThemeManager.init();
  Toast.init();
});

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Toast, ThemeManager, Loading, Auth, API, DateFormatter, Currency, Confirm };
}
