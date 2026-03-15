/* ============================================================
   audio-tab.js — Audio Asset Browser Tab for LUMINA
   3-pane layout: audio list, player, detail panel.
   Mock data / design-forward — no real playback.
   ============================================================ */

var AudioTab = (function () {
    'use strict';

    /* ---- Constants ---- */
    var COLORS = {
        gold:      '#d4af37',
        goldLight: '#f0c850',
        cyan:      '#00d4ff',
        bg:        '#0a0a12',
        text:      '#e0dcd0',
        dim:       '#6a6450',
        border:    'rgba(255,255,255,0.06)',
        music:     '#a78bfa',
        sfx:       '#f97316',
        ambient:   '#22c55e',
        ui:        '#00d4ff'
    };

    var CATEGORY_ICONS = {
        Music:   '\u266B',
        SFX:     '\uD83D\uDD0A',
        Ambient: '\uD83C\uDF2C',
        UI:      '\uD83D\uDD18'
    };

    /* ---- Mock Data ---- */
    var MOCK_AUDIO = [
        {
            id: 'battle_theme_01', name: 'battle_theme_01', category: 'Music',
            format: 'OGG', duration: '2:22', seconds: 142, loopable: true,
            source: 'Shared', package: 'core-music', tags: ['battle', 'orchestral', 'intense'],
            usedIn: ['projectRagnorak', 'akmaLegacy'], normalized: true,
            path: 'shared_assets/audio/music/battle_theme_01.ogg',
            created: '2026-01-15T10:30:00Z', indexed: '2026-03-10T08:00:00Z'
        },
        {
            id: 'menu_ambient', name: 'menu_ambient', category: 'Music',
            format: 'OGG', duration: '4:15', seconds: 255, loopable: true,
            source: 'Shared', package: 'ui-sounds', tags: ['menu', 'calm', 'atmospheric'],
            usedIn: ['projectRagnorak'], normalized: true,
            path: 'shared_assets/audio/music/menu_ambient.ogg',
            created: '2026-01-20T14:00:00Z', indexed: '2026-03-10T08:00:00Z'
        },
        {
            id: 'sword_slash_01', name: 'sword_slash_01', category: 'SFX',
            format: 'WAV', duration: '0:01', seconds: 1, loopable: false,
            source: 'Local', package: '\u2014', tags: ['combat', 'melee', 'sword'],
            usedIn: ['projectRagnorak'], normalized: true,
            path: 'projectRagnorak/audio/sfx/sword_slash_01.wav',
            created: '2026-02-01T09:15:00Z', indexed: '2026-03-10T08:00:00Z'
        },
        {
            id: 'footstep_grass', name: 'footstep_grass', category: 'SFX',
            format: 'WAV', duration: '0:00', seconds: 0, loopable: false,
            source: 'Shared', package: 'foley-pack', tags: ['footstep', 'grass', 'foley'],
            usedIn: ['projectRagnorak', 'princessYuna'], normalized: true,
            path: 'shared_assets/audio/sfx/footstep_grass.wav',
            created: '2026-01-10T11:00:00Z', indexed: '2026-03-10T08:00:00Z'
        },
        {
            id: 'victory_fanfare', name: 'victory_fanfare', category: 'Music',
            format: 'OGG', duration: '0:18', seconds: 18, loopable: false,
            source: 'Shared', package: 'core-music', tags: ['victory', 'fanfare', 'jingle'],
            usedIn: ['projectRagnorak', 'akmaLegacy', 'princessYuna'], normalized: true,
            path: 'shared_assets/audio/music/victory_fanfare.ogg',
            created: '2026-01-18T16:45:00Z', indexed: '2026-03-10T08:00:00Z'
        },
        {
            id: 'explosion_large', name: 'explosion_large', category: 'SFX',
            format: 'WAV', duration: '0:02', seconds: 2, loopable: false,
            source: 'Local', package: '\u2014', tags: ['explosion', 'impact', 'destruction'],
            usedIn: ['akmaLegacy'], normalized: false,
            path: 'akmaLegacy/audio/sfx/explosion_large.wav',
            created: '2026-02-05T13:20:00Z', indexed: '2026-03-10T08:00:00Z'
        },
        {
            id: 'rain_loop', name: 'rain_loop', category: 'Ambient',
            format: 'OGG', duration: '3:00', seconds: 180, loopable: true,
            source: 'Shared', package: 'ambient-nature', tags: ['rain', 'weather', 'loop'],
            usedIn: ['projectRagnorak'], normalized: true,
            path: 'shared_assets/audio/ambient/rain_loop.ogg',
            created: '2026-01-22T10:00:00Z', indexed: '2026-03-10T08:00:00Z'
        },
        {
            id: 'ui_click', name: 'ui_click', category: 'UI',
            format: 'WAV', duration: '0:00', seconds: 0, loopable: false,
            source: 'Shared', package: 'ui-sounds', tags: ['click', 'button', 'interface'],
            usedIn: ['projectRagnorak', 'princessYuna', 'akmaLegacy'], normalized: true,
            path: 'shared_assets/audio/ui/ui_click.wav',
            created: '2026-01-08T09:00:00Z', indexed: '2026-03-10T08:00:00Z'
        },
        {
            id: 'boss_intro', name: 'boss_intro', category: 'Music',
            format: 'OGG', duration: '1:45', seconds: 105, loopable: false,
            source: 'Local', package: '\u2014', tags: ['boss', 'dramatic', 'cinematic'],
            usedIn: ['projectRagnorak'], normalized: true,
            path: 'projectRagnorak/audio/music/boss_intro.ogg',
            created: '2026-02-12T15:30:00Z', indexed: '2026-03-10T08:00:00Z'
        },
        {
            id: 'coin_pickup', name: 'coin_pickup', category: 'SFX',
            format: 'WAV', duration: '0:01', seconds: 1, loopable: false,
            source: 'Shared', package: 'ui-sounds', tags: ['coin', 'pickup', 'reward'],
            usedIn: ['princessYuna'], normalized: true,
            path: 'shared_assets/audio/sfx/coin_pickup.wav',
            created: '2026-01-25T12:00:00Z', indexed: '2026-03-10T08:00:00Z'
        },
        {
            id: 'wind_howl', name: 'wind_howl', category: 'Ambient',
            format: 'OGG', duration: '5:00', seconds: 300, loopable: true,
            source: 'Shared', package: 'ambient-nature', tags: ['wind', 'howl', 'weather', 'eerie'],
            usedIn: ['projectRagnorak', 'akmaLegacy'], normalized: true,
            path: 'shared_assets/audio/ambient/wind_howl.ogg',
            created: '2026-01-28T08:45:00Z', indexed: '2026-03-10T08:00:00Z'
        },
        {
            id: 'level_complete', name: 'level_complete', category: 'Music',
            format: 'OGG', duration: '0:12', seconds: 12, loopable: false,
            source: 'Shared', package: 'core-music', tags: ['level', 'complete', 'jingle', 'cheerful'],
            usedIn: ['princessYuna'], normalized: true,
            path: 'shared_assets/audio/music/level_complete.ogg',
            created: '2026-02-02T11:10:00Z', indexed: '2026-03-10T08:00:00Z'
        }
    ];

    /* ---- State ---- */
    var rootEl = null;
    var selectedTrack = null;
    var searchQuery = '';
    var categoryFilter = 'All';
    var formatFilter = 'All';
    var isLooping = false;
    var isPlaying = false;

    /* ============================================================
       INIT
       ============================================================ */
    function init() {
        rootEl = document.getElementById('mode-audio');
        if (!rootEl) return;

        injectStyles();
        render();
    }

    /* ============================================================
       STYLES
       ============================================================ */
    function injectStyles() {
        if (document.getElementById('audio-tab-styles')) return;

        var css = '';
        css += '.audio-browser { display:flex; flex-direction:column; height:100%; background:' + COLORS.bg + '; color:' + COLORS.text + '; font-family:Inter,system-ui,sans-serif; }';

        /* ---- Top Filter Bar ---- */
        css += '.audio-filter-bar { display:flex; align-items:center; gap:10px; padding:10px 14px; border-bottom:1px solid ' + COLORS.border + '; background:rgba(10,10,18,0.95); flex-shrink:0; }';
        css += '.audio-filter-bar input[type="text"] { flex:1; max-width:260px; background:rgba(255,255,255,0.04); border:1px solid ' + COLORS.border + '; border-radius:4px; color:' + COLORS.text + '; padding:6px 10px; font-size:12px; outline:none; transition:border-color 0.2s; }';
        css += '.audio-filter-bar input[type="text"]:focus { border-color:' + COLORS.gold + '; }';
        css += '.audio-filter-bar input[type="text"]::placeholder { color:' + COLORS.dim + '; }';
        css += '.audio-filter-select { background:rgba(255,255,255,0.04); border:1px solid ' + COLORS.border + '; border-radius:4px; color:' + COLORS.text + '; padding:6px 8px; font-size:12px; outline:none; cursor:pointer; }';
        css += '.audio-filter-select:focus { border-color:' + COLORS.gold + '; }';
        css += '.audio-filter-select option { background:#16161e; color:' + COLORS.text + '; }';
        css += '.audio-filter-label { font-size:11px; color:' + COLORS.dim + '; text-transform:uppercase; letter-spacing:0.5px; }';

        /* ---- 3-pane layout ---- */
        css += '.audio-panes { display:flex; flex:1; overflow:hidden; }';

        /* ---- Left Pane: Audio List ---- */
        css += '.audio-list-pane { width:25%; min-width:200px; border-right:1px solid ' + COLORS.border + '; display:flex; flex-direction:column; overflow:hidden; }';
        css += '.audio-list-header { padding:10px 12px 8px; font-size:11px; color:' + COLORS.dim + '; text-transform:uppercase; letter-spacing:0.6px; border-bottom:1px solid ' + COLORS.border + '; flex-shrink:0; }';
        css += '.audio-list-scroll { flex:1; overflow-y:auto; padding:4px 0; }';
        css += '.audio-list-item { display:flex; align-items:center; gap:8px; padding:8px 12px; cursor:pointer; transition:background 0.15s; border-left:3px solid transparent; }';
        css += '.audio-list-item:hover { background:rgba(212,175,55,0.06); }';
        css += '.audio-list-item.selected { background:rgba(212,175,55,0.1); border-left-color:' + COLORS.gold + '; }';
        css += '.audio-list-icon { font-size:16px; width:22px; text-align:center; flex-shrink:0; }';
        css += '.audio-list-info { flex:1; min-width:0; }';
        css += '.audio-list-name { font-size:12px; color:' + COLORS.text + '; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }';
        css += '.audio-list-meta { display:flex; align-items:center; gap:6px; margin-top:2px; }';
        css += '.audio-list-badge { font-size:9px; padding:1px 5px; border-radius:3px; text-transform:uppercase; font-weight:600; letter-spacing:0.3px; }';
        css += '.audio-list-badge.music { background:rgba(167,139,250,0.15); color:' + COLORS.music + '; }';
        css += '.audio-list-badge.sfx { background:rgba(249,115,22,0.15); color:' + COLORS.sfx + '; }';
        css += '.audio-list-badge.ambient { background:rgba(34,197,94,0.15); color:' + COLORS.ambient + '; }';
        css += '.audio-list-badge.ui-cat { background:rgba(0,212,255,0.15); color:' + COLORS.ui + '; }';
        css += '.audio-list-fmt { font-size:10px; color:' + COLORS.dim + '; }';
        css += '.audio-list-dur { font-size:10px; color:' + COLORS.dim + '; margin-left:auto; white-space:nowrap; }';
        css += '.audio-list-loop { font-size:9px; color:' + COLORS.gold + '; margin-left:4px; }';

        /* ---- Center Pane: Player ---- */
        css += '.audio-player-pane { width:45%; display:flex; flex-direction:column; border-right:1px solid ' + COLORS.border + '; }';

        /* Empty state */
        css += '.audio-player-empty { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; color:' + COLORS.dim + '; }';
        css += '.audio-player-empty-icon { font-size:48px; opacity:0.3; }';
        css += '.audio-player-empty-text { font-size:13px; }';

        /* Active player */
        css += '.audio-player-active { flex:1; display:flex; flex-direction:column; }';
        css += '.audio-player-track-name { padding:16px 20px 8px; font-size:16px; font-weight:600; color:' + COLORS.goldLight + '; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }';
        css += '.audio-player-track-sub { padding:0 20px 12px; font-size:11px; color:' + COLORS.dim + '; }';

        /* Waveform */
        css += '.audio-waveform { flex:1; display:flex; align-items:flex-end; justify-content:center; gap:2px; padding:20px; min-height:120px; }';
        css += '.audio-waveform-bar { width:4px; border-radius:2px; transition:opacity 0.2s; }';

        /* Scrub bar */
        css += '.audio-scrub-area { padding:0 20px 10px; }';
        css += '.audio-scrub-bar { position:relative; height:4px; background:rgba(255,255,255,0.08); border-radius:2px; overflow:hidden; cursor:pointer; }';
        css += '.audio-scrub-fill { position:absolute; left:0; top:0; height:100%; width:0%; background:linear-gradient(90deg,' + COLORS.gold + ',' + COLORS.goldLight + '); border-radius:2px; }';
        css += '.audio-scrub-times { display:flex; justify-content:space-between; font-size:10px; color:' + COLORS.dim + '; margin-top:4px; }';

        /* Transport controls */
        css += '.audio-transport { display:flex; align-items:center; justify-content:center; gap:12px; padding:14px 20px; border-top:1px solid ' + COLORS.border + '; }';
        css += '.audio-transport-btn { width:36px; height:36px; border-radius:50%; border:1px solid ' + COLORS.border + '; background:rgba(255,255,255,0.03); color:' + COLORS.text + '; font-size:14px; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all 0.15s; }';
        css += '.audio-transport-btn:hover { border-color:' + COLORS.gold + '; color:' + COLORS.gold + '; background:rgba(212,175,55,0.08); }';
        css += '.audio-transport-btn.play-btn { width:44px; height:44px; font-size:18px; border-color:' + COLORS.gold + '; }';
        css += '.audio-transport-btn.play-btn:hover { background:rgba(212,175,55,0.15); }';
        css += '.audio-transport-btn.active { color:' + COLORS.gold + '; border-color:' + COLORS.gold + '; background:rgba(212,175,55,0.12); }';

        /* Volume + loop row */
        css += '.audio-extras-row { display:flex; align-items:center; gap:16px; padding:10px 20px 16px; }';
        css += '.audio-volume-group { display:flex; align-items:center; gap:8px; flex:1; }';
        css += '.audio-volume-icon { font-size:14px; color:' + COLORS.dim + '; cursor:pointer; }';
        css += '.audio-volume-slider { -webkit-appearance:none; appearance:none; width:100px; height:4px; background:rgba(255,255,255,0.08); border-radius:2px; outline:none; cursor:pointer; }';
        css += '.audio-volume-slider::-webkit-slider-thumb { -webkit-appearance:none; appearance:none; width:12px; height:12px; border-radius:50%; background:' + COLORS.gold + '; cursor:pointer; }';
        css += '.audio-loop-btn { font-size:11px; padding:4px 10px; border-radius:3px; border:1px solid ' + COLORS.border + '; background:rgba(255,255,255,0.03); color:' + COLORS.dim + '; cursor:pointer; transition:all 0.15s; }';
        css += '.audio-loop-btn:hover { border-color:' + COLORS.gold + '; color:' + COLORS.gold + '; }';
        css += '.audio-loop-btn.active { border-color:' + COLORS.gold + '; color:' + COLORS.gold + '; background:rgba(212,175,55,0.1); }';

        /* ---- Right Pane: Detail ---- */
        css += '.audio-detail-pane { width:30%; display:flex; flex-direction:column; overflow:hidden; }';
        css += '.audio-detail-empty { flex:1; display:flex; align-items:center; justify-content:center; color:' + COLORS.dim + '; font-size:12px; }';
        css += '.audio-detail-scroll { flex:1; overflow-y:auto; padding:16px; }';
        css += '.audio-detail-name { font-size:18px; font-weight:700; color:' + COLORS.goldLight + '; margin-bottom:4px; word-break:break-all; }';
        css += '.audio-detail-cat { display:inline-block; font-size:10px; padding:2px 8px; border-radius:3px; text-transform:uppercase; font-weight:600; margin-bottom:14px; }';
        css += '.audio-detail-section { margin-bottom:14px; }';
        css += '.audio-detail-section-title { font-size:10px; color:' + COLORS.dim + '; text-transform:uppercase; letter-spacing:0.6px; margin-bottom:6px; }';
        css += '.audio-detail-row { display:flex; justify-content:space-between; align-items:center; padding:4px 0; font-size:12px; }';
        css += '.audio-detail-label { color:' + COLORS.dim + '; }';
        css += '.audio-detail-value { color:' + COLORS.text + '; text-align:right; max-width:60%; word-break:break-all; }';
        css += '.audio-detail-tags { display:flex; flex-wrap:wrap; gap:4px; margin-top:4px; }';
        css += '.audio-detail-tag { font-size:10px; padding:2px 7px; border-radius:10px; background:rgba(255,255,255,0.05); color:' + COLORS.dim + '; border:1px solid ' + COLORS.border + '; }';
        css += '.audio-detail-games { list-style:none; padding:0; margin:4px 0 0; }';
        css += '.audio-detail-games li { font-size:12px; color:' + COLORS.text + '; padding:2px 0; }';
        css += '.audio-detail-games li:before { content:"\\25B8 "; color:' + COLORS.gold + '; }';
        css += '.audio-detail-path { font-size:11px; color:' + COLORS.dim + '; font-family:monospace; background:rgba(255,255,255,0.03); padding:6px 8px; border-radius:3px; word-break:break-all; margin-top:4px; }';
        css += '.audio-detail-timestamps { font-size:11px; color:' + COLORS.dim + '; margin-top:4px; }';

        /* Action buttons */
        css += '.audio-detail-actions { display:flex; flex-wrap:wrap; gap:6px; padding:12px 16px; border-top:1px solid ' + COLORS.border + '; flex-shrink:0; }';
        css += '.audio-action-btn { flex:1; min-width:calc(50% - 4px); padding:7px 6px; font-size:11px; text-align:center; border:1px solid ' + COLORS.border + '; border-radius:4px; background:rgba(255,255,255,0.03); color:' + COLORS.text + '; cursor:pointer; transition:all 0.15s; white-space:nowrap; }';
        css += '.audio-action-btn:hover { border-color:' + COLORS.gold + '; color:' + COLORS.gold + '; background:rgba(212,175,55,0.08); }';

        /* ---- Scrollbar ---- */
        css += '.audio-list-scroll::-webkit-scrollbar, .audio-detail-scroll::-webkit-scrollbar { width:6px; }';
        css += '.audio-list-scroll::-webkit-scrollbar-track, .audio-detail-scroll::-webkit-scrollbar-track { background:transparent; }';
        css += '.audio-list-scroll::-webkit-scrollbar-thumb, .audio-detail-scroll::-webkit-scrollbar-thumb { background:rgba(212,175,55,0.25); border-radius:3px; }';
        css += '.audio-list-scroll::-webkit-scrollbar-thumb:hover, .audio-detail-scroll::-webkit-scrollbar-thumb:hover { background:rgba(212,175,55,0.4); }';

        var styleEl = document.createElement('style');
        styleEl.id = 'audio-tab-styles';
        styleEl.textContent = css;
        document.head.appendChild(styleEl);
    }

    /* ============================================================
       RENDER — Main
       ============================================================ */
    function render() {
        if (!rootEl) return;

        var html = '';
        html += '<div class="audio-browser">';
        html += renderFilterBar();
        html += '<div class="audio-panes">';
        html += renderListPane();
        html += renderPlayerPane();
        html += renderDetailPane();
        html += '</div>';
        html += '</div>';

        rootEl.innerHTML = html;
        bindEvents();
    }

    /* ============================================================
       RENDER — Filter Bar
       ============================================================ */
    function renderFilterBar() {
        var html = '';
        html += '<div class="audio-filter-bar">';

        /* Search */
        html += '<input type="text" id="audio-search" class="audio-search" placeholder="Search audio assets\u2026" value="' + escapeAttr(searchQuery) + '">';

        /* Category filter */
        html += '<span class="audio-filter-label">Category</span>';
        html += '<select id="audio-cat-filter" class="audio-filter-select">';
        var cats = ['All', 'Music', 'SFX', 'Ambient', 'UI'];
        for (var i = 0; i < cats.length; i++) {
            html += '<option value="' + cats[i] + '"' + (categoryFilter === cats[i] ? ' selected' : '') + '>' + cats[i] + '</option>';
        }
        html += '</select>';

        /* Format filter */
        html += '<span class="audio-filter-label">Format</span>';
        html += '<select id="audio-fmt-filter" class="audio-filter-select">';
        var fmts = ['All', 'OGG', 'WAV', 'MP3'];
        for (var j = 0; j < fmts.length; j++) {
            html += '<option value="' + fmts[j] + '"' + (formatFilter === fmts[j] ? ' selected' : '') + '>' + fmts[j] + '</option>';
        }
        html += '</select>';

        html += '</div>';
        return html;
    }

    /* ============================================================
       RENDER — Left Pane: Audio List
       ============================================================ */
    function renderListPane() {
        var filtered = getFilteredAudio();

        var html = '';
        html += '<div class="audio-list-pane">';
        html += '<div class="audio-list-header">' + filtered.length + ' asset' + (filtered.length !== 1 ? 's' : '') + '</div>';
        html += '<div class="audio-list-scroll">';

        for (var i = 0; i < filtered.length; i++) {
            var a = filtered[i];
            var isSelected = selectedTrack && selectedTrack.id === a.id;
            var catClass = a.category === 'UI' ? 'ui-cat' : a.category.toLowerCase();
            var icon = CATEGORY_ICONS[a.category] || '\u266B';

            html += '<div class="audio-list-item' + (isSelected ? ' selected' : '') + '" data-audio-id="' + a.id + '">';
            html += '<span class="audio-list-icon">' + icon + '</span>';
            html += '<div class="audio-list-info">';
            html += '<div class="audio-list-name">' + escapeHtml(a.name) + '</div>';
            html += '<div class="audio-list-meta">';
            html += '<span class="audio-list-badge ' + catClass + '">' + a.category + '</span>';
            html += '<span class="audio-list-fmt">' + a.format + '</span>';
            html += '<span class="audio-list-dur">' + a.duration + '</span>';
            if (a.loopable) {
                html += '<span class="audio-list-loop">\u221E</span>';
            }
            html += '</div>';
            html += '</div>';
            html += '</div>';
        }

        if (filtered.length === 0) {
            html += '<div style="padding:24px 12px;text-align:center;color:' + COLORS.dim + ';font-size:12px;">No matching audio assets</div>';
        }

        html += '</div>';
        html += '</div>';
        return html;
    }

    /* ============================================================
       RENDER — Center Pane: Audio Player
       ============================================================ */
    function renderPlayerPane() {
        var html = '';
        html += '<div class="audio-player-pane">';

        if (!selectedTrack) {
            /* Empty state */
            html += '<div class="audio-player-empty">';
            html += '<div class="audio-player-empty-icon">\uD83D\uDD0A</div>';
            html += '<div class="audio-player-empty-text">Select a track to preview</div>';
            html += '</div>';
        } else {
            html += '<div class="audio-player-active">';

            /* Track name */
            html += '<div class="audio-player-track-name">' + escapeHtml(selectedTrack.name) + '</div>';
            html += '<div class="audio-player-track-sub">' + selectedTrack.category + ' \u00B7 ' + selectedTrack.format + ' \u00B7 ' + selectedTrack.duration + '</div>';

            /* Waveform */
            html += '<div class="audio-waveform">';
            var barCount = 50;
            for (var i = 0; i < barCount; i++) {
                var h = getWaveformHeight(i, barCount);
                var pct = i / barCount;
                var r = Math.round(0 + pct * 212);
                var g = Math.round(212 - pct * 40);
                var b = Math.round(255 - pct * 200);
                html += '<div class="audio-waveform-bar" style="height:' + h + '%;background:rgb(' + r + ',' + g + ',' + b + ');opacity:0.7;"></div>';
            }
            html += '</div>';

            /* Scrub bar */
            html += '<div class="audio-scrub-area">';
            html += '<div class="audio-scrub-bar"><div class="audio-scrub-fill"></div></div>';
            html += '<div class="audio-scrub-times"><span>0:00</span><span>' + selectedTrack.duration + '</span></div>';
            html += '</div>';

            /* Transport */
            html += '<div class="audio-transport">';
            html += '<div class="audio-transport-btn" data-action="prev" title="Previous">\u23EE</div>';
            html += '<div class="audio-transport-btn' + (isPlaying ? ' active' : '') + ' play-btn" data-action="play" title="Play / Pause">' + (isPlaying ? '\u23F8' : '\u25B6') + '</div>';
            html += '<div class="audio-transport-btn" data-action="stop" title="Stop">\u23F9</div>';
            html += '<div class="audio-transport-btn" data-action="next" title="Next">\u23ED</div>';
            html += '</div>';

            /* Volume + Loop */
            html += '<div class="audio-extras-row">';
            html += '<div class="audio-volume-group">';
            html += '<span class="audio-volume-icon">\uD83D\uDD09</span>';
            html += '<input type="range" class="audio-volume-slider" min="0" max="100" value="80">';
            html += '</div>';
            html += '<div class="audio-loop-btn' + (isLooping ? ' active' : '') + '" data-action="loop">\u221E Loop</div>';
            html += '</div>';

            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    /* ============================================================
       RENDER — Right Pane: Detail Panel
       ============================================================ */
    function renderDetailPane() {
        var html = '';
        html += '<div class="audio-detail-pane">';

        if (!selectedTrack) {
            html += '<div class="audio-detail-empty">No track selected</div>';
        } else {
            var a = selectedTrack;
            var catClass = a.category === 'UI' ? 'ui-cat' : a.category.toLowerCase();
            var catColor = getCategoryColor(a.category);

            html += '<div class="audio-detail-scroll">';

            /* Name + category badge */
            html += '<div class="audio-detail-name">' + escapeHtml(a.name) + '</div>';
            html += '<div class="audio-detail-cat" style="background:' + hexToRgba(catColor, 0.15) + ';color:' + catColor + ';">' + a.category + '</div>';

            /* Info section */
            html += '<div class="audio-detail-section">';
            html += '<div class="audio-detail-section-title">Info</div>';
            html += detailRow('Format', a.format);
            html += detailRow('Duration', a.duration);
            html += detailRow('Source Type', a.source);
            html += detailRow('Package Origin', a.package);
            html += detailRow('Loopable', a.loopable ? 'Yes' : 'No');
            html += detailRow('Normalized', a.normalized ? 'Yes' : 'No');
            html += '</div>';

            /* Used In Games */
            html += '<div class="audio-detail-section">';
            html += '<div class="audio-detail-section-title">Used In Games</div>';
            html += '<ul class="audio-detail-games">';
            for (var i = 0; i < a.usedIn.length; i++) {
                html += '<li>' + escapeHtml(a.usedIn[i]) + '</li>';
            }
            html += '</ul>';
            html += '</div>';

            /* Tags */
            html += '<div class="audio-detail-section">';
            html += '<div class="audio-detail-section-title">Tags</div>';
            html += '<div class="audio-detail-tags">';
            for (var t = 0; t < a.tags.length; t++) {
                html += '<span class="audio-detail-tag">' + escapeHtml(a.tags[t]) + '</span>';
            }
            html += '</div>';
            html += '</div>';

            /* Source Path */
            html += '<div class="audio-detail-section">';
            html += '<div class="audio-detail-section-title">Source Path</div>';
            html += '<div class="audio-detail-path">' + escapeHtml(a.path) + '</div>';
            html += '</div>';

            /* Timestamps */
            html += '<div class="audio-detail-section">';
            html += '<div class="audio-detail-section-title">Timestamps</div>';
            html += '<div class="audio-detail-timestamps">';
            html += 'Created: ' + formatTimestamp(a.created) + '<br>';
            html += 'Indexed: ' + formatTimestamp(a.indexed);
            html += '</div>';
            html += '</div>';

            html += '</div>';

            /* Action buttons */
            html += '<div class="audio-detail-actions">';
            html += '<div class="audio-action-btn" data-action="reveal">Reveal in Folder</div>';
            html += '<div class="audio-action-btn" data-action="metadata">Open Metadata</div>';
            html += '<div class="audio-action-btn" data-action="copy-path">Copy Path</div>';
            html += '<div class="audio-action-btn" data-action="usage">Inspect Usage</div>';
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    /* ============================================================
       EVENTS
       ============================================================ */
    function bindEvents() {
        /* Search */
        var searchEl = document.getElementById('audio-search');
        if (searchEl) {
            searchEl.addEventListener('input', function () {
                searchQuery = this.value;
                render();
                /* Re-focus search and restore cursor */
                var el = document.getElementById('audio-search');
                if (el) { el.focus(); el.selectionStart = el.selectionEnd = el.value.length; }
            });
        }

        /* Category filter */
        var catEl = document.getElementById('audio-cat-filter');
        if (catEl) {
            catEl.addEventListener('change', function () {
                categoryFilter = this.value;
                render();
            });
        }

        /* Format filter */
        var fmtEl = document.getElementById('audio-fmt-filter');
        if (fmtEl) {
            fmtEl.addEventListener('change', function () {
                formatFilter = this.value;
                render();
            });
        }

        /* List item clicks */
        var items = rootEl.querySelectorAll('.audio-list-item');
        for (var i = 0; i < items.length; i++) {
            items[i].addEventListener('click', function () {
                var id = this.getAttribute('data-audio-id');
                selectTrack(id);
            });
        }

        /* Transport controls */
        var transportBtns = rootEl.querySelectorAll('.audio-transport-btn');
        for (var t = 0; t < transportBtns.length; t++) {
            transportBtns[t].addEventListener('click', function () {
                var action = this.getAttribute('data-action');
                handleTransport(action);
            });
        }

        /* Loop toggle */
        var loopBtn = rootEl.querySelector('.audio-loop-btn');
        if (loopBtn) {
            loopBtn.addEventListener('click', function () {
                isLooping = !isLooping;
                render();
            });
        }

        /* Action buttons */
        var actionBtns = rootEl.querySelectorAll('.audio-action-btn');
        for (var ab = 0; ab < actionBtns.length; ab++) {
            actionBtns[ab].addEventListener('click', function () {
                handleAction(this.getAttribute('data-action'));
            });
        }
    }

    /* ============================================================
       LOGIC
       ============================================================ */
    function selectTrack(id) {
        for (var i = 0; i < MOCK_AUDIO.length; i++) {
            if (MOCK_AUDIO[i].id === id) {
                selectedTrack = MOCK_AUDIO[i];
                isPlaying = false;
                render();
                return;
            }
        }
    }

    function handleTransport(action) {
        if (!selectedTrack) return;

        var filtered = getFilteredAudio();
        var idx = -1;
        for (var i = 0; i < filtered.length; i++) {
            if (filtered[i].id === selectedTrack.id) { idx = i; break; }
        }

        if (action === 'play') {
            isPlaying = !isPlaying;
            render();
        } else if (action === 'stop') {
            isPlaying = false;
            render();
        } else if (action === 'prev') {
            if (idx > 0) {
                selectedTrack = filtered[idx - 1];
                isPlaying = false;
                render();
            }
        } else if (action === 'next') {
            if (idx < filtered.length - 1) {
                selectedTrack = filtered[idx + 1];
                isPlaying = false;
                render();
            }
        }
    }

    function handleAction(action) {
        if (!selectedTrack) return;
        /* Stub actions — log to console */
        if (action === 'reveal') {
            console.log('[AudioTab] Reveal in folder: ' + selectedTrack.path);
        } else if (action === 'metadata') {
            console.log('[AudioTab] Open metadata: ' + selectedTrack.id);
        } else if (action === 'copy-path') {
            if (navigator.clipboard) {
                navigator.clipboard.writeText(selectedTrack.path).then(function () {
                    console.log('[AudioTab] Path copied: ' + selectedTrack.path);
                });
            }
        } else if (action === 'usage') {
            console.log('[AudioTab] Inspect usage: ' + selectedTrack.id + ' — used in: ' + selectedTrack.usedIn.join(', '));
        }
    }

    function getFilteredAudio() {
        var results = [];
        var q = searchQuery.toLowerCase();

        for (var i = 0; i < MOCK_AUDIO.length; i++) {
            var a = MOCK_AUDIO[i];

            /* Category filter */
            if (categoryFilter !== 'All' && a.category !== categoryFilter) continue;

            /* Format filter */
            if (formatFilter !== 'All' && a.format !== formatFilter) continue;

            /* Search query */
            if (q) {
                var haystack = (a.name + ' ' + a.category + ' ' + a.tags.join(' ')).toLowerCase();
                if (haystack.indexOf(q) === -1) continue;
            }

            results.push(a);
        }

        return results;
    }

    /* ============================================================
       HELPERS
       ============================================================ */

    /** Generate a deterministic pseudo-random waveform height for bar index. */
    function getWaveformHeight(index, total) {
        /* Simple seeded hash to get varied but repeatable heights */
        var seed = (selectedTrack ? selectedTrack.id.length * 7 : 42) + index * 13;
        var val = Math.abs(Math.sin(seed * 9.1 + index * 3.7) * 100);
        /* Taper at edges */
        var edge = Math.min(index, total - 1 - index);
        var taper = Math.min(edge / 5, 1);
        var h = val * taper;
        return Math.max(4, Math.min(98, Math.round(h)));
    }

    function getCategoryColor(cat) {
        if (cat === 'Music') return COLORS.music;
        if (cat === 'SFX') return COLORS.sfx;
        if (cat === 'Ambient') return COLORS.ambient;
        if (cat === 'UI') return COLORS.ui;
        return COLORS.dim;
    }

    function hexToRgba(hex, alpha) {
        var r = parseInt(hex.slice(1, 3), 16);
        var g = parseInt(hex.slice(3, 5), 16);
        var b = parseInt(hex.slice(5, 7), 16);
        return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    }

    function detailRow(label, value) {
        return '<div class="audio-detail-row"><span class="audio-detail-label">' + escapeHtml(label) + '</span><span class="audio-detail-value">' + escapeHtml(String(value)) + '</span></div>';
    }

    function formatTimestamp(iso) {
        if (!iso) return '\u2014';
        var d = new Date(iso);
        var y = d.getFullYear();
        var m = pad2(d.getMonth() + 1);
        var day = pad2(d.getDate());
        var h = pad2(d.getHours());
        var min = pad2(d.getMinutes());
        return y + '-' + m + '-' + day + ' ' + h + ':' + min;
    }

    function pad2(n) {
        return n < 10 ? '0' + n : '' + n;
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function escapeAttr(str) {
        return escapeHtml(str);
    }

    /* ============================================================
       PUBLIC API
       ============================================================ */
    return {
        init: init
    };

})();
