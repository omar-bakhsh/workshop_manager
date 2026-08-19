/**
 * ====================================================================
 * 🚗 Atenza App - Central Application Configuration & Branding Manager
 * ====================================================================
 * 
 * To change the app name from ONE place:
 * 1. Change `DEFAULT_APP_NAME` in this file, OR
 * 2. Change it directly in the browser via Settings (settings.html).
 * 
 * All page titles, headers, brand elements, and printable receipts
 * synchronize automatically with this configuration.
 */

(function (global) {
    'use strict';

    const APP_CONFIG = {
        // 🌟 Default System Branding (Single source of truth)
        DEFAULT_APP_NAME: 'Atenza App',
        DEFAULT_APP_SHORT_NAME: 'Atenza',
        DEFAULT_WORKSHOP_NAME: 'Atenza App',
        DEFAULT_TAGLINE: 'نظام إدارة الورشة والموظفين',
        VERSION: '5.0',

        // Get currently cached or default app name
        getAppName: function () {
            return localStorage.getItem('app_name') || this.DEFAULT_APP_NAME;
        },

        // Get currently cached or default workshop name
        getWorkshopName: function () {
            return localStorage.getItem('workshop_name') || this.DEFAULT_WORKSHOP_NAME;
        },

        // Save new app name to local cache
        setAppName: function (name) {
            if (name && typeof name === 'string') {
                localStorage.setItem('app_name', name.trim());
            }
        },

        // Save new workshop name to local cache
        setWorkshopName: function (name) {
            if (name && typeof name === 'string') {
                localStorage.setItem('workshop_name', name.trim());
            }
        },

        // Apply branding across the entire document
        applyToDOM: function (appName, workshopName) {
            const activeAppName = appName || this.getAppName();
            const activeWorkshop = workshopName || this.getWorkshopName();

            // 1. Update text nodes with brand selectors
            const brandSelectors = [
                '[data-app-name]',
                '.app-name-text',
                '.app-brand-name',
                '.app-title'
            ];
            document.querySelectorAll(brandSelectors.join(', ')).forEach(el => {
                if (el) el.textContent = activeAppName;
            });

            const workshopSelectors = [
                '[data-workshop-name]',
                '.workshop-name-text',
                '#shopName',
                '#inspectorShopName',
                '#reportWorkshopName'
            ];
            document.querySelectorAll(workshopSelectors.join(', ')).forEach(el => {
                if (el && !el.dataset.customSet) {
                    el.textContent = activeWorkshop;
                }
            });

            // 2. Update page document.title intelligently
            if (document.title) {
                const oldNames = [
                    'مدير الورشة',
                    'إدارة الورشة',
                    'ورشة عبد الله عصام عيد الزين',
                    'ورشة الصيانة',
                    'الورشة'
                ];
                let updatedTitle = document.title;
                let matched = false;

                for (const old of oldNames) {
                    if (updatedTitle.includes(old)) {
                        updatedTitle = updatedTitle.split(old).join(activeAppName);
                        matched = true;
                    }
                }

                if (matched) {
                    document.title = updatedTitle;
                }
            }

            // 3. Update PWA meta tags if present
            const appleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
            if (appleMeta) {
                appleMeta.setAttribute('content', activeAppName);
            }
        },

        // Initialize branding from cache immediately, then sync with server
        initBranding: async function () {
            // Step 1: Immediate local render (zero-flicker)
            this.applyToDOM();

            // Step 2: Live sync from server /api/settings
            try {
                const response = await fetch('/api/settings');
                if (response.ok) {
                    const settings = await response.json();
                    if (settings.app_name) {
                        this.setAppName(settings.app_name);
                    }
                    if (settings.workshop_name) {
                        this.setWorkshopName(settings.workshop_name);
                    }
                    this.applyToDOM(settings.app_name, settings.workshop_name);
                }
            } catch (err) {
                // Silently fallback to cached/default settings in offline/isolated environments
            }
        }
    };

    /**
     * 🛡️ Atenza App - Unified Role & Permissions Manager
     * Enforces business rules across all pages
     */
    const APP_PERMISSIONS = {
        getUser: function () {
            try {
                return JSON.parse(localStorage.getItem('user')) || {};
            } catch (e) {
                return {};
            }
        },

        isSection: function (user, sectionKeyword) {
            if (!user) user = this.getUser();
            const sName = String(user.section_name || '').toLowerCase();
            return sName.includes(sectionKeyword.toLowerCase());
        },

        isAdmin: function (user) {
            if (!user) user = this.getUser();
            return user.role === 'admin';
        },

        isManagement: function (user) {
            if (!user) user = this.getUser();
            return this.isAdmin(user) || this.isSection(user, 'ادار') || this.isSection(user, 'إدار');
        },

        isInspection: function (user) {
            if (!user) user = this.getUser();
            return this.isSection(user, 'كشف');
        },

        isElectricity: function (user) {
            if (!user) user = this.getUser();
            return this.isSection(user, 'كهربا');
        },

        isMechanic: function (user) {
            if (!user) user = this.getUser();
            return this.isSection(user, 'مكانيك');
        },

        // 1. صلاحية تعديل أوامر العمل: فقط لموظفي الإدارة + حساب الأدمن
        canEditJobOrder: function (user) {
            if (!user) user = this.getUser();
            return this.isManagement(user);
        },

        // 2. صلاحية تعديل التسعيرة: جميع موظفي الكشف + الإدارة + حساب الأدمن
        canEditQuotation: function (user) {
            if (!user) user = this.getUser();
            return this.isManagement(user) || this.isInspection(user);
        },

        // 3. صلاحية استعراض أوامر العمل دون تعديل:
        // موظفي الإدارة + موظفي الكشف + موظفي المكانيكا والكهرباء المعين لهم الكرت فقط + الأدمن
        canViewJobOrders: function (user) {
            if (!user) user = this.getUser();
            return this.isManagement(user) || this.isInspection(user) || this.isMechanic(user) || this.isElectricity(user);
        },

        // هل المستخدم فني تنفيذي مقيد فقط بالكروت المعينة له؟
        isAssignedOnlyTechnician: function (user) {
            if (!user) user = this.getUser();
            if (this.isManagement(user) || this.isInspection(user)) return false;
            return this.isMechanic(user) || this.isElectricity(user);
        },

        // 4. صلاحية استعراض الكشوفات السابقة:
        // موظفي الكشف + موظفي الإدارة + موظفي الكهرباء + الأدمن
        canViewInspections: function (user) {
            if (!user) user = this.getUser();
            return this.isManagement(user) || this.isInspection(user) || this.isElectricity(user);
        },

        // 5. الصلاحية الكاملة لحساب الأدمن
        canDelete: function (user) {
            if (!user) user = this.getUser();
            return this.isAdmin(user);
        },

        canAssignTechnicians: function (user) {
            if (!user) user = this.getUser();
            return this.isManagement(user);
        },

        canChangeCarStatus: function (user) {
            if (!user) user = this.getUser();
            return this.isManagement(user);
        }
    };

    /**
     * 🧭 Smart Navigation & Seamless History Manager (Atenza App)
     * Provides smart back navigation without app exit, and dynamic role-based headers
     */
    const APP_NAV = {
        getHomeUrl: function () {
            const user = APP_PERMISSIONS.getUser();
            if (user.role === 'admin') {
                return 'admin.html';
            }
            if (user.employee_id || user.id) {
                return `employee.html?id=${user.employee_id || user.id}`;
            }
            return 'employee.html';
        },

        goHome: function () {
            window.location.href = this.getHomeUrl();
        },

        goBack: function (fallbackUrl) {
            const home = this.getHomeUrl();
            const fallback = fallbackUrl || home;

            if (document.referrer) {
                try {
                    const refUrl = new URL(document.referrer);
                    const currentUrl = new URL(window.location.href);

                    // If same origin and not login page and not the exact same page
                    if (refUrl.origin === currentUrl.origin &&
                        !refUrl.pathname.includes('login.html') &&
                        (refUrl.pathname !== currentUrl.pathname || refUrl.search !== currentUrl.search)) {
                        window.history.back();
                        return;
                    }
                } catch (e) {
                    console.warn('Navigation Referrer Check:', e);
                }
            }

            if (window.history && window.history.length > 1) {
                window.history.back();
                return;
            }

            window.location.href = fallback;
        },

        logout: function () {
            if (confirm('هل أنت متأكد من تسجيل الخروج من البرنامج؟')) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = 'login.html';
            }
        },

        renderNavbar: function (targetSelector, options = {}) {
            const container = document.querySelector(targetSelector);
            if (!container) return;

            const user = APP_PERMISSIONS.getUser();
            if (!user || (!user.role && !user.employee_id)) {
                return;
            }

            const canEditQ = APP_PERMISSIONS.canEditQuotation(user);
            const canViewInsp = APP_PERMISSIONS.canViewInspections(user);
            const canViewJobs = APP_PERMISSIONS.canViewJobOrders(user);
            const isTechOnly = APP_PERMISSIONS.isAssignedOnlyTechnician(user);

            const activePage = options.activePage || window.location.pathname.split('/').pop() || '';
            const appName = APP_CONFIG.getAppName();

            let linksHtml = '';

            // Home
            const isHomeActive = activePage === 'admin.html' || activePage.includes('employee.html');
            linksHtml += `
                <a href="${this.getHomeUrl()}" class="nav-bar-link ${isHomeActive ? 'active' : ''}">
                    <span>🏠</span> <span>الرئيسية</span>
                </a>
            `;

            // Quotation
            if (canEditQ) {
                const isInspActive = activePage === 'inspector.html' && !window.location.search.includes('mode=job_order');
                linksHtml += `
                    <a href="inspector.html" class="nav-bar-link ${isInspActive ? 'active' : ''}">
                        <span>🔍</span> <span>تسعيرة جديدة</span>
                    </a>
                `;
            }

            // Inspections History
            if (canViewInsp) {
                linksHtml += `
                    <a href="inspections_list.html" class="nav-bar-link ${activePage === 'inspections_list.html' ? 'active' : ''}">
                        <span>📋</span> <span>سجل التسعيرات</span>
                    </a>
                `;
            }

            // Job Orders
            if (canViewJobs) {
                const jobTitle = isTechOnly ? 'أوامر العمل المسندة إليّ' : 'أوامر العمل والسيارات';
                linksHtml += `
                    <a href="job_orders_list.html" class="nav-bar-link ${activePage === 'job_orders_list.html' ? 'active' : ''}">
                        <span>🚗</span> <span>${jobTitle}</span>
                    </a>
                `;
            }

            // Admin extra pages
            if (user.role === 'admin') {
                linksHtml += `
                    <a href="services_manager.html" class="nav-bar-link ${activePage === 'services_manager.html' ? 'active' : ''}">
                        <span>🛠️</span> <span>الخدمات</span>
                    </a>
                    <a href="income_report.html" class="nav-bar-link ${activePage === 'income_report.html' ? 'active' : ''}">
                        <span>📊</span> <span>التقارير</span>
                    </a>
                    <a href="settings.html" class="nav-bar-link ${activePage === 'settings.html' ? 'active' : ''}">
                        <span>⚙️</span> <span>الإعدادات</span>
                    </a>
                `;
            }

            const userName = user.employee_name || user.username || 'مستخدم';
            const userRoleName = user.role === 'admin' ? 'المدير العام' : (user.section_name || 'موظف');

            const navHtml = `
                <div class="atenza-global-navbar no-print">
                    <div class="atenza-nav-inner">
                        <div class="atenza-nav-brand" onclick="APP_NAV.goHome()">
                            <span class="atenza-brand-icon">🚗</span>
                            <span class="atenza-brand-text">${appName}</span>
                        </div>

                        <div class="atenza-nav-links">
                            ${linksHtml}
                        </div>

                        <div class="atenza-nav-user-actions">
                            <div class="atenza-user-badge">
                                <span class="atenza-user-name">${userName}</span>
                                <span class="atenza-user-role">${userRoleName}</span>
                            </div>
                            <button type="button" class="atenza-nav-btn atenza-btn-back" onclick="APP_NAV.goBack()" title="الرجوع للصفحة السابقة دون الخروج من البرنامج">
                                <span>🔙</span> <span>رجوع</span>
                            </button>
                            <button type="button" class="atenza-nav-btn atenza-btn-logout" onclick="APP_NAV.logout()" title="تسجيل الخروج">
                                <span>🚪</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;

            container.innerHTML = navHtml;
        }
    };

    /**
     * 💬 WhatsApp Automation Helper (Atenza App)
     */
    const APP_WHATSAPP = {
        formatPhone: function (phone) {
            if (!phone) return '';
            let p = String(phone).replace(/[^\d+]/g, '');
            if (p.startsWith('00')) p = p.substring(2);
            if (p.startsWith('+')) p = p.substring(1);
            if (p.startsWith('05')) p = '966' + p.substring(1);
            if (p.startsWith('5') && p.length === 9) p = '966' + p;
            return p;
        },

        getTrackingUrl: function (inspectionId) {
            const loc = window.location;
            const origin = loc.origin || `${loc.protocol}//${loc.host}`;
            return `${origin}/track.html?id=${inspectionId}`;
        },

        sendWhatsApp: function (phone, message) {
            const cleanPhone = this.formatPhone(phone);
            if (!cleanPhone) {
                alert('يرجى التأكد من إدخال رقم جوال العميل أولاً');
                return;
            }
            const encodedText = encodeURIComponent(message);
            const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
            window.open(url, '_blank');
        },

        sendQuotation: function (cust) {
            const appName = APP_CONFIG.getAppName();
            const trackUrl = this.getTrackingUrl(cust.id);
            const car = `${cust.car_type || ''} ${cust.car_model || ''}`.trim() || 'السيارة';
            const plate = cust.plate_number ? `(لوحة: ${cust.plate_number})` : '';
            const total = cust.final_amount || cust.total_amount || 0;

            const msg = `مرحباً بك أستاذ ${cust.customer_name || 'العميل العزيز'} 🌹\n\nنرفق لك كشف التسعيرة الفني لـ ${car} ${plate} من *${appName}*.\n\n💰 *إجمالي التسعيرة:* ${total} ريال\n\n📋 *لمعاينة بنود التسعيرة وتفاصيل الكشف أونلاين:*\n${trackUrl}\n\nنسعد بخدمتكم وتأكيد البدء بالعمل!`;
            this.sendWhatsApp(cust.customer_phone, msg);
        },

        sendWorkInProgress: function (cust) {
            const appName = APP_CONFIG.getAppName();
            const trackUrl = this.getTrackingUrl(cust.id);
            const car = `${cust.car_type || ''} ${cust.car_model || ''}`.trim() || 'السيارة';
            const plate = cust.plate_number ? `(لوحة: ${cust.plate_number})` : '';

            const msg = `مرحباً أستاذ ${cust.customer_name || 'العميل العزيز'} ⚙️\n\nنفيدكم ببدء أعمال الصيانة على ${car} ${plate} لدى *${appName}*.\n\n🚗 *يمكنكم متابعة مرحلة صيانة سيارتكم والصور لحظة بلحظة عبر الرابط التالي:*\n${trackUrl}\n\nشكراً لثقتكم بنا!`;
            this.sendWhatsApp(cust.customer_phone, msg);
        },

        sendReadyForDelivery: function (cust) {
            const appName = APP_CONFIG.getAppName();
            const trackUrl = this.getTrackingUrl(cust.id);
            const car = `${cust.car_type || ''} ${cust.car_model || ''}`.trim() || 'السيارة';
            const plate = cust.plate_number ? `(لوحة: ${cust.plate_number})` : '';
            const remaining = cust.remaining_amount !== undefined ? cust.remaining_amount : (cust.final_amount || 0);

            const msg = `يسعدنا إبلاغك أستاذ ${cust.customer_name || 'العميل العزيز'} بأن سيارتك ${car} ${plate} أصبحت *جاهزة للتسليم* ✅ في *${appName}*.\n\n💵 *المبلغ المتبقي:* ${remaining} ريال\n\n📄 *تقرير الفحص والصور النهائية:*\n${trackUrl}\n\nنسعد بزيارتكم لاستلام السيارة! 🚗💨`;
            this.sendWhatsApp(cust.customer_phone, msg);
        },

        showModal: function (cust) {
            let modal = document.getElementById('atenzaWhatsAppModal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'atenzaWhatsAppModal';
                modal.className = 'atenza-wa-modal no-print';
                document.body.appendChild(modal);
            }

            modal.innerHTML = `
                <div class="atenza-wa-backdrop" onclick="document.getElementById('atenzaWhatsAppModal').style.display='none'"></div>
                <div class="atenza-wa-content">
                    <div class="atenza-wa-header">
                        <h3>💬 أتمتة رسائل الواتساب للعميل</h3>
                        <button type="button" class="atenza-wa-close" onclick="document.getElementById('atenzaWhatsAppModal').style.display='none'">&times;</button>
                    </div>
                    <div class="atenza-wa-body">
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px 14px; margin-bottom:15px; font-size:13px;">
                            <div>👤 العميل: <strong>${cust.customer_name || 'بدون اسم'}</strong></div>
                            <div>📱 الجوال: <strong dir="ltr">${cust.customer_phone || 'غير مسجل'}</strong></div>
                            <div>🚗 السيارة: <strong>${cust.car_type || ''} ${cust.car_model || ''} (${cust.plate_number || ''})</strong></div>
                        </div>
                        <div class="atenza-wa-options">
                            <button type="button" class="atenza-wa-btn atenza-wa-quote" id="waBtnQuote">
                                <span class="wa-icon">📋</span>
                                <div class="wa-text">
                                    <strong>إرسال التسعيرة / الكشف</strong>
                                    <small>إرسال رابط التسعيرة والمبلغ الإجمالي</small>
                                </div>
                            </button>
                            <button type="button" class="atenza-wa-btn atenza-wa-progress" id="waBtnProgress">
                                <span class="wa-icon">⚙️</span>
                                <div class="wa-text">
                                    <strong>إشعار بدء العمل ورابط المتابعة</strong>
                                    <small>إبلاغ العميل ببدء الصيانة ورابط البوابة</small>
                                </div>
                            </button>
                            <button type="button" class="atenza-wa-btn atenza-wa-ready" id="waBtnReady">
                                <span class="wa-icon">✅</span>
                                <div class="wa-text">
                                    <strong>إشعار جاهزية السيارة للتسليم</strong>
                                    <small>إشعار باكتمال العمل والمبلغ المتبقي</small>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.getElementById('waBtnQuote').onclick = () => {
                this.sendQuotation(cust);
                modal.style.display = 'none';
            };
            document.getElementById('waBtnProgress').onclick = () => {
                this.sendWorkInProgress(cust);
                modal.style.display = 'none';
            };
            document.getElementById('waBtnReady').onclick = () => {
                this.sendReadyForDelivery(cust);
                modal.style.display = 'none';
            };

            modal.style.display = 'flex';
        }
    };

    /**
     * 🔔 Real-time Audio & Live Alert Manager (Atenza App)
     */
    const APP_NOTIFIER = {
        audioCtx: null,
        playChime: function () {
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (!AudioContext) return;
                if (!this.audioCtx) this.audioCtx = new AudioContext();
                if (this.audioCtx.state === 'suspended') {
                    this.audioCtx.resume();
                }
                const now = this.audioCtx.currentTime;
                const osc1 = this.audioCtx.createOscillator();
                const gain1 = this.audioCtx.createGain();
                osc1.type = 'sine';
                osc1.frequency.setValueAtTime(587.33, now); // D5
                osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5
                gain1.gain.setValueAtTime(0.3, now);
                gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
                osc1.connect(gain1);
                gain1.connect(this.audioCtx.destination);
                osc1.start(now);
                osc1.stop(now + 0.35);
            } catch (e) {
                console.warn('Audio chime error:', e);
            }
        },

        initLiveWatcher: function () {
            const user = APP_PERMISSIONS.getUser();
            if (!user || (!user.role && !user.employee_id)) return;

            let lastSeenId = Number(localStorage.getItem('last_seen_notif_id') || 0);

            const check = async () => {
                try {
                    let url = '/api/sys_notifications?';
                    if (user.role === 'admin') {
                        url += 'recipient_type=admin';
                    } else if (user.employee_id || user.id) {
                        url += `recipient_type=employee&recipient_id=${user.employee_id || user.id}`;
                    } else {
                        return;
                    }

                    const res = await fetch(url);
                    if (!res.ok) return;
                    const notifs = await res.json();
                    if (!Array.isArray(notifs)) return;

                    const unread = notifs.filter(n => !n.is_read && n.id > lastSeenId);
                    if (unread.length > 0) {
                        const newest = unread[0];
                        lastSeenId = Math.max(...unread.map(n => n.id));
                        localStorage.setItem('last_seen_notif_id', lastSeenId);

                        // Play chime
                        this.playChime();

                        // Show Toast Alert
                        if (typeof Toast !== 'undefined' && Toast.show) {
                            Toast.show({
                                title: newest.title || 'إشعار جديد 🔔',
                                message: newest.message || '',
                                type: newest.type || 'info',
                                duration: 8000
                            });
                        }
                    }
                } catch (e) { }
            };

            setInterval(check, 6000);
            setTimeout(check, 1000);
        }
    };

    // Expose globally
    global.APP_CONFIG = APP_CONFIG;
    global.APP_PERMISSIONS = APP_PERMISSIONS;
    global.APP_NAV = APP_NAV;
    global.APP_WHATSAPP = APP_WHATSAPP;
    global.APP_NOTIFIER = APP_NOTIFIER;

    // Automatic startup when DOM is ready
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () {
                APP_CONFIG.initBranding();
                if (document.getElementById('atenzaNavbar')) {
                    APP_NAV.renderNavbar('#atenzaNavbar');
                }
                APP_NOTIFIER.initLiveWatcher();
            });
        } else {
            APP_CONFIG.initBranding();
            if (document.getElementById('atenzaNavbar')) {
                APP_NAV.renderNavbar('#atenzaNavbar');
            }
            APP_NOTIFIER.initLiveWatcher();
        }
    }

})(typeof window !== 'undefined' ? window : globalThis);
