window.ArenaUI = (() => {
    const clockEl = () => document.getElementById('clock');

    function updateClock() {
        const el = clockEl();
        if (!el) return;
        const now = new Date();
        el.textContent = now.toLocaleTimeString('en-GB', { hour12: false }) + ' UTC';
    }

    function debounce(fn, delay = 280) {
        let t;
        return (...args) => {
            clearTimeout(t);
            t = setTimeout(() => fn(...args), delay);
        };
    }

    function escapeHtml(text = '') {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function truncate(text = '', max = 1200) {
        return text.length > max ? text.slice(0, max) + '\n…[truncated]' : text;
    }

    function copyText(text, triggerEl) {
        return navigator.clipboard.writeText(text || '').then(() => {
            if (!triggerEl) return;
            const original = triggerEl.innerHTML;
            triggerEl.innerHTML = '<i class="bi bi-clipboard-check"></i> Copied';
            setTimeout(() => { triggerEl.innerHTML = original; }, 1500);
        });
    }

    function dismissFlashes(ms = 4500) {
        setTimeout(() => {
            document.querySelectorAll('.flash-container .alert').forEach(el => {
                const inst = bootstrap.Alert.getOrCreateInstance(el);
                inst.close();
            });
        }, ms);
    }

    function initSidebarToggle() {
        const btn = document.getElementById('sidebarToggle');
        if (!btn) return;
        btn.addEventListener('click', () => {
            document.body.classList.toggle('sidebar-open');
        });
    }

    function initTeamDots() {
        document.querySelectorAll('.team-dot[data-color]').forEach(dot => {
            const color = (dot.dataset.color || '').trim();
            if (/^#[0-9a-fA-F]{6}$/.test(color)) {
                dot.style.background = color;
            }
        });
    }

    function initBars() {
        document.querySelectorAll('.score-bar-fill[data-width]').forEach(bar => {
            const width = Math.max(0, Math.min(100, Number(bar.dataset.width || 0)));
            bar.style.width = `${width}%`;

            if (bar.dataset.health === '1') {
                bar.style.background = width > 70 ? '#22c55e' : width > 40 ? '#f59e0b' : '#ef4444';
            }
        });

        document.querySelectorAll('.progress-bar[data-width]').forEach(bar => {
            const width = Math.max(0, Math.min(100, Number(bar.dataset.width || 0)));
            bar.style.width = `${width}%`;
        });
    }

    function startPolling(fn, ms = 8000) {
        fn();
        return setInterval(fn, ms);
    }

    async function safeFetch(url, options = {}) {
        const timeout = options.timeout || 10000;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        try {
            const resp = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timer);
            if (!resp.ok) {
                console.error(`[safeFetch] ${url} returned ${resp.status}`);
                return null;
            }
            const ct = resp.headers.get('content-type') || '';
            if (!ct.includes('application/json')) {
                console.error(`[safeFetch] ${url} returned non-JSON: ${ct}`);
                return null;
            }
            return await resp.json();
        } catch (err) {
            clearTimeout(timer);
            if (err.name === 'AbortError') {
                console.error(`[safeFetch] ${url} timed out after ${timeout}ms`);
            } else {
                console.error(`[safeFetch] ${url} failed:`, err.message);
            }
            return null;
        }
    }

    return {
        updateClock,
        debounce,
        escapeHtml,
        truncate,
        copyText,
        dismissFlashes,
        initSidebarToggle,
        initTeamDots,
        initBars,
        startPolling,
        safeFetch,
    };
})();

ArenaUI.updateClock();
setInterval(ArenaUI.updateClock, 1000);
ArenaUI.dismissFlashes();
ArenaUI.initSidebarToggle();
    ArenaUI.initTeamDots();
    ArenaUI.initBars();
