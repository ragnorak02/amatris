/* ============================================================
   file-preview.js — File preview modal
   Fetches file content via /api/file, renders by extension:
   .md → markdown, .json → colorized pretty-print, others → code view.
   ============================================================ */

var FilePreview = (function () {
    'use strict';

    var modalEl, dialogEl, backdropEl, titleEl, badgeEl, contentEl, metaEl;
    var currentPath = null;

    function init() {
        modalEl = document.getElementById('file-preview-modal');
        if (!modalEl) return;

        dialogEl = modalEl.querySelector('.preview-dialog');
        backdropEl = modalEl.querySelector('.preview-backdrop');
        titleEl = modalEl.querySelector('.preview-title');
        badgeEl = document.getElementById('preview-type-badge');
        contentEl = modalEl.querySelector('.preview-content');
        metaEl = document.getElementById('preview-meta-inline');

        // Close button
        var closeBtn = modalEl.querySelector('.preview-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', close);
        }

        // Backdrop click closes modal
        if (backdropEl) {
            backdropEl.addEventListener('click', close);
        }

        // Download button
        var downloadBtn = document.getElementById('preview-download-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', function () {
                if (currentPath) {
                    var a = document.createElement('a');
                    a.href = '/' + currentPath;
                    a.download = currentPath.split('/').pop();
                    a.click();
                }
            });
        }

        // Escape key closes preview
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && modalEl.classList.contains('open')) {
                close();
                e.preventDefault();
                e.stopPropagation();
            }
        });
    }

    function open(filePath) {
        if (!modalEl) return;

        currentPath = filePath;
        var fileName = filePath.split('/').pop();
        var ext = getExt(fileName);

        if (titleEl) titleEl.textContent = fileName;
        updateBadge(ext);

        // Show loading state
        if (contentEl) {
            contentEl.innerHTML = '<div class="stub-message">Loading...</div>';
        }
        if (metaEl) metaEl.textContent = '';

        modalEl.classList.remove('hidden');
        // Force reflow so the transition works
        modalEl.offsetHeight;
        modalEl.classList.add('open');

        // Push InputManager context if available
        if (typeof InputManager !== 'undefined' && InputManager.pushContext) {
            InputManager.pushContext('file_preview');
        }

        // Fetch file content
        fetch('/api/file?path=' + encodeURIComponent(filePath))
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.error) {
                    contentEl.innerHTML = '<div class="stub-message">' + escapeHtml(data.error) + '</div>';
                    return;
                }

                renderContent(data);
            })
            .catch(function () {
                contentEl.innerHTML = '<div class="stub-message">Failed to load file</div>';
            });
    }

    function updateBadge(ext) {
        if (!badgeEl) return;
        switch (ext) {
            case '.md':
                badgeEl.textContent = 'MD';
                badgeEl.className = 'preview-type-badge badge-md';
                break;
            case '.json':
                badgeEl.textContent = 'JSON';
                badgeEl.className = 'preview-type-badge badge-json';
                break;
            default:
                badgeEl.textContent = ext ? ext.replace('.', '').toUpperCase() : 'FILE';
                badgeEl.className = 'preview-type-badge badge-code';
                break;
        }
    }

    function renderContent(data) {
        if (!contentEl) return;

        var ext = (data.ext || '').toLowerCase();
        var html = '';

        switch (ext) {
            case '.md':
                html += '<div class="preview-markdown">' + renderMarkdown(data.content) + '</div>';
                break;
            case '.json':
                html += '<pre class="preview-code preview-json">' + colorizeJson(data.content) + '</pre>';
                break;
            default:
                html += '<pre class="preview-code">' + escapeHtml(data.content) + '</pre>';
                break;
        }

        contentEl.innerHTML = html;

        // Update footer meta
        if (metaEl) {
            var parts = [escapeHtml(data.path), formatSize(data.size)];
            if (data.modified) {
                parts.push('Modified: ' + formatDate(data.modified));
            }
            metaEl.innerHTML = parts.join(' &bull; ');
        }
    }

    /* ============================================================
       MARKDOWN RENDERER — Minimal but functional
       ============================================================ */
    function renderMarkdown(text) {
        if (!text) return '';

        var lines = text.split('\n');
        var html = '';
        var inCodeBlock = false;
        var inList = false;
        var inTable = false;

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];

            // Code blocks
            if (line.match(/^```/)) {
                if (inCodeBlock) {
                    html += '</code></pre>';
                    inCodeBlock = false;
                } else {
                    if (inList) { html += '</ul>'; inList = false; }
                    if (inTable) { html += '</table>'; inTable = false; }
                    html += '<pre class="md-code-block"><code>';
                    inCodeBlock = true;
                }
                continue;
            }

            if (inCodeBlock) {
                html += escapeHtml(line) + '\n';
                continue;
            }

            // Empty line
            if (line.trim() === '') {
                if (inList) { html += '</ul>'; inList = false; }
                if (inTable) { html += '</table>'; inTable = false; }
                continue;
            }

            // Headers
            var headerMatch = line.match(/^(#{1,6})\s+(.+)/);
            if (headerMatch) {
                if (inList) { html += '</ul>'; inList = false; }
                if (inTable) { html += '</table>'; inTable = false; }
                var level = headerMatch[1].length;
                html += '<h' + level + ' class="md-h">' + inlineFormat(headerMatch[2]) + '</h' + level + '>';
                continue;
            }

            // Table rows (detect by |)
            if (line.match(/^\|/)) {
                // Skip separator rows
                if (line.match(/^\|[\s-:|]+\|$/)) continue;

                if (!inTable) {
                    if (inList) { html += '</ul>'; inList = false; }
                    html += '<table class="md-table">';
                    inTable = true;
                }

                var cells = line.split('|').filter(function (c, idx, arr) {
                    return idx > 0 && idx < arr.length - 1;
                });
                html += '<tr>';
                for (var c = 0; c < cells.length; c++) {
                    html += '<td>' + inlineFormat(cells[c].trim()) + '</td>';
                }
                html += '</tr>';
                continue;
            }

            // Checkbox list items
            var checkMatch = line.match(/^(\s*)[-*]\s+\[([ xX])\]\s+(.*)/);
            if (checkMatch) {
                if (!inList) { html += '<ul class="md-list">'; inList = true; }
                if (inTable) { html += '</table>'; inTable = false; }
                var checked = checkMatch[2] !== ' ';
                html += '<li class="md-checkbox">' +
                    '<span class="md-check ' + (checked ? 'checked' : '') + '">' +
                    (checked ? '\u2611' : '\u2610') + '</span> ' +
                    inlineFormat(checkMatch[3]) + '</li>';
                continue;
            }

            // Regular list items
            var listMatch = line.match(/^(\s*)[-*]\s+(.*)/);
            if (listMatch) {
                if (!inList) { html += '<ul class="md-list">'; inList = true; }
                if (inTable) { html += '</table>'; inTable = false; }
                html += '<li>' + inlineFormat(listMatch[2]) + '</li>';
                continue;
            }

            // Numbered list
            var numMatch = line.match(/^(\s*)\d+\.\s+(.*)/);
            if (numMatch) {
                if (!inList) { html += '<ul class="md-list md-ordered">'; inList = true; }
                if (inTable) { html += '</table>'; inTable = false; }
                html += '<li>' + inlineFormat(numMatch[2]) + '</li>';
                continue;
            }

            // Horizontal rule
            if (line.match(/^[-*_]{3,}\s*$/)) {
                if (inList) { html += '</ul>'; inList = false; }
                if (inTable) { html += '</table>'; inTable = false; }
                html += '<hr class="md-hr">';
                continue;
            }

            // Paragraph
            if (inList) { html += '</ul>'; inList = false; }
            if (inTable) { html += '</table>'; inTable = false; }
            html += '<p class="md-p">' + inlineFormat(line) + '</p>';
        }

        if (inList) html += '</ul>';
        if (inTable) html += '</table>';
        if (inCodeBlock) html += '</code></pre>';

        return html;
    }

    /* Inline markdown formatting */
    function inlineFormat(text) {
        var s = escapeHtml(text);
        // Bold
        s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        // Italic
        s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
        // Inline code
        s = s.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');
        // Links [text](url) — only http, https, mailto, or relative paths
        s = s.replace(/\[([^\]]+)\]\(((?:https?:\/\/|mailto:|[./])[^)]*)\)/g,
            '<a class="md-link" href="$2" target="_blank" rel="noopener">$1</a>');
        return s;
    }

    /* ============================================================
       JSON RENDERER — Colorized syntax highlighting
       ============================================================ */
    function colorizeJson(content) {
        try {
            var parsed = JSON.parse(content);
            var pretty = JSON.stringify(parsed, null, 2);
            return colorizeJsonString(pretty);
        } catch (e) {
            return escapeHtml(content);
        }
    }

    function colorizeJsonString(str) {
        var result = '';
        var i = 0;
        var len = str.length;

        while (i < len) {
            var ch = str[i];

            // String
            if (ch === '"') {
                var strVal = readJsonString(str, i);
                var escaped = escapeHtml(strVal);
                // Check if this is a key (followed by colon)
                var afterStr = i + strVal.length;
                var next = skipWhitespace(str, afterStr);
                if (next < len && str[next] === ':') {
                    result += '<span class="json-key">' + escaped + '</span>';
                } else {
                    result += '<span class="json-str">' + escaped + '</span>';
                }
                i += strVal.length;
                continue;
            }

            // Number
            if (ch === '-' || (ch >= '0' && ch <= '9')) {
                var numStr = readJsonNumber(str, i);
                result += '<span class="json-num">' + escapeHtml(numStr) + '</span>';
                i += numStr.length;
                continue;
            }

            // Boolean / null
            if (str.substr(i, 4) === 'true') {
                result += '<span class="json-bool">true</span>';
                i += 4;
                continue;
            }
            if (str.substr(i, 5) === 'false') {
                result += '<span class="json-bool">false</span>';
                i += 5;
                continue;
            }
            if (str.substr(i, 4) === 'null') {
                result += '<span class="json-null">null</span>';
                i += 4;
                continue;
            }

            // Brackets and braces
            if (ch === '{' || ch === '}' || ch === '[' || ch === ']') {
                result += '<span class="json-bracket">' + ch + '</span>';
                i++;
                continue;
            }

            // Everything else (whitespace, commas, colons)
            result += escapeHtml(ch);
            i++;
        }

        return result;
    }

    function readJsonString(str, start) {
        var i = start + 1; // skip opening quote
        while (i < str.length) {
            if (str[i] === '\\') {
                i += 2; // skip escaped character
            } else if (str[i] === '"') {
                return str.substring(start, i + 1);
            } else {
                i++;
            }
        }
        return str.substring(start);
    }

    function readJsonNumber(str, start) {
        var i = start;
        if (str[i] === '-') i++;
        while (i < str.length && str[i] >= '0' && str[i] <= '9') i++;
        if (i < str.length && str[i] === '.') {
            i++;
            while (i < str.length && str[i] >= '0' && str[i] <= '9') i++;
        }
        if (i < str.length && (str[i] === 'e' || str[i] === 'E')) {
            i++;
            if (i < str.length && (str[i] === '+' || str[i] === '-')) i++;
            while (i < str.length && str[i] >= '0' && str[i] <= '9') i++;
        }
        return str.substring(start, i);
    }

    function skipWhitespace(str, i) {
        while (i < str.length && (str[i] === ' ' || str[i] === '\n' || str[i] === '\r' || str[i] === '\t')) i++;
        return i;
    }

    /* ============================================================
       UTILITIES
       ============================================================ */
    function close() {
        if (!modalEl) return;
        modalEl.classList.remove('open');
        currentPath = null;

        // Pop InputManager context if available
        if (typeof InputManager !== 'undefined' && InputManager.popContext && InputManager.getContext) {
            if (InputManager.getContext() === 'file_preview') {
                InputManager.popContext();
            }
        }

        // Hide after transition
        setTimeout(function () {
            if (!modalEl.classList.contains('open')) {
                modalEl.classList.add('hidden');
            }
        }, 300);
    }

    function isOpen() {
        return modalEl && modalEl.classList.contains('open');
    }

    function getExt(filename) {
        var dot = filename.lastIndexOf('.');
        return dot !== -1 ? filename.substring(dot).toLowerCase() : '';
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function formatDate(isoStr) {
        if (!isoStr) return '';
        var d = new Date(isoStr);
        var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
            ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    }

    return { init: init, open: open, close: close, isOpen: isOpen };
})();
