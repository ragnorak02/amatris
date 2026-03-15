/* ============================================================
   claude-tab.js — Claude Sessions tab for LUMINA
   Mock/design-forward layout with fake session data.
   Self-contained module: renders into #mode-claude.
   ============================================================ */

var ClaudeTab = (function () {
    'use strict';

    /* ---- Mock Data ---- */
    var SESSIONS = [
        {
            id: 'ses-001',
            name: 'Lumina Dashboard',
            path: 'Z:\\Development\\lumina',
            model: 'claude-opus-4-6',
            tokens: 51000,
            contextMax: 1000000,
            status: 'active',
            started: '2026-03-15T08:12:00Z',
            lastActivity: '2026-03-15T14:47:00Z',
            lastAction: 'Edited js/studio.js — renderToolbar refactor'
        },
        {
            id: 'ses-002',
            name: 'Project Ragnorak',
            path: 'Z:\\Development\\lumina\\projectRagnorak',
            model: 'claude-opus-4-6',
            tokens: 234000,
            contextMax: 1000000,
            status: 'active',
            started: '2026-03-15T06:30:00Z',
            lastActivity: '2026-03-15T14:52:00Z',
            lastAction: 'Implemented Phase 6 ATB gauge system'
        },
        {
            id: 'ses-003',
            name: 'Princess Yuna',
            path: 'Z:\\Development\\lumina\\princessYuna',
            model: 'claude-sonnet-4-6',
            tokens: 12000,
            contextMax: 200000,
            status: 'idle',
            started: '2026-03-15T10:05:00Z',
            lastActivity: '2026-03-15T11:22:00Z',
            lastAction: 'Fixed unicorn phase visual toggle'
        },
        {
            id: 'ses-004',
            name: 'Asset Pipeline',
            path: 'Z:\\Development\\lumina',
            model: 'claude-opus-4-6',
            tokens: 89000,
            contextMax: 1000000,
            status: 'completed',
            started: '2026-03-15T07:00:00Z',
            lastActivity: '2026-03-15T09:48:00Z',
            lastAction: 'Finished package matrix grid view'
        },
        {
            id: 'ses-005',
            name: 'Fishing Game',
            path: 'Z:\\Development\\lumina\\fishing',
            model: 'claude-haiku-4-5',
            tokens: 5000,
            contextMax: 200000,
            status: 'completed',
            started: '2026-03-14T22:15:00Z',
            lastActivity: '2026-03-14T22:40:00Z',
            lastAction: 'Scaffolded ship exploration scene'
        }
    ];

    var SUMMARY = {
        activeSessions: 2,
        totalTokens: '847K',
        pendingInput: 1,
        completedToday: 7
    };

    /* ---- State ---- */
    var selectedSessionId = null;
    var containerEl = null;

    /* ---- Helpers ---- */
    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatTokens(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return Math.round(n / 1000) + 'K';
        return String(n);
    }

    function formatTime(iso) {
        if (!iso) return '--';
        var d = new Date(iso);
        var h = d.getHours();
        var m = d.getMinutes();
        var ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
    }

    function statusColor(status) {
        if (status === 'active') return '#22c55e';
        if (status === 'idle') return '#eab308';
        if (status === 'completed') return '#a78bfa';
        if (status === 'error') return '#ef4444';
        return '#6a6450';
    }

    function statusLabel(status) {
        return status.charAt(0).toUpperCase() + status.slice(1);
    }

    function contextPercent(session) {
        if (!session.contextMax || session.contextMax === 0) return 0;
        return Math.min(100, Math.round((session.tokens / session.contextMax) * 100));
    }

    /* ============================================================
       STYLES — injected once into <head>
       ============================================================ */
    function injectStyles() {
        if (document.getElementById('claude-tab-styles')) return;
        var style = document.createElement('style');
        style.id = 'claude-tab-styles';
        style.textContent =
            /* Container */
            '#claude-tab-root {' +
                'display: flex;' +
                'flex-direction: column;' +
                'height: 100%;' +
                'gap: 0;' +
                'font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;' +
                'color: #e0dcd0;' +
            '}' +

            /* Summary Strip */
            '.ct-summary-strip {' +
                'display: flex;' +
                'gap: 10px;' +
                'padding: 10px 14px;' +
                'border-bottom: 1px solid rgba(255,255,255,0.06);' +
                'flex-shrink: 0;' +
            '}' +
            '.ct-stat-card {' +
                'flex: 1;' +
                'background: rgba(255,255,255,0.03);' +
                'border: 1px solid rgba(255,255,255,0.06);' +
                'border-radius: 6px;' +
                'padding: 8px 12px;' +
                'display: flex;' +
                'flex-direction: column;' +
                'gap: 2px;' +
            '}' +
            '.ct-stat-label {' +
                'font-size: 0.6rem;' +
                'text-transform: uppercase;' +
                'letter-spacing: 0.08em;' +
                'color: #6a6450;' +
            '}' +
            '.ct-stat-value {' +
                'font-size: 1.1rem;' +
                'font-weight: 600;' +
                'color: #d4af37;' +
            '}' +

            /* Main body: session list + detail */
            '.ct-body {' +
                'display: flex;' +
                'flex: 1;' +
                'min-height: 0;' +
                'overflow: hidden;' +
            '}' +

            /* Session list column */
            '.ct-session-col {' +
                'flex: 1;' +
                'display: flex;' +
                'flex-direction: column;' +
                'border-right: 1px solid rgba(255,255,255,0.06);' +
                'min-width: 0;' +
            '}' +
            '.ct-session-list {' +
                'flex: 1;' +
                'overflow-y: auto;' +
                'padding: 8px 10px;' +
                'display: flex;' +
                'flex-direction: column;' +
                'gap: 6px;' +
            '}' +
            '.ct-session-list::-webkit-scrollbar {' +
                'width: 4px;' +
            '}' +
            '.ct-session-list::-webkit-scrollbar-track {' +
                'background: transparent;' +
            '}' +
            '.ct-session-list::-webkit-scrollbar-thumb {' +
                'background: rgba(212,175,55,0.2);' +
                'border-radius: 2px;' +
            '}' +

            /* Session card */
            '.ct-session-card {' +
                'background: rgba(255,255,255,0.025);' +
                'border: 1px solid rgba(255,255,255,0.06);' +
                'border-radius: 6px;' +
                'padding: 10px 12px;' +
                'cursor: pointer;' +
                'transition: border-color 0.15s, background 0.15s;' +
            '}' +
            '.ct-session-card:hover {' +
                'border-color: rgba(212,175,55,0.3);' +
                'background: rgba(255,255,255,0.04);' +
            '}' +
            '.ct-session-card.selected {' +
                'border-color: #d4af37;' +
                'background: rgba(212,175,55,0.06);' +
            '}' +
            '.ct-card-header {' +
                'display: flex;' +
                'align-items: center;' +
                'justify-content: space-between;' +
                'margin-bottom: 4px;' +
            '}' +
            '.ct-card-name {' +
                'font-size: 0.8rem;' +
                'font-weight: 600;' +
                'color: #e0dcd0;' +
                'white-space: nowrap;' +
                'overflow: hidden;' +
                'text-overflow: ellipsis;' +
            '}' +
            '.ct-card-status {' +
                'font-size: 0.6rem;' +
                'font-weight: 600;' +
                'text-transform: uppercase;' +
                'letter-spacing: 0.06em;' +
                'padding: 2px 6px;' +
                'border-radius: 3px;' +
                'flex-shrink: 0;' +
            '}' +
            '.ct-card-meta {' +
                'display: flex;' +
                'align-items: center;' +
                'gap: 10px;' +
                'font-size: 0.65rem;' +
                'color: #6a6450;' +
                'margin-bottom: 4px;' +
            '}' +
            '.ct-card-model {' +
                'color: #00d4ff;' +
            '}' +
            '.ct-card-tokens {' +
                'color: #d4af37;' +
            '}' +
            '.ct-card-path {' +
                'overflow: hidden;' +
                'text-overflow: ellipsis;' +
                'white-space: nowrap;' +
            '}' +
            '.ct-card-action {' +
                'font-size: 0.6rem;' +
                'color: rgba(224,220,208,0.5);' +
                'white-space: nowrap;' +
                'overflow: hidden;' +
                'text-overflow: ellipsis;' +
            '}' +

            /* Controls bar */
            '.ct-controls-bar {' +
                'display: flex;' +
                'gap: 8px;' +
                'padding: 8px 10px;' +
                'border-top: 1px solid rgba(255,255,255,0.06);' +
                'flex-shrink: 0;' +
            '}' +
            '.ct-ctrl-btn {' +
                'font-size: 0.65rem;' +
                'font-weight: 600;' +
                'padding: 5px 12px;' +
                'border: 1px solid rgba(255,255,255,0.08);' +
                'border-radius: 4px;' +
                'background: rgba(255,255,255,0.04);' +
                'color: #e0dcd0;' +
                'cursor: pointer;' +
                'transition: border-color 0.15s, background 0.15s;' +
            '}' +
            '.ct-ctrl-btn:hover {' +
                'border-color: rgba(212,175,55,0.4);' +
                'background: rgba(212,175,55,0.08);' +
            '}' +
            '.ct-ctrl-btn.primary {' +
                'border-color: rgba(212,175,55,0.3);' +
                'color: #d4af37;' +
            '}' +

            /* Detail panel */
            '.ct-detail-col {' +
                'width: 320px;' +
                'flex-shrink: 0;' +
                'display: flex;' +
                'flex-direction: column;' +
                'overflow-y: auto;' +
                'padding: 12px 14px;' +
            '}' +
            '.ct-detail-col::-webkit-scrollbar {' +
                'width: 4px;' +
            '}' +
            '.ct-detail-col::-webkit-scrollbar-track {' +
                'background: transparent;' +
            '}' +
            '.ct-detail-col::-webkit-scrollbar-thumb {' +
                'background: rgba(212,175,55,0.2);' +
                'border-radius: 2px;' +
            '}' +
            '.ct-detail-empty {' +
                'display: flex;' +
                'align-items: center;' +
                'justify-content: center;' +
                'height: 100%;' +
                'color: #6a6450;' +
                'font-size: 0.7rem;' +
                'text-align: center;' +
            '}' +
            '.ct-detail-name {' +
                'font-size: 0.95rem;' +
                'font-weight: 700;' +
                'color: #e0dcd0;' +
                'margin-bottom: 2px;' +
            '}' +
            '.ct-detail-model {' +
                'font-size: 0.65rem;' +
                'color: #00d4ff;' +
                'margin-bottom: 10px;' +
            '}' +
            '.ct-detail-section {' +
                'margin-bottom: 12px;' +
            '}' +
            '.ct-detail-section-title {' +
                'font-size: 0.6rem;' +
                'text-transform: uppercase;' +
                'letter-spacing: 0.08em;' +
                'color: #6a6450;' +
                'margin-bottom: 6px;' +
            '}' +
            '.ct-detail-row {' +
                'display: flex;' +
                'justify-content: space-between;' +
                'align-items: center;' +
                'font-size: 0.65rem;' +
                'padding: 3px 0;' +
            '}' +
            '.ct-detail-row-label {' +
                'color: #6a6450;' +
            '}' +
            '.ct-detail-row-value {' +
                'color: #e0dcd0;' +
                'font-weight: 500;' +
            '}' +

            /* Context bar */
            '.ct-context-bar-wrap {' +
                'margin: 8px 0 12px 0;' +
            '}' +
            '.ct-context-bar-label {' +
                'display: flex;' +
                'justify-content: space-between;' +
                'font-size: 0.6rem;' +
                'color: #6a6450;' +
                'margin-bottom: 3px;' +
            '}' +
            '.ct-context-bar-track {' +
                'width: 100%;' +
                'height: 6px;' +
                'background: rgba(255,255,255,0.06);' +
                'border-radius: 3px;' +
                'overflow: hidden;' +
            '}' +
            '.ct-context-bar-fill {' +
                'height: 100%;' +
                'border-radius: 3px;' +
                'transition: width 0.3s;' +
            '}' +

            /* Action buttons grid */
            '.ct-detail-actions {' +
                'display: grid;' +
                'grid-template-columns: 1fr 1fr;' +
                'gap: 6px;' +
                'margin-top: 10px;' +
            '}' +
            '.ct-action-btn {' +
                'font-size: 0.6rem;' +
                'font-weight: 600;' +
                'padding: 6px 0;' +
                'border: 1px solid rgba(255,255,255,0.06);' +
                'border-radius: 4px;' +
                'background: rgba(255,255,255,0.03);' +
                'color: #e0dcd0;' +
                'cursor: pointer;' +
                'text-align: center;' +
                'transition: border-color 0.15s, background 0.15s, color 0.15s;' +
            '}' +
            '.ct-action-btn:hover {' +
                'border-color: rgba(212,175,55,0.35);' +
                'background: rgba(212,175,55,0.07);' +
                'color: #f0c850;' +
            '}' +
            '.ct-action-btn.ct-action-primary {' +
                'border-color: rgba(212,175,55,0.25);' +
                'color: #d4af37;' +
            '}';

        document.head.appendChild(style);
    }

    /* ============================================================
       RENDER — Summary Strip
       ============================================================ */
    function renderSummaryStrip() {
        var html = '<div class="ct-summary-strip">';

        html += '<div class="ct-stat-card">' +
                    '<span class="ct-stat-label">Active Sessions</span>' +
                    '<span class="ct-stat-value">' + SUMMARY.activeSessions + '</span>' +
                '</div>';

        html += '<div class="ct-stat-card">' +
                    '<span class="ct-stat-label">Total Tokens</span>' +
                    '<span class="ct-stat-value">' + SUMMARY.totalTokens + '</span>' +
                '</div>';

        html += '<div class="ct-stat-card">' +
                    '<span class="ct-stat-label">Pending Input</span>' +
                    '<span class="ct-stat-value">' + SUMMARY.pendingInput + '</span>' +
                '</div>';

        html += '<div class="ct-stat-card">' +
                    '<span class="ct-stat-label">Completed Today</span>' +
                    '<span class="ct-stat-value">' + SUMMARY.completedToday + '</span>' +
                '</div>';

        html += '</div>';
        return html;
    }

    /* ============================================================
       RENDER — Session Card
       ============================================================ */
    function renderSessionCard(session) {
        var isSelected = session.id === selectedSessionId;
        var sc = statusColor(session.status);

        var html = '<div class="ct-session-card' + (isSelected ? ' selected' : '') + '" data-session-id="' + escapeHtml(session.id) + '">';

        /* Header: name + status badge */
        html += '<div class="ct-card-header">';
        html += '<span class="ct-card-name">' + escapeHtml(session.name) + '</span>';
        html += '<span class="ct-card-status" style="color:' + sc + '; background:' + sc + '18">' + statusLabel(session.status) + '</span>';
        html += '</div>';

        /* Meta: model, tokens, path */
        html += '<div class="ct-card-meta">';
        html += '<span class="ct-card-model">' + escapeHtml(session.model) + '</span>';
        html += '<span class="ct-card-tokens">' + formatTokens(session.tokens) + ' tokens</span>';
        html += '<span class="ct-card-path">' + escapeHtml(session.path) + '</span>';
        html += '</div>';

        /* Last action */
        html += '<div class="ct-card-action">' + escapeHtml(session.lastAction) + '</div>';

        html += '</div>';
        return html;
    }

    /* ============================================================
       RENDER — Session List + Controls
       ============================================================ */
    function renderSessionColumn() {
        var html = '<div class="ct-session-col">';

        /* Scrollable session list */
        html += '<div class="ct-session-list" id="ct-session-list">';
        for (var i = 0; i < SESSIONS.length; i++) {
            html += renderSessionCard(SESSIONS[i]);
        }
        html += '</div>';

        /* Controls bar */
        html += '<div class="ct-controls-bar">';
        html += '<button class="ct-ctrl-btn primary" id="ct-refresh-all">Refresh All</button>';
        html += '<button class="ct-ctrl-btn" id="ct-new-session">New Session</button>';
        html += '</div>';

        html += '</div>';
        return html;
    }

    /* ============================================================
       RENDER — Detail Panel
       ============================================================ */
    function renderDetailPanel() {
        var html = '<div class="ct-detail-col" id="ct-detail-panel">';

        if (!selectedSessionId) {
            html += '<div class="ct-detail-empty">Select a session to view details</div>';
            html += '</div>';
            return html;
        }

        var session = null;
        for (var i = 0; i < SESSIONS.length; i++) {
            if (SESSIONS[i].id === selectedSessionId) {
                session = SESSIONS[i];
                break;
            }
        }

        if (!session) {
            html += '<div class="ct-detail-empty">Session not found</div>';
            html += '</div>';
            return html;
        }

        var sc = statusColor(session.status);
        var pct = contextPercent(session);

        /* Bar fill color: green when low, gold when medium, red when high */
        var barColor = '#22c55e';
        if (pct > 70) barColor = '#ef4444';
        else if (pct > 40) barColor = '#d4af37';

        /* Name + model */
        html += '<div class="ct-detail-name">' + escapeHtml(session.name) + '</div>';
        html += '<div class="ct-detail-model">' + escapeHtml(session.model) + '</div>';

        /* Token + context usage */
        html += '<div class="ct-detail-section">';
        html += '<div class="ct-detail-section-title">Token Usage</div>';
        html += '<div class="ct-detail-row">';
        html += '<span class="ct-detail-row-label">Used</span>';
        html += '<span class="ct-detail-row-value" style="color:#d4af37">' + formatTokens(session.tokens) + '</span>';
        html += '</div>';
        html += '<div class="ct-detail-row">';
        html += '<span class="ct-detail-row-label">Context Window</span>';
        html += '<span class="ct-detail-row-value">' + formatTokens(session.contextMax) + '</span>';
        html += '</div>';
        html += '</div>';

        /* Context bar */
        html += '<div class="ct-context-bar-wrap">';
        html += '<div class="ct-context-bar-label">';
        html += '<span>Context</span>';
        html += '<span>' + pct + '%</span>';
        html += '</div>';
        html += '<div class="ct-context-bar-track">';
        html += '<div class="ct-context-bar-fill" style="width:' + pct + '%; background:' + barColor + '"></div>';
        html += '</div>';
        html += '</div>';

        /* Status + times */
        html += '<div class="ct-detail-section">';
        html += '<div class="ct-detail-section-title">Session Info</div>';
        html += '<div class="ct-detail-row">';
        html += '<span class="ct-detail-row-label">Status</span>';
        html += '<span class="ct-detail-row-value" style="color:' + sc + '">' + statusLabel(session.status) + '</span>';
        html += '</div>';
        html += '<div class="ct-detail-row">';
        html += '<span class="ct-detail-row-label">Started</span>';
        html += '<span class="ct-detail-row-value">' + formatTime(session.started) + '</span>';
        html += '</div>';
        html += '<div class="ct-detail-row">';
        html += '<span class="ct-detail-row-label">Last Activity</span>';
        html += '<span class="ct-detail-row-value">' + formatTime(session.lastActivity) + '</span>';
        html += '</div>';
        html += '</div>';

        /* Path */
        html += '<div class="ct-detail-section">';
        html += '<div class="ct-detail-section-title">Working Directory</div>';
        html += '<div style="font-size:0.6rem; color:#6a6450; word-break:break-all;">' + escapeHtml(session.path) + '</div>';
        html += '</div>';

        /* Last action */
        html += '<div class="ct-detail-section">';
        html += '<div class="ct-detail-section-title">Last Action</div>';
        html += '<div style="font-size:0.65rem; color:rgba(224,220,208,0.7);">' + escapeHtml(session.lastAction) + '</div>';
        html += '</div>';

        /* Action buttons */
        html += '<div class="ct-detail-actions">';
        html += '<button class="ct-action-btn ct-action-primary" data-action="refresh">Refresh</button>';
        html += '<button class="ct-action-btn ct-action-primary" data-action="focus">Focus</button>';
        html += '<button class="ct-action-btn" data-action="terminal">Terminal</button>';
        html += '<button class="ct-action-btn" data-action="open-claude">Open Claude</button>';
        html += '<button class="ct-action-btn" data-action="inspect-logs">Inspect Logs</button>';
        html += '<button class="ct-action-btn" data-action="archive">Archive</button>';
        html += '</div>';

        html += '</div>';
        return html;
    }

    /* ============================================================
       RENDER — Full layout
       ============================================================ */
    function render() {
        if (!containerEl) return;

        var html = '<div id="claude-tab-root">';
        html += renderSummaryStrip();
        html += '<div class="ct-body">';
        html += renderSessionColumn();
        html += renderDetailPanel();
        html += '</div>';
        html += '</div>';

        containerEl.innerHTML = html;
        wireEvents();
    }

    /* ============================================================
       EVENT WIRING
       ============================================================ */
    function wireEvents() {
        /* Session card clicks */
        var cards = containerEl.querySelectorAll('.ct-session-card');
        for (var i = 0; i < cards.length; i++) {
            cards[i].addEventListener('click', function () {
                var id = this.getAttribute('data-session-id');
                selectedSessionId = (selectedSessionId === id) ? null : id;
                render();
            });
        }

        /* Refresh All */
        var refreshBtn = document.getElementById('ct-refresh-all');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function () {
                /* Mock: just re-render */
                render();
            });
        }

        /* New Session (placeholder) */
        var newBtn = document.getElementById('ct-new-session');
        if (newBtn) {
            newBtn.addEventListener('click', function () {
                /* Placeholder — no-op */
            });
        }

        /* Detail action buttons */
        var actionBtns = containerEl.querySelectorAll('.ct-action-btn');
        for (var j = 0; j < actionBtns.length; j++) {
            actionBtns[j].addEventListener('click', function (e) {
                e.stopPropagation();
                /* Placeholder — log the action */
                var action = this.getAttribute('data-action');
                if (action) {
                    console.log('[ClaudeTab] Action: ' + action + ' on session ' + selectedSessionId);
                }
            });
        }
    }

    /* ============================================================
       INIT
       ============================================================ */
    function init() {
        containerEl = document.getElementById('mode-claude');
        if (!containerEl) return;

        injectStyles();
        render();
    }

    /* ---- Public API ---- */
    return {
        init: init
    };

})();
