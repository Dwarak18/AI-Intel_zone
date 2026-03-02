// =============================================================================
// AI INTELLIGENCE ZONE — Control Arena
// Live Scores — Socket.IO + polling live updater
// =============================================================================

const LiveScores = (() => {
    let passwordsVisible = false;
    let socket = null;

    // ── Row template (used when Socket.IO pushes an update) ──────
    function rankBadge(rank) {
        if (rank === 1) return '<span class="badge bg-warning text-dark">🥇</span>';
        if (rank === 2) return '<span class="badge bg-secondary">🥈</span>';
        if (rank === 3) return '<span class="badge bg-danger">🥉</span>';
        return `<span class="text-muted fw-bold">#${rank || '—'}</span>`;
    }

    function statusBadge(status) {
        if (status === 'active') return '<span class="badge bg-success">Active</span>';
        if (status === 'locked') return '<span class="badge bg-warning text-dark">Locked</span>';
        return '<span class="badge bg-danger">DQ</span>';
    }

    function buildRow(t, idx) {
        const rank      = t.rank || (idx + 1);
        const vr        = Number(t.validationRate || 0).toFixed(1);
        const hs        = Number(t.healthScore || 0);
        const hc        = hs > 70 ? '#22c55e' : hs > 40 ? '#f59e0b' : '#ef4444';
        const combined  = (Number(t.totalScore || 0) + Number(t.bonusPoints || 0)).toFixed(2);
        const pwMask    = passwordsVisible
            ? `<span class="font-monospace small">${ArenaUI.escapeHtml(t.loginPassword || '')}</span>`
            : `<span class="pw-mask text-muted font-monospace">••••••••</span>`;

        return `
        <tr data-team-id="${ArenaUI.escapeHtml(t.id || '')}" data-status="${t.status}">
            <td class="text-center fw-bold font-monospace">${rankBadge(rank)}</td>
            <td><span class="badge bg-primary font-monospace">${ArenaUI.escapeHtml(t.teamCode)}</span></td>
            <td>
                <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${t.avatarColor};margin-right:6px;"></span>
                <strong>${ArenaUI.escapeHtml(t.name)}</strong>
            </td>
            <td>${pwMask}</td>
            <td class="font-monospace text-info fw-bold">${Number(t.totalScore || 0).toFixed(2)}</td>
            <td class="font-monospace text-success small">+${Number(t.bonusPoints || 0).toFixed(1)}</td>
            <td class="font-monospace fw-bold" style="color:#a5b4fc;">${combined}</td>
            <td>${t.missionsCompleted || 0}</td>
            <td>${t.totalSubmissions || 0}</td>
            <td>
                <div class="d-flex align-items-center gap-1">
                    <div class="score-bar" style="width:50px;">
                        <div class="score-bar-fill" style="width:${vr}%"></div>
                    </div>
                    <span class="small">${vr}%</span>
                </div>
            </td>
            <td>
                <div class="score-bar" style="width:50px;">
                    <div class="score-bar-fill" style="width:${hs}%;background:${hc}"></div>
                </div>
            </td>
            <td>${statusBadge(t.status)}</td>
            <td>
                <div class="d-flex gap-1">
                    <a href="/admin/teams" class="btn btn-xs btn-outline-secondary" title="Manage"><i class="bi bi-pencil"></i></a>
                </div>
            </td>
        </tr>`;
    }

    // ── Render full table from data[] ────────────────────────────
    function renderTable(teams) {
        const tbody = document.getElementById('live-scores-body');
        if (!tbody) return;

        if (!teams || teams.length === 0) {
            tbody.innerHTML = '<tr><td colspan="13" class="text-center text-muted py-5">No teams registered yet.</td></tr>';
            return;
        }

        tbody.innerHTML = teams.map((t, i) => buildRow(t, i)).join('');
        ArenaUI.initBars && ArenaUI.initBars();

        // Stats bar
        const total  = teams.length;
        const active = teams.filter(t => t.status === 'active').length;
        const locked = teams.filter(t => t.status === 'locked').length;
        const dq     = teams.filter(t => t.status === 'disqualified').length;
        const el = id => document.getElementById(id);
        if (el('stat-total'))  el('stat-total').textContent  = total;
        if (el('stat-active')) el('stat-active').textContent = active;
        if (el('stat-locked')) el('stat-locked').textContent = locked;
        if (el('stat-dq'))     el('stat-dq').textContent     = dq;
    }

    // ── Timestamp ────────────────────────────────────────────────
    function setUpdated() {
        const el = document.getElementById('last-updated');
        if (el) el.textContent = 'Updated ' + new Date().toLocaleTimeString();
    }

    // ── Fetch from REST API ──────────────────────────────────────
    async function refresh() {
        const data = await ArenaUI.safeFetch('/admin/api/live-scores');
        if (!data) return;
        renderTable(data.teams || []);
        setUpdated();
    }

    // ── Toggle passwords ─────────────────────────────────────────
    function togglePasswords() {
        passwordsVisible = !passwordsVisible;
        const icon = document.getElementById('pw-eye-icon');
        if (icon) {
            icon.className = passwordsVisible ? 'bi bi-eye' : 'bi bi-eye-slash';
        }
        // Re-render or toggle DOM
        document.querySelectorAll('.pw-cell').forEach(cell => {
            const mask = cell.querySelector('.pw-mask');
            const text = cell.querySelector('.pw-text');
            if (mask) mask.classList.toggle('d-none', passwordsVisible);
            if (text) text.classList.toggle('d-none', !passwordsVisible);
        });

        if (passwordsVisible) {
            // Rows built dynamically won't have pw-mask/pw-text — refresh to rebuild
            refresh();
        }
    }

    // ── Socket.IO connection ─────────────────────────────────────
    function connectSocket() {
        if (typeof io === 'undefined') {
            console.warn('LiveScores: Socket.IO not loaded, using polling only');
            return;
        }

        try {
            socket = io('/admin', { transports: ['websocket', 'polling'] });

            socket.on('connect', () => {
                const badge = document.getElementById('ws-badge');
                if (badge) {
                    badge.className = 'badge bg-success';
                    badge.innerHTML = '<i class="bi bi-wifi"></i> Live';
                }
            });

            socket.on('disconnect', () => {
                const badge = document.getElementById('ws-badge');
                if (badge) {
                    badge.className = 'badge bg-secondary';
                    badge.innerHTML = '<i class="bi bi-wifi-off"></i> Disconnected';
                }
            });

            // Receive live score push from server
            socket.on('live_scores_update', (payload) => {
                if (payload && payload.teams) {
                    renderTable(payload.teams);
                    setUpdated();
                }
            });

        } catch (err) {
            console.warn('LiveScores socket error:', err);
        }
    }

    // ── Init ─────────────────────────────────────────────────────
    function init() {
        connectSocket();
        // Fallback polling every 10s (catches updates if socket misses something)
        ArenaUI.startPolling(refresh, 10000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return { refresh, togglePasswords };
})();
