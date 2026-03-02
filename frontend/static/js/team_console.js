(() => {
    document.addEventListener('DOMContentLoaded', () => {
        const DEBUG = window.location.search.includes('debug=1');
        const log = (...a) => { if (DEBUG) console.log('[TeamConsole]', ...a); };

        // ── DOM refs ──────────────────────────────────────────────────
        const missionSelect     = document.getElementById('missionSelect');
        const promptEditor      = document.getElementById('promptEditor');
        const promptLength      = document.getElementById('promptLength');
        const aiResponseEditor  = document.getElementById('aiResponseEditor');
        const jsonStatus        = document.getElementById('jsonStatus');
        const submitBtn         = document.getElementById('submitPromptBtn');
        const sandboxBtn        = document.getElementById('sandboxBtn');
        const formatJsonBtn     = document.getElementById('formatJsonBtn');
        const feedbackBox       = document.getElementById('feedbackBox');
        const feedbackContent   = document.getElementById('feedbackContent');
        const scoreLine         = document.getElementById('scoreLine');
        const scoreValue        = document.getElementById('scoreValue');
        const confidenceValue   = document.getElementById('confidenceValue');
        const historyBody       = document.getElementById('submissionHistoryBody');
        const historyLabel      = document.getElementById('historyMissionLabel');
        const cooldownTimer     = document.getElementById('cooldownTimer');
        // Brief panel elements
        const missionCode       = document.getElementById('missionCode');
        const missionTitle      = document.getElementById('missionTitle');
        const difficultyBadge   = document.getElementById('difficultyBadge');
        const attemptsBadge     = document.getElementById('attemptsBadge');
        const briefBody         = document.getElementById('briefBody');

        if (!submitBtn || !aiResponseEditor) {
            console.error('[TeamConsole] Required DOM elements missing. Console disabled.');
            return;
        }

        // ── State ─────────────────────────────────────────────────────
        let allMissions = [];       // full mission objects from /api/missions
        let currentMission = null;  // currently selected mission object
        let jsonValid = false;      // tracks real-time JSON validity
        let cooldownEnd = 0;        // epoch ms when cooldown expires

        // ── CSRF / auth helpers ───────────────────────────────────────
        function getCsrf() {
            const m = document.querySelector('meta[name="csrf-token"]');
            return m ? m.content : '';
        }

        function authHeaders(isPost = false) {
            const token = localStorage.getItem('arena_jwt_token');
            const h = { 'Accept': 'application/json' };
            if (isPost) h['Content-Type'] = 'application/json';
            if (token)            h['Authorization'] = `Bearer ${token}`;
            else if (isPost) {
                const c = getCsrf();
                if (c) h['X-CSRFToken'] = c;
            }
            return h;
        }

        // ── Real-time JSON validator ──────────────────────────────────
        function updateJsonStatus() {
            const raw = (aiResponseEditor.value || '').trim();
            if (!raw) {
                jsonStatus.className = 'json-status empty';
                jsonStatus.textContent = '✦ Paste JSON here';
                jsonValid = false;
                submitBtn.disabled = true;
                return;
            }
            try {
                JSON.parse(raw);
                jsonStatus.className = 'json-status valid';
                jsonStatus.textContent = '✅ Valid JSON';
                jsonValid = true;
                submitBtn.disabled = (cooldownEnd > Date.now());
            } catch {
                jsonStatus.className = 'json-status invalid';
                jsonStatus.textContent = '❌ Invalid JSON — fix before submitting';
                jsonValid = false;
                submitBtn.disabled = true;
            }
        }

        aiResponseEditor.addEventListener('input', updateJsonStatus);

        // ── Format (pretty-print) button ──────────────────────────────
        if (formatJsonBtn) {
            formatJsonBtn.addEventListener('click', () => {
                try {
                    const parsed = JSON.parse(aiResponseEditor.value);
                    aiResponseEditor.value = JSON.stringify(parsed, null, 2);
                    updateJsonStatus();
                } catch {
                    // leave as-is
                }
            });
        }

        // ── Prompt length counter ─────────────────────────────────────
        promptEditor.addEventListener('input', () => {
            promptLength.textContent = String((promptEditor.value || '').length);
        });

        // ── Cooldown timer ────────────────────────────────────────────
        let cooldownInterval = null;
        function startCooldown(seconds) {
            cooldownEnd = Date.now() + seconds * 1000;
            submitBtn.disabled = true;
            cooldownTimer.classList.remove('d-none');
            if (cooldownInterval) clearInterval(cooldownInterval);
            cooldownInterval = setInterval(() => {
                const left = Math.ceil((cooldownEnd - Date.now()) / 1000);
                if (left <= 0) {
                    clearInterval(cooldownInterval);
                    cooldownTimer.classList.add('d-none');
                    if (jsonValid) submitBtn.disabled = false;
                } else {
                    cooldownTimer.textContent = `Cooldown: ${String(left).padStart(2, '0')}s`;
                }
            }, 250);
        }

        // ── Mission brief renderer ────────────────────────────────────
        const DIFF_COLOURS = {
            easy: 'badge-valid',
            medium: 'badge-info',
            hard: 'badge-error',
            legendary: 'badge-error',
        };

        function renderBrief(m) {
            if (!m) {
                missionCode.textContent = '—';
                missionTitle.textContent = 'Select a Mission';
                difficultyBadge.className = 'badge badge-valid ms-auto me-2 d-none';
                attemptsBadge.className = 'attempt-badge';
                attemptsBadge.textContent = '0 / 0 attempts';
                briefBody.innerHTML = '<p class="text-muted small mt-2">↑ Choose a mission from the dropdown above.</p>';
                return;
            }

            missionCode.textContent = m.mission_code || '—';
            missionTitle.textContent = m.title || '—';
            difficultyBadge.className = `badge ${DIFF_COLOURS[m.difficulty] || 'badge-valid'} ms-auto me-2`;
            difficultyBadge.textContent = (m.difficulty || '').toUpperCase();

            const maxA = m.max_retries || '∞';
            const usedA = m._attempts_used || 0;
            const left  = typeof maxA === 'number' ? maxA - usedA : '∞';
            attemptsBadge.textContent = `${usedA} / ${maxA} attempts`;
            attemptsBadge.className = 'attempt-badge' +
                (typeof left === 'number' && left <= 3 ? ' danger' :
                 typeof left === 'number' && left <= 6 ? ' warn' : '');

            // ── Build brief HTML ──────────────────────────────────────
            let html = '';

            // Objective
            if (m.objective) {
                html += `
                <div class="mb-3">
                    <div class="text-muted small fw-semibold mb-1">🎯 OBJECTIVE</div>
                    <p class="small mb-0">${escHtml(m.objective)}</p>
                </div>`;
            }

            // Input text (copy-on-click)
            if (m.input_text) {
                html += `
                <div class="mb-3">
                    <div class="text-muted small fw-semibold mb-1">
                        📄 ANALYZE THIS TEXT
                        <span class="copy-hint">click to copy</span>
                    </div>
                    <div class="input-text-box" id="inputTextBox" title="Click to copy">
                        ${escHtml(m.input_text)}
                    </div>
                </div>`;
            }

            // Format hint
            if (m.output_format_hint) {
                html += `
                <div class="mb-3">
                    <div class="text-muted small fw-semibold mb-1">📐 FORMAT RULES</div>
                    <p class="small mb-0 text-muted">${escHtml(m.output_format_hint)}</p>
                </div>`;
            }

            // Enum constraints
            if (m.enum_constraints && Object.keys(m.enum_constraints).length) {
                const rows = Object.entries(m.enum_constraints)
                    .map(([f, vals]) =>
                        `<tr><td class="pe-2 text-primary small">${escHtml(f)}</td>` +
                        `<td class="small">${vals.map(v => `<code>${escHtml(String(v))}</code>`).join(' | ')}</td></tr>`)
                    .join('');
                html += `
                <div class="mb-3">
                    <div class="text-muted small fw-semibold mb-1">🔒 ALLOWED VALUES</div>
                    <table class="w-100">${rows}</table>
                </div>`;
            }

            // Valid / invalid example tabs
            const hasV = !!m.valid_example;
            const hasI = !!m.invalid_example;
            if (hasV || hasI) {
                let vJson = '', iJson = '';
                try { vJson = m.valid_example ? JSON.stringify(JSON.parse(m.valid_example), null, 2) : ''; } catch { vJson = m.valid_example || ''; }
                try { iJson = m.invalid_example ? JSON.stringify(JSON.parse(m.invalid_example), null, 2) : ''; } catch { iJson = m.invalid_example || ''; }

                const tabV = hasV ? `<button class="nav-link ${hasV ? 'active' : ''}" data-tab="valid">✅ Valid</button>` : '';
                const tabI = hasI ? `<button class="nav-link" data-tab="invalid">❌ Invalid</button>` : '';
                const blkV = hasV ? `<pre class="example-block valid-example" id="exBlock-valid">${escHtml(vJson)}</pre>` : '';
                const blkI = hasI ? `<pre class="example-block invalid-example d-none" id="exBlock-invalid">${escHtml(iJson)}</pre>` : '';

                html += `
                <div class="mb-2">
                    <div class="text-muted small fw-semibold mb-1">💡 EXAMPLES</div>
                    <nav class="d-flex gap-1 example-tabs mb-0" id="exampleTabs">${tabV}${tabI}</nav>
                    ${blkV}${blkI}
                </div>`;
            }

            briefBody.innerHTML = html;

            // copy input-text box
            const itBox = document.getElementById('inputTextBox');
            if (itBox) {
                itBox.addEventListener('click', () => {
                    navigator.clipboard?.writeText(m.input_text).then(() => {
                        const hint = itBox.querySelector('.copy-hint') || itBox;
                        const prev = hint.textContent;
                        hint.textContent = '✅ Copied!';
                        setTimeout(() => { hint.textContent = prev; }, 1500);
                    });
                });
            }

            // example tabs toggle
            const tabNav = document.getElementById('exampleTabs');
            if (tabNav) {
                tabNav.querySelectorAll('.nav-link').forEach(btn => {
                    btn.addEventListener('click', () => {
                        tabNav.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        const tab = btn.dataset.tab;
                        ['valid', 'invalid'].forEach(k => {
                            const el = document.getElementById(`exBlock-${k}`);
                            if (el) el.classList.toggle('d-none', k !== tab);
                        });
                    });
                });
            }
        }

        // ── Mission select change ─────────────────────────────────────
        missionSelect.addEventListener('change', () => {
            const id = missionSelect.value;
            currentMission = allMissions.find(m => String(m.id) === String(id)) || null;
            renderBrief(currentMission);
            if (historyLabel) historyLabel.textContent = currentMission
                ? `${currentMission.mission_code} — ${currentMission.title}`
                : '— no mission selected —';
            loadHistory(id);
        });

        // ── Mission loader ────────────────────────────────────────────
        async function loadMissions() {
            try {
                const res = await fetch('/api/missions', {
                    headers: authHeaders(false),
                    credentials: 'same-origin',
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                allMissions = Array.isArray(data?.missions) ? data.missions : [];
                if (!allMissions.length) {
                    missionSelect.innerHTML = '<option value="">No active missions</option>';
                    return;
                }
                missionSelect.innerHTML =
                    '<option value="">— pick a mission —</option>' +
                    allMissions.map(m =>
                        `<option value="${m.id}">${escHtml(m.mission_code)} — ${escHtml(m.title)}</option>`
                    ).join('');
                log('Missions loaded:', allMissions.length);
            } catch (err) {
                console.error('[TeamConsole] Mission load error', err);
                missionSelect.innerHTML = '<option value="">Could not load missions</option>';
            }
        }

        // ── History loader ────────────────────────────────────────────
        async function loadHistory(missionId) {
            if (!historyBody) return;
            historyBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">Loading…</td></tr>';
            if (!missionId) {
                historyBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Select a mission to see history.</td></tr>';
                return;
            }
            try {
                const res = await fetch(`/api/missions/${missionId}/history`, {
                    headers: authHeaders(false),
                    credentials: 'same-origin',
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                const subs = Array.isArray(data?.submissions) ? data.submissions : [];
                if (!subs.length) {
                    historyBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No submissions yet for this mission.</td></tr>';
                    return;
                }
                historyBody.innerHTML = '';
                subs.forEach((s, i) => renderHistoryRow(s, i + 1));
                // update attempt counter on mission object
                if (currentMission) {
                    currentMission._attempts_used = subs.length;
                    renderBrief(currentMission);
                }
            } catch (err) {
                log('History load error', err);
                historyBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Could not load history.</td></tr>';
            }
        }

        function renderHistoryRow(s, attempt) {
            const status = s.validation_status || 'unknown';
            const cls = status === 'valid' ? 'badge-valid' : status === 'invalid' ? 'badge-invalid' : 'badge-error';
            const reason = s.failure_reason || s.error_message || '—';
            const time = s.created_at
                ? new Date(s.created_at).toLocaleTimeString('en-GB')
                : '—';
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="text-muted small">#${attempt}</td>
                <td class="small">${escHtml(time)}</td>
                <td><span class="badge ${cls}">${escHtml(status.toUpperCase())}</span></td>
                <td class="small">${s.score_awarded ? Number(s.score_awarded).toFixed(1) : '—'}</td>
                <td class="small">${s.confidence_score ? Number(s.confidence_score).toFixed(3) : '—'}</td>
                <td class="history-reason">${escHtml(reason)}</td>
            `;
            historyBody.appendChild(row);
        }

        function prependHistoryRow(result, isSandbox) {
            if (!historyBody) return;
            const placeholder = historyBody.querySelector('td[colspan]');
            if (placeholder) historyBody.innerHTML = '';

            const v    = result?.validation || {};
            const sc   = result?.score || {};
            const status = result?.status || v?.overall_status || 'unknown';
            const cls  = status === 'valid' ? 'badge-valid' : status === 'invalid' ? 'badge-invalid' : 'badge-error';
            const reason = Array.isArray(v?.errors) ? v.errors.slice(0, 2).join('; ') : (v?.feedback || '—');
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="text-muted small">${isSandbox ? '🧪' : '#—'}</td>
                <td class="small">${new Date().toLocaleTimeString('en-GB')}</td>
                <td><span class="badge ${cls}">${isSandbox ? '🧪 ' : ''}${escHtml(status.toUpperCase())}</span></td>
                <td class="small">${isSandbox ? '—' : (sc.total ? Number(sc.total).toFixed(1) : '—')}</td>
                <td class="small">${sc.confidence ? Number(sc.confidence).toFixed(3) : (v.confidence ? Number(v.confidence).toFixed(3) : '—')}</td>
                <td class="history-reason">${escHtml(reason)}</td>
            `;
            historyBody.prepend(row);
        }

        // ── Feedback renderer ─────────────────────────────────────────
        function showFeedback(result, isSandbox) {
            const v   = result?.validation || {};
            const sc  = result?.score || {};
            const cat = v?.error_category || (result?.status === 'valid' ? 'valid' : '');

            feedbackBox.dataset.category = cat;

            let icon = cat === 'valid' ? '✅' : cat === 'format' ? '❌' : cat === 'logic' ? '⚠️' : '🔍';
            let msg  = v?.feedback || (result?.status === 'valid' ? 'Response accepted!' : (result?.error || 'See details below.'));

            let errList = '';
            if (Array.isArray(v?.errors) && v.errors.length) {
                errList = '<ul class="mb-0 mt-1 ps-3">' +
                    v.errors.map(e => `<li>${escHtml(e)}</li>`).join('') +
                    '</ul>';
            }

            feedbackContent.innerHTML = `<strong>${icon} ${isSandbox ? '🧪 SANDBOX — ' : ''}${escHtml(msg)}</strong>${errList}`;

            if (!isSandbox && result?.status === 'valid') {
                scoreLine.classList.remove('d-none');
                scoreValue.textContent = sc.total ? Number(sc.total).toFixed(2) : '0';
                confidenceValue.textContent = sc.confidence ? Number(sc.confidence).toFixed(4) : '0.0000';
            } else {
                scoreLine.classList.add('d-none');
                if (isSandbox && v?.confidence) {
                    scoreLine.classList.remove('d-none');
                    scoreValue.textContent = '—';
                    confidenceValue.textContent = Number(v.confidence).toFixed(4);
                }
            }
        }

        // ── Core API call ─────────────────────────────────────────────
        async function callApi(endpoint, payload) {
            const res    = await fetch(endpoint, {
                method:      'POST',
                headers:     authHeaders(true),
                credentials: 'same-origin',
                body:        JSON.stringify(payload),
            });
            const result = await res.json().catch(() => ({}));
            return { ok: res.ok, status: res.status, result };
        }

        // ── Shared submit/sandbox logic ───────────────────────────────
        async function doSubmit(isSandbox) {
            const prompt     = (promptEditor.value     || '').trim();
            const aiResponse = (aiResponseEditor.value || '').trim();
            const missionId  = missionSelect?.value || null;

            if (!aiResponse) {
                feedbackBox.dataset.category = 'format';
                feedbackContent.innerHTML = '❌ AI response is empty. Paste the AI output before submitting.';
                return;
            }
            if (!jsonValid) {
                feedbackBox.dataset.category = 'format';
                feedbackContent.innerHTML = '❌ JSON is invalid — fix the syntax errors shown above first.';
                return;
            }

            const endpoint = isSandbox ? '/api/sandbox' : '/api/submit';
            const payload  = { prompt_text: prompt, ai_response: aiResponse };
            if (missionId) payload.mission_id = missionId;

            submitBtn.disabled = true;
            if (sandboxBtn) sandboxBtn.disabled = true;
            feedbackBox.dataset.category = '';
            feedbackContent.innerHTML = '<span class="text-muted">⏳ Processing…</span>';
            scoreLine.classList.add('d-none');

            try {
                const { ok, status, result } = await callApi(endpoint, payload);
                log(isSandbox ? 'Sandbox' : 'Submit', { ok, status, result });

                if (!ok) {
                    const errMsg = result?.error || `Request failed (HTTP ${status})`;
                    feedbackBox.dataset.category = 'format';
                    feedbackContent.innerHTML = `❌ ${escHtml(errMsg)}`;
                    return;
                }

                showFeedback(result, isSandbox);
                prependHistoryRow(result, isSandbox);

                if (!isSandbox) {
                    const cooldown = result?.cooldown_remaining ?? 10;
                    startCooldown(cooldown);
                    // refresh attempt counter
                    if (currentMission) {
                        currentMission._attempts_used = (currentMission._attempts_used || 0) + 1;
                        renderBrief(currentMission);
                    }
                }
            } catch (err) {
                console.error('[TeamConsole] Network error', err);
                feedbackBox.dataset.category = 'format';
                feedbackContent.innerHTML = '❌ Network error. Check your connection and try again.';
            } finally {
                if (sandboxBtn) sandboxBtn.disabled = false;
                // submitBtn re-enabled by cooldown timer or immediately if sandbox
                if (isSandbox && jsonValid) submitBtn.disabled = false;
            }
        }

        // ── Wire buttons ──────────────────────────────────────────────
        submitBtn.addEventListener('click', () => doSubmit(false));
        if (sandboxBtn) sandboxBtn.addEventListener('click', () => doSubmit(true));

        // ── Init ──────────────────────────────────────────────────────
        updateJsonStatus();
        loadMissions();
        log('Team console v2 initialized');
    });

    // ── Utility: HTML escape ──────────────────────────────────────────
    function escHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
})();
