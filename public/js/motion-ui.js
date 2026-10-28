/**
 * 🎨 Framer Motion UI Integration for Atenza Workshop Manager
 * Powered by Framer's official Motion engine (window.Motion)
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.MotionUI = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {

    // Spring physics configuration presets
    const SPRINGS = {
        gentle: { type: 'spring', stiffness: 220, damping: 22, mass: 1 },
        snappy: { type: 'spring', stiffness: 380, damping: 28, mass: 0.8 },
        bouncy: { type: 'spring', stiffness: 450, damping: 18, mass: 1 },
        subtle: { duration: 0.28, ease: [0.25, 1, 0.5, 1] }
    };

    function isMotionAvailable() {
        return typeof window.Motion !== 'undefined' && typeof window.Motion.animate === 'function';
    }

    const MotionUI = {
        /**
         * Initialize page animations (Card entrances, Topbar, KPI stat cards)
         */
        initPageAnimations: function () {
            if (!isMotionAvailable()) {
                console.warn('[MotionUI] Motion engine not yet loaded, waiting...');
                window.addEventListener('DOMContentLoaded', () => MotionUI.initPageAnimations());
                return;
            }

            try {
                const { animate, stagger } = window.Motion;

                // Animate Top Header / Navbar
                const header = document.querySelector('.top-header, .header-container, .top-bar, .app-header');
                if (header) {
                    animate(header, { opacity: [0, 1], y: [-15, 0] }, SPRINGS.snappy);
                }

                // Animate Cards with gentle stagger
                const cards = document.querySelectorAll('.card, .stat-card, .kpi-card, .info-card, .data-card');
                if (cards && cards.length > 0) {
                    animate(
                        cards,
                        { opacity: [0, 1], y: [20, 0], scale: [0.97, 1] },
                        {
                            delay: stagger(0.04),
                            ...SPRINGS.gentle
                        }
                    );
                }

                // Animate Main Container
                const main = document.querySelector('.main-content, .page-container, .container, .dashboard-container');
                if (main && !main.classList.contains('motion-ready')) {
                    main.classList.add('motion-ready');
                    animate(main, { opacity: [0, 1] }, { duration: 0.3, ease: 'easeOut' });
                }

                // Interactive Buttons Micro-Bounce
                this.bindButtonEffects();

            } catch (err) {
                console.warn('[MotionUI] Page animation notice:', err.message);
            }
        },

        /**
         * Micro-interaction on buttons and clickable cards
         */
        bindButtonEffects: function () {
            if (!isMotionAvailable()) return;
            const { animate } = window.Motion;

            document.querySelectorAll('.btn, button:not(.no-motion), .nav-item').forEach(btn => {
                if (btn.__hasMotionBound) return;
                btn.__hasMotionBound = true;

                btn.addEventListener('pointerdown', () => {
                    animate(btn, { scale: 0.95 }, { duration: 0.1 });
                });

                const resetBtn = () => {
                    animate(btn, { scale: 1 }, SPRINGS.snappy);
                };

                btn.addEventListener('pointerup', resetBtn);
                btn.addEventListener('pointercancel', resetBtn);
                btn.addEventListener('pointerleave', resetBtn);
            });
        },

        /**
         * Smooth Spring Modal Open Animation
         */
        animateModalOpen: function (modalElement) {
            if (!modalElement) return;
            modalElement.style.display = 'flex';

            if (!isMotionAvailable()) return;
            const { animate } = window.Motion;

            const content = modalElement.querySelector('.modal-content') || modalElement.firstElementChild;
            if (content) {
                // Animate overlay backdrop
                animate(modalElement, { opacity: [0, 1] }, { duration: 0.22, ease: 'easeOut' });
                // Animate modal popup with spring physics
                animate(
                    content,
                    { opacity: [0, 1], scale: [0.88, 1], y: [25, 0] },
                    SPRINGS.bouncy
                );
            }
        },

        /**
         * Smooth Modal Close Animation
         */
        animateModalClose: function (modalElement, onClosed) {
            if (!modalElement) return;

            if (!isMotionAvailable()) {
                modalElement.style.display = 'none';
                if (typeof onClosed === 'function') onClosed();
                return;
            }

            const { animate } = window.Motion;
            const content = modalElement.querySelector('.modal-content') || modalElement.firstElementChild;

            if (content) {
                const anim = animate(
                    content,
                    { opacity: [1, 0], scale: [1, 0.92], y: [0, 15] },
                    { duration: 0.18, ease: 'easeIn' }
                );
                animate(modalElement, { opacity: [1, 0] }, { duration: 0.2, ease: 'easeIn' });

                anim.finished.then(() => {
                    modalElement.style.display = 'none';
                    if (typeof onClosed === 'function') onClosed();
                });
            } else {
                modalElement.style.display = 'none';
                if (typeof onClosed === 'function') onClosed();
            }
        },

        /**
         * Smooth Number Counter Animation (for KPI numbers on Dashboard)
         */
        animateNumber: function (element, targetValue, duration = 1.0, formatter = null) {
            if (!element) return;
            const rawText = (element.innerText || '').replace(/[^0-9.-]/g, '');
            const startVal = parseFloat(rawText) || 0;
            const endVal = parseFloat(targetValue) || 0;

            const format = (v) => {
                if (typeof formatter === 'function') return formatter(v);
                return Math.round(v).toLocaleString('ar-SA');
            };

            // Set final text immediately as fallback in case animation cannot run
            element.innerText = format(endVal);

            if (startVal === endVal || isNaN(endVal)) return;

            const startTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
            const durMs = Math.max(200, duration * 1000);
            const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

            function step(now) {
                const elapsed = now - startTime;
                const progress = Math.min(1, elapsed / durMs);
                const current = startVal + (endVal - startVal) * easeOutCubic(progress);

                element.innerText = format(progress >= 1 ? endVal : current);

                if (progress < 1) {
                    requestAnimationFrame(step);
                }
            }

            requestAnimationFrame(step);
        },

        /**
         * Animate Toast notification entrance with spring bounce
         */
        animateToast: function (toastElement) {
            if (!toastElement || !isMotionAvailable()) return;
            const { animate } = window.Motion;
            animate(
                toastElement,
                { opacity: [0, 1], y: [-20, 0], scale: [0.9, 1] },
                SPRINGS.bouncy
            );
        }
    };

    // Auto-initialize on load if document is already ready
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(() => MotionUI.initPageAnimations(), 50);
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => MotionUI.initPageAnimations(), 50);
        });
    }

    return MotionUI;
}));
