(() => {
    document.addEventListener('DOMContentLoaded', () => {
        const DEBUG = window.location.search.includes('debug=1');
        const log = (...args) => {
            if (DEBUG) console.log('[TeamConsole]', ...args);
        };

        const promptEditor = document.getElementById('promptEditor');
        const promptLength = document.getElementById('promptLength');
        const submitBtn = document.getElementById('submitPromptBtn');
        const missionSelect = document.getElementById('missionSelect');
        const jsonPreview = document.getElementById('jsonPreview');
        const validationFeedback = document.getElementById('validationFeedback');
        const confidenceValue = document.getElementById('confidenceValue');
        const historyBody = document.getElementById('submissionHistoryBody');

        if (!promptEditor || !submitBtn) {
            console.error('Team console initialization failed: required DOM elements are missing');
            return;
        }

        const initialButtonText = submitBtn.textContent;

        function setLength() {
            promptLength.textContent = String((promptEditor.value || '').length);
        }

        function setSubmitting(isSubmitting) {
            submitBtn.disabled = isSubmitting;
            submitBtn.textContent = isSubmitting ? 'Submitting...' : initialButtonText;
            promptEditor.disabled = isSubmitting;
            if (missionSelect) missionSelect.disabled = isSubmitting;
        }

        function setFeedback(message, isError = false) {
            validationFeedback.classList.toggle('text-danger', isError);
            validationFeedback.classList.toggle('text-success', !isError);
            validationFeedback.textContent = message;
        }

        function appendHistoryRow(payload, result) {
            if (!historyBody) return;

            const status = result?.status || 'unknown';
            const statusBadge = status === 'valid'
                ? '<span class="badge badge-valid">VALID</span>'
                : status === 'invalid'
                    ? '<span class="badge badge-invalid">INVALID</span>'
                    : '<span class="badge badge-error">ERROR</span>';

            const score = Number(result?.score?.total || 0).toFixed(2);
            const confidence = Number(result?.score?.confidence || result?.validation?.confidence_score || 0).toFixed(4);
            const errors = Array.isArray(result?.validation?.errors) ? result.validation.errors.join('; ') : '';
            const missionName = missionSelect?.selectedOptions?.[0]?.textContent || payload?.mission_id || 'Auto';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${new Date().toLocaleTimeString('en-GB')}</td>
                <td>${ArenaUI.escapeHtml(missionName)}</td>
                <td>${statusBadge}</td>
                <td>${score}</td>
                <td>${confidence}</td>
                <td class="text-muted">${ArenaUI.escapeHtml(errors || '-')}</td>
            `;

            const placeholder = historyBody.querySelector('td[colspan="6"]');
            if (placeholder) {
                historyBody.innerHTML = '';
            }
            historyBody.prepend(row);
        }

        async function loadMissions() {
            if (!missionSelect) return;

            try {
                log('Loading missions...');
                const res = await fetch('/api/missions', {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                    },
                    credentials: 'same-origin',
                });

                if (!res.ok) {
                    throw new Error(`Missions load failed: HTTP ${res.status}`);
                }

                const data = await res.json();
                const missions = Array.isArray(data?.missions) ? data.missions : [];

                if (!missions.length) {
                    missionSelect.innerHTML = '<option value="">No active missions</option>';
                    return;
                }

                missionSelect.innerHTML = missions
                    .map(m => `<option value="${m.id}">${ArenaUI.escapeHtml(m.mission_code)} — ${ArenaUI.escapeHtml(m.title)}</option>`)
                    .join('');

                log('Missions loaded:', missions.length);
            } catch (err) {
                console.error('Failed to load missions', err);
                missionSelect.innerHTML = '<option value="">Could not load missions</option>';
            }
        }

        async function submitPrompt() {
            const prompt = (promptEditor.value || '').trim();
            const missionId = missionSelect?.value || null;

            log('Submit clicked', { promptLength: prompt.length, missionId });

            if (!prompt) {
                setFeedback('Prompt cannot be empty.', true);
                return;
            }

            const payload = {
                prompt,
            };
            if (missionId) payload.mission_id = missionId;

            setSubmitting(true);
            setFeedback('Submitting prompt...');

            try {
                const token = localStorage.getItem('arena_jwt_token');

                const headers = {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                };
                if (token) {
                    headers.Authorization = `Bearer ${token}`;
                }

                const response = await fetch('/api/submit', {
                    method: 'POST',
                    headers,
                    credentials: 'same-origin',
                    body: JSON.stringify(payload),
                });

                const result = await response.json().catch(() => ({}));
                jsonPreview.textContent = JSON.stringify(result, null, 2);

                if (!response.ok) {
                    const message = result?.error || `Submission failed (HTTP ${response.status})`;
                    setFeedback(message, true);
                    console.error('Submission failed', { status: response.status, result });
                    return;
                }

                confidenceValue.textContent = String(result?.score?.confidence ?? result?.validation?.confidence_score ?? '0.00');
                setFeedback(`Submitted successfully (${result?.status || 'ok'}).`, false);
                appendHistoryRow(payload, result);
                log('Submission success', result);
            } catch (err) {
                console.error('Submission error', err);
                setFeedback('Network error while submitting. Check console for details.', true);
            } finally {
                setSubmitting(false);
            }
        }

        promptEditor.addEventListener('input', setLength);
        submitBtn.addEventListener('click', submitPrompt);

        setLength();
        loadMissions();
        log('Team console initialized');
    });
})();
