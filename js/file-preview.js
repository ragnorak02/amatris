/* ============================================================
   file-preview.js — File preview side panel
   Fetches file content via /api/file, renders by extension:
   .md → markdown, .json → pretty-print, others → code view.
   ============================================================ */

var FilePreview = (function () {
    'use strict';

    var panelEl, titleEl, contentEl, actionsEl;
    var currentPath = null;

    function init() {
        panelEl = document.getElementById('file-preview-panel');
        if (!panelEl) return;

        titleEl = panelEl.querySelector('.preview-title');
        contentEl = panelEl.querySelector('.preview-content');
        actionsEl = panelEl.querySelector('.preview-actions');

        // Close button
        var closeBtn = panelEl.querySelector('.preview-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', close);
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
            if (e.key === 'Escape' && panelEl.classList.contains('open')) {
                close();
            }
        });
    }

    function open(filePath) {
        if (!panelEl) return;

        currentPath = filePath;
        var fileName = filePath.split('/').pop();
        if (titleEl) titleEl.textContent = fileName;

        // Show loading state
        if (contentEl) {
            contentEl.innerHTML = '<div class="stub-message">Loading...</div>';
        }

        panelEl.classList.remove('hidden');
        panelEl.classList.add('open');

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

    function renderContent(data) {
        if (!contentEl) return;

        var ext = (data.ext || '').toLowerCase();
        var html = '';

        // File metadata bar
        html += '<div class="preview-meta">' +
            '<span>' + escapeHtml(data.path) + '</span>' +
            '<span>' + formatSize(data.size) + '</span>' +
        '</div>';

        switch (ext) {
            case '.md':
                html += '<div class="preview-markdown">' + renderMarkdown(data.content) + '</div>';
                break;
            case '.json':
                html += '<pre class="preview-code preview-json">' + renderJson(data.content) + '</pre>';
                break;
            default:
                html += '<pre class="preview-code">' + escapeHtml(data.content) + '</pre>';
                break;
        }

        contentEl.innerHTML = html;
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
        return s;
    }

    /* ============================================================
       JSON RENDERER — Pretty-print with syntax highlighting
       ============================================================ */
    function renderJson(content) {
        try {
            var parsed = JSON.parse(content);
            var pretty = JSON.stringify(parsed, null, 2);
            return escapeHtml(pretty);
        } catch (e) {
            return escapeHtml(content);
        }
    }

    /* ============================================================
       UTILITIES
       ============================================================ */
    function close() {
        if (!panelEl) return;
        panelEl.classList.remove('open');
        currentPath = null;
    }

    function isOpen() {
        return panelEl && panelEl.classList.contains('open');
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

    return { init: init, open: open, close: close, isOpen: isOpen };
})();
