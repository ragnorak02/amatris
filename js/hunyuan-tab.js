/* ============================================================
   hunyuan-tab.js — Hunyuan 3D Asset Browser Tab for LUMINA
   Features:
     - Folder tree browser (lazy-loaded from /api/browse)
     - 3D model preview (Three.js GLTFLoader)
     - Asset approval workflow (staging → shared_assets)
     - Model generation controls
   ============================================================ */

var HunyuanTab = (function () {
    'use strict';

    /* ---- Constants ---- */
    var STYLE_ID = 'hunyuan-tab-styles';
    var ROOT_ID = 'mode-hunyuan';

    /* ---- State ---- */
    var rootEl = null;
    var selectedFilePath = null;
    var selectedEntry = null;
    var treeCache = {};
    var expandedDirs = {};
    var loadingDirs = {};
    var treeSearchQuery = '';

    /* ---- File type sets ---- */
    var MODEL_EXTS = ['.glb', '.gltf', '.fbx', '.obj', '.blend'];
    var IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'];
    var PREVIEWABLE_EXTS = ['.glb', '.gltf'];

    function isModel(ext) { return MODEL_EXTS.indexOf(ext) !== -1; }
    function isImage(ext) { return IMAGE_EXTS.indexOf(ext) !== -1; }
    function isPreviewable(ext) { return PREVIEWABLE_EXTS.indexOf(ext) !== -1; }

    /* ---- Three.js viewer state ---- */
    var threeScene = null;
    var threeCamera = null;
    var threeRenderer = null;
    var threeControls = null;
    var threeAnimId = null;
    var currentModelUrl = null;
    var loadedModel = null;
    var originalMaterials = [];  // [{mesh, material}] for restoring textures

    /* ---- View options ---- */
    var viewOpts = {
        showTextures: true,
        wireframe: false,
        showGrid: true,
        autoRotate: false,
        matcap: false           // clay/matcap shading
    };
    var gridHelper = null;

    /* ============================================================
       STYLES
       ============================================================ */
    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        var s = document.createElement('style');
        s.id = STYLE_ID;
        s.textContent = [
            /* Root */
            '#hunyuan-browser { display: flex; flex-direction: column; height: 100%; font-family: "Segoe UI", system-ui, sans-serif; color: #e0dcd0; background: #0a0a12; }',

            /* Toolbar */
            '.hy-toolbar { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0; }',
            '.hy-toolbar-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #d4af37; margin-right: 8px; }',
            '.hy-toolbar-btn { display: flex; align-items: center; gap: 5px; padding: 5px 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 4px; color: #e0dcd0; font-size: 11px; cursor: pointer; transition: all 0.15s; font-family: inherit; }',
            '.hy-toolbar-btn:hover { background: rgba(212,175,55,0.1); border-color: rgba(212,175,55,0.3); color: #f0c850; }',
            '.hy-toolbar-btn.active { background: rgba(212,175,55,0.15); border-color: #d4af37; color: #f0c850; }',
            '.hy-toolbar-btn.primary { background: rgba(212,175,55,0.12); border-color: rgba(212,175,55,0.3); color: #f0c850; }',
            '.hy-toolbar-btn.primary:hover { background: rgba(212,175,55,0.2); border-color: #d4af37; }',
            '.hy-toolbar-btn.approve { background: rgba(34,197,94,0.1); border-color: rgba(34,197,94,0.3); color: #22c55e; }',
            '.hy-toolbar-btn.approve:hover { background: rgba(34,197,94,0.2); border-color: #22c55e; }',
            '.hy-toolbar-sep { width: 1px; height: 20px; background: rgba(255,255,255,0.06); margin: 0 4px; }',
            '.hy-toolbar-spacer { flex: 1; }',
            '.hy-toolbar-search { padding: 5px 8px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 4px; color: #e0dcd0; font-size: 12px; width: 180px; outline: none; font-family: inherit; }',
            '.hy-toolbar-search:focus { border-color: #d4af37; }',
            '.hy-toolbar-search::placeholder { color: #4a4540; }',

            /* 3-pane body */
            '.hy-panes { display: flex; flex: 1; min-height: 0; overflow: hidden; }',

            /* Left pane — folder tree */
            '.hy-tree-pane { width: 280px; min-width: 200px; border-right: 1px solid rgba(255,255,255,0.06); display: flex; flex-direction: column; flex-shrink: 0; }',
            '.hy-tree-header { display: flex; align-items: center; gap: 6px; padding: 8px 10px; background: rgba(255,255,255,0.015); border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; color: #6a6450; font-weight: 600; flex-shrink: 0; }',
            '.hy-tree-scroll { flex: 1; overflow-y: auto; overflow-x: hidden; }',
            '.hy-tree-scroll::-webkit-scrollbar { width: 6px; }',
            '.hy-tree-scroll::-webkit-scrollbar-track { background: transparent; }',
            '.hy-tree-scroll::-webkit-scrollbar-thumb { background: rgba(212,175,55,0.2); border-radius: 3px; }',

            /* Tree nodes */
            '.hy-tree-node { display: flex; align-items: center; gap: 4px; padding: 3px 8px; cursor: pointer; transition: background 0.12s; white-space: nowrap; font-size: 12px; user-select: none; min-height: 24px; }',
            '.hy-tree-node:hover { background: rgba(255,255,255,0.03); }',
            '.hy-tree-node.selected { background: rgba(212,175,55,0.12); }',
            '.hy-tree-node.model-file { color: #00d4ff; }',
            '.hy-tree-node.image-file { color: #a78bfa; }',
            '.hy-tree-arrow { width: 14px; font-size: 10px; color: #6a6450; text-align: center; flex-shrink: 0; }',
            '.hy-tree-icon { font-size: 14px; flex-shrink: 0; width: 18px; text-align: center; }',
            '.hy-tree-name { flex: 1; overflow: hidden; text-overflow: ellipsis; }',
            '.hy-tree-size { font-size: 10px; color: #4a4540; margin-left: auto; padding-left: 8px; flex-shrink: 0; }',
            '.hy-tree-badge { font-size: 9px; padding: 1px 5px; border-radius: 3px; background: rgba(0,212,255,0.12); color: #00d4ff; margin-left: 4px; flex-shrink: 0; font-weight: 600; }',
            '.hy-tree-loading { padding: 6px 8px; font-size: 11px; color: #4a4540; font-style: italic; }',

            /* Center pane — viewer */
            '.hy-viewer { flex: 1; display: flex; flex-direction: column; background: #07070d; position: relative; min-width: 0; }',
            '.hy-viewer-surface { flex: 1; display: flex; align-items: center; justify-content: center; position: relative; }',
            '.hy-viewer-empty { text-align: center; color: #6a6450; user-select: none; }',
            '.hy-viewer-empty-icon { font-size: 64px; margin-bottom: 12px; opacity: 0.3; }',
            '.hy-viewer-empty-text { font-size: 14px; }',
            '.hy-viewer-empty-sub { font-size: 12px; color: #4a4540; margin-top: 6px; }',
            '.hy-viewer-loading { position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: #d4af37; user-select: none; z-index: 5; background: #07070d; }',
            '.hy-viewer-loading-text { font-size: 14px; color: #e0dcd0; }',
            '.hy-viewer-loading-sub { font-size: 12px; color: #6a6450; margin-top: 4px; }',
            '.hy-viewer-controls { padding: 6px 14px; text-align: center; font-size: 11px; color: #4a4540; border-top: 1px solid rgba(255,255,255,0.04); flex-shrink: 0; }',
            /* Image preview */
            '.hy-viewer-image { max-width: 90%; max-height: 90%; object-fit: contain; border-radius: 4px; box-shadow: 0 4px 24px rgba(0,0,0,0.5); }',

            /* Right pane — detail */
            '.hy-detail { width: 280px; min-width: 220px; border-left: 1px solid rgba(255,255,255,0.06); overflow-y: auto; flex-shrink: 0; }',
            '.hy-detail::-webkit-scrollbar { width: 6px; }',
            '.hy-detail::-webkit-scrollbar-track { background: transparent; }',
            '.hy-detail::-webkit-scrollbar-thumb { background: rgba(212,175,55,0.2); border-radius: 3px; }',
            '.hy-detail-empty { display: flex; align-items: center; justify-content: center; height: 100%; color: #4a4540; font-size: 13px; text-align: center; padding: 20px; }',
            '.hy-detail-content { padding: 14px; }',
            '.hy-detail-title { font-size: 16px; font-weight: 700; color: #f0c850; margin: 0 0 4px 0; word-break: break-word; }',
            '.hy-detail-subtitle { font-size: 11px; color: #6a6450; margin-bottom: 12px; }',

            '.hy-detail-section { margin-bottom: 12px; }',
            '.hy-detail-section-title { font-size: 10px; text-transform: uppercase; letter-spacing: 0.7px; color: #6a6450; margin-bottom: 5px; font-weight: 600; }',
            '.hy-detail-row { display: flex; justify-content: space-between; align-items: center; padding: 3px 0; font-size: 12px; }',
            '.hy-detail-label { color: #6a6450; }',
            '.hy-detail-value { color: #e0dcd0; text-align: right; max-width: 55%; word-break: break-word; font-family: "Cascadia Code", "Consolas", monospace; font-size: 11px; }',
            '.hy-detail-path { font-size: 11px; color: #e0dcd0; word-break: break-all; font-family: "Cascadia Code", "Consolas", monospace; background: rgba(255,255,255,0.03); padding: 6px 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.04); }',

            '.hy-detail-divider { border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 12px 0; }',

            /* Preview thumbnail in detail */
            '.hy-detail-preview { width: 100%; border-radius: 4px; margin-bottom: 12px; border: 1px solid rgba(255,255,255,0.06); }',

            /* View options toggles */
            '.hy-view-opts { display: flex; flex-direction: column; gap: 2px; }',
            '.hy-view-opt { display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-radius: 4px; cursor: pointer; transition: background 0.12s; user-select: none; font-size: 12px; }',
            '.hy-view-opt:hover { background: rgba(255,255,255,0.03); }',
            '.hy-view-opt input[type="checkbox"] { appearance: none; -webkit-appearance: none; width: 14px; height: 14px; border: 1px solid rgba(255,255,255,0.15); border-radius: 3px; background: rgba(255,255,255,0.04); cursor: pointer; position: relative; flex-shrink: 0; transition: all 0.15s; }',
            '.hy-view-opt input[type="checkbox"]:checked { background: rgba(212,175,55,0.3); border-color: #d4af37; }',
            '.hy-view-opt input[type="checkbox"]:checked::after { content: ""; position: absolute; top: 1px; left: 4px; width: 4px; height: 7px; border: solid #f0c850; border-width: 0 2px 2px 0; transform: rotate(45deg); }',
            '.hy-view-opt-label { color: #e0dcd0; flex: 1; }',
            '.hy-view-opt-hint { font-size: 10px; color: #4a4540; }',

            /* Action buttons */
            '.hy-actions { display: flex; flex-direction: column; gap: 5px; }',
            '.hy-action-btn { display: flex; align-items: center; gap: 7px; padding: 7px 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 4px; color: #e0dcd0; font-size: 12px; cursor: pointer; transition: all 0.15s; font-family: inherit; }',
            '.hy-action-btn:hover { background: rgba(212,175,55,0.1); border-color: rgba(212,175,55,0.3); }',
            '.hy-action-btn-icon { font-size: 14px; width: 18px; text-align: center; flex-shrink: 0; }',
            '.hy-action-btn.approve-btn { border-color: rgba(34,197,94,0.3); color: #22c55e; }',
            '.hy-action-btn.approve-btn:hover { background: rgba(34,197,94,0.15); border-color: #22c55e; }',
            '.hy-action-btn.generate-btn { border-color: rgba(167,139,250,0.3); color: #a78bfa; }',
            '.hy-action-btn.generate-btn:hover { background: rgba(167,139,250,0.15); border-color: #a78bfa; }',
            '.hy-action-btn.gold-btn { border-color: rgba(212,175,55,0.25); color: #f0c850; }',
            '.hy-action-btn.gold-btn:hover { background: rgba(212,175,55,0.15); border-color: #d4af37; }',

            /* Toast notifications */
            '.hy-toast { position: fixed; bottom: 60px; right: 20px; padding: 10px 18px; border-radius: 6px; font-size: 13px; z-index: 9999; animation: hyToastIn 0.3s ease; pointer-events: none; }',
            '.hy-toast.success { background: rgba(34,197,94,0.9); color: #fff; }',
            '.hy-toast.error { background: rgba(239,68,68,0.9); color: #fff; }',
            '.hy-toast.info { background: rgba(212,175,55,0.9); color: #0a0a12; }',
            '@keyframes hyToastIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }',

            ''
        ].join('\n');
        document.head.appendChild(s);
    }

    /* ============================================================
       HELPERS
       ============================================================ */
    function escapeHtml(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    function formatSize(bytes) {
        if (bytes == null) return '';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }

    function formatDate(iso) {
        if (!iso) return '\u2014';
        var d = new Date(iso);
        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return months[d.getMonth()] + ' ' + d.getDate() + ' ' +
            String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }

    function getFileIcon(entry) {
        if (entry.type === 'dir') return '\uD83D\uDCC1'; // folder
        var ext = entry.ext || '';
        if (isModel(ext)) return '\uD83D\uDD37'; // blue diamond
        if (isImage(ext)) return '\uD83D\uDDBC\uFE0F'; // framed picture
        if (ext === '.json') return '\uD83D\uDCCB'; // clipboard
        if (ext === '.md') return '\uD83D\uDCDD'; // memo
        if (ext === '.js') return '\uD83D\uDFE8'; // yellow square
        return '\uD83D\uDCC4'; // page
    }

    function showToast(message, type) {
        var existing = document.querySelector('.hy-toast');
        if (existing) existing.remove();
        var toast = document.createElement('div');
        toast.className = 'hy-toast ' + (type || 'info');
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(function() { toast.remove(); }, 2500);
    }

    /* ============================================================
       VIEW OPTIONS
       ============================================================ */
    function renderViewToggle(key, label, hint) {
        var checked = viewOpts[key] ? ' checked' : '';
        return '<label class="hy-view-opt">' +
            '<input type="checkbox" data-viewopt="' + key + '"' + checked + '>' +
            '<span class="hy-view-opt-label">' + escapeHtml(label) + '</span>' +
            '<span class="hy-view-opt-hint">' + escapeHtml(hint) + '</span>' +
            '</label>';
    }

    function applyViewOptions() {
        if (!loadedModel || !threeScene) return;
        var THREE = window.THREE;

        loadedModel.traverse(function(obj) {
            if (!obj.isMesh) return;

            // Wireframe
            if (obj.material) {
                var mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                for (var i = 0; i < mats.length; i++) {
                    mats[i].wireframe = viewOpts.wireframe;
                }
            }

            // Matcap (clay) — swap material to a neutral MeshMatcapMaterial
            if (viewOpts.matcap) {
                if (!obj.userData._origMaterial) {
                    obj.userData._origMaterial = obj.material;
                }
                if (!obj.userData._clayMaterial) {
                    obj.userData._clayMaterial = new THREE.MeshStandardMaterial({
                        color: 0xb0a090,
                        roughness: 0.7,
                        metalness: 0.1,
                        wireframe: viewOpts.wireframe
                    });
                }
                obj.material = obj.userData._clayMaterial;
                obj.material.wireframe = viewOpts.wireframe;
            } else if (!viewOpts.showTextures) {
                // No textures — use original material but disable maps
                if (!obj.userData._origMaterial) {
                    obj.userData._origMaterial = obj.material;
                }
                if (!obj.userData._untexturedMaterial) {
                    var orig = obj.userData._origMaterial;
                    var cloned = orig.clone();
                    cloned.map = null;
                    cloned.normalMap = null;
                    cloned.roughnessMap = null;
                    cloned.metalnessMap = null;
                    cloned.aoMap = null;
                    cloned.emissiveMap = null;
                    cloned.needsUpdate = true;
                    obj.userData._untexturedMaterial = cloned;
                }
                obj.material = obj.userData._untexturedMaterial;
                obj.material.wireframe = viewOpts.wireframe;
            } else {
                // Restore original material (show textures)
                if (obj.userData._origMaterial) {
                    obj.material = obj.userData._origMaterial;
                    obj.material.wireframe = viewOpts.wireframe;
                }
            }
        });

        // Grid
        if (gridHelper) {
            gridHelper.visible = viewOpts.showGrid;
        }

        // Auto-rotate
        if (threeControls) {
            threeControls.autoRotate = viewOpts.autoRotate;
            threeControls.autoRotateSpeed = 2.0;
        }
    }

    /* ============================================================
       API CALLS
       ============================================================ */
    function loadDirectory(dirPath) {
        if (treeCache[dirPath] !== undefined) return Promise.resolve(treeCache[dirPath]);
        if (loadingDirs[dirPath]) return Promise.resolve(null);

        loadingDirs[dirPath] = true;
        return fetch('/api/browse?dir=' + encodeURIComponent(dirPath))
            .then(function(r) { return r.json(); })
            .then(function(data) {
                treeCache[dirPath] = data.entries || [];
                delete loadingDirs[dirPath];
                return treeCache[dirPath];
            })
            .catch(function(err) {
                console.error('[HunyuanTab] Browse error:', err);
                delete loadingDirs[dirPath];
                treeCache[dirPath] = [];
                return [];
            });
    }

    function approveAsset(filePath) {
        return fetch('/api/assets/approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourcePath: filePath, targetDir: 'shared_assets/3d' })
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (data.status === 'approved') {
                showToast('Approved: ' + data.destination, 'success');
            } else {
                showToast('Error: ' + (data.error || 'Unknown'), 'error');
            }
            return data;
        })
        .catch(function(err) {
            showToast('Approve failed: ' + err.message, 'error');
        });
    }

    function revealInExplorer(filePath) {
        fetch('/api/open-path', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: filePath })
        }).catch(function() {});
    }

    function rebuildIndex() {
        showToast('Rebuilding 3D index...', 'info');
        fetch('/api/assets/rebuild-3d-index', { method: 'POST' })
            .then(function(r) { return r.json(); })
            .then(function(data) {
                showToast('Index rebuilt: ' + (data.assetCount || 0) + ' assets', 'success');
            })
            .catch(function(err) {
                showToast('Rebuild failed: ' + err.message, 'error');
            });
    }

    /* ============================================================
       TREE — Toggle / Select
       ============================================================ */
    function toggleDir(dirPath) {
        if (expandedDirs[dirPath]) {
            delete expandedDirs[dirPath];
            render();
        } else {
            expandedDirs[dirPath] = true;
            if (!treeCache[dirPath]) {
                loadDirectory(dirPath).then(function() { render(); });
            }
            render();
        }
    }

    function selectFile(entry) {
        selectedFilePath = entry.path;
        selectedEntry = entry;
        render();
    }

    /* ============================================================
       RENDER — Toolbar
       ============================================================ */
    function renderToolbar() {
        var html = '<div class="hy-toolbar">';
        html += '<span class="hy-toolbar-title">3D Asset Browser</span>';
        html += '<div class="hy-toolbar-sep"></div>';
        html += '<button class="hy-toolbar-btn" id="hy-btn-rebuild" title="Rescan all model directories">';
        html += '\u21BB Rebuild Index</button>';
        html += '<button class="hy-toolbar-btn primary" id="hy-btn-refresh" title="Refresh folder tree">';
        html += '\u21BB Refresh Tree</button>';
        html += '<div class="hy-toolbar-spacer"></div>';
        html += '<input type="text" class="hy-toolbar-search" id="hy-tree-search" placeholder="Filter tree\u2026" value="' + escapeHtml(treeSearchQuery) + '">';
        html += '</div>';
        return html;
    }

    /* ============================================================
       RENDER — Folder Tree (Left Pane)
       ============================================================ */
    function countModelsInDir(entries) {
        if (!entries) return 0;
        var count = 0;
        for (var i = 0; i < entries.length; i++) {
            if (entries[i].type === 'file' && isModel(entries[i].ext)) count++;
        }
        return count;
    }

    function renderTreeNodes(dirPath, depth) {
        var entries = treeCache[dirPath];
        if (!entries) {
            if (loadingDirs[dirPath]) {
                return '<div class="hy-tree-loading" style="padding-left:' + (depth * 16 + 28) + 'px">Loading\u2026</div>';
            }
            return '';
        }

        var html = '';
        var query = treeSearchQuery.toLowerCase();

        for (var i = 0; i < entries.length; i++) {
            var e = entries[i];

            // Filter by search
            if (query && e.name.toLowerCase().indexOf(query) === -1 && e.type === 'file') continue;

            var indent = depth * 16;
            var isExp = expandedDirs[e.path];
            var isSel = e.path === selectedFilePath;

            if (e.type === 'dir') {
                var arrow = isExp ? '\u25BE' : '\u25B8';
                var childModelCount = treeCache[e.path] ? countModelsInDir(treeCache[e.path]) : 0;
                html += '<div class="hy-tree-node' + (isSel ? ' selected' : '') + '" data-dir="' + escapeHtml(e.path) + '" style="padding-left:' + indent + 'px">';
                html += '<span class="hy-tree-arrow">' + arrow + '</span>';
                html += '<span class="hy-tree-icon">' + (isExp ? '\uD83D\uDCC2' : '\uD83D\uDCC1') + '</span>';
                html += '<span class="hy-tree-name">' + escapeHtml(e.name) + '</span>';
                if (childModelCount > 0) {
                    html += '<span class="hy-tree-badge">' + childModelCount + '</span>';
                }
                html += '</div>';

                if (isExp) {
                    html += renderTreeNodes(e.path, depth + 1);
                }
            } else {
                var cls = 'hy-tree-node';
                if (isSel) cls += ' selected';
                if (isModel(e.ext)) cls += ' model-file';
                if (isImage(e.ext)) cls += ' image-file';

                html += '<div class="' + cls + '" data-file="' + escapeHtml(e.path) + '" style="padding-left:' + (indent + 14) + 'px">';
                html += '<span class="hy-tree-icon">' + getFileIcon(e) + '</span>';
                html += '<span class="hy-tree-name">' + escapeHtml(e.name) + '</span>';
                if (e.size != null) {
                    html += '<span class="hy-tree-size">' + formatSize(e.size) + '</span>';
                }
                html += '</div>';
            }
        }

        return html;
    }

    function renderTreePane() {
        var html = '<div class="hy-tree-pane">';
        html += '<div class="hy-tree-header">\uD83D\uDCC1 Project Files</div>';
        html += '<div class="hy-tree-scroll" id="hy-tree-scroll">';
        html += renderTreeNodes('', 0);
        html += '</div>';
        html += '</div>';
        return html;
    }

    /* ============================================================
       RENDER — 3D Viewer (Center Pane)
       ============================================================ */
    function renderViewer() {
        var html = '<div class="hy-viewer-surface" id="hy-viewer-surface">';

        if (!selectedEntry) {
            html += '<div class="hy-viewer-empty">';
            html += '<div class="hy-viewer-empty-icon">';
            html += '<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">';
            html += '<path d="M32 8L56 20V44L32 56L8 44V20L32 8Z" stroke="#6a6450" stroke-width="1.5" fill="none" stroke-linejoin="round"/>';
            html += '<path d="M32 8L32 56" stroke="#6a6450" stroke-width="1" stroke-dasharray="3 3"/>';
            html += '<path d="M8 20L32 32L56 20" stroke="#6a6450" stroke-width="1" stroke-dasharray="3 3"/>';
            html += '</svg>';
            html += '</div>';
            html += '<div class="hy-viewer-empty-text">Select a file to preview</div>';
            html += '<div class="hy-viewer-empty-sub">Click any .glb or .gltf model in the tree</div>';
            html += '</div>';
        } else if (selectedEntry.type === 'file' && isPreviewable(selectedEntry.ext)) {
            html += '<div id="hy-three-container" style="width:100%;height:100%;"></div>';
            html += '<div class="hy-viewer-loading" id="hy-viewer-loading">';
            html += '<div class="hy-viewer-loading-text">Loading 3D model\u2026</div>';
            html += '<div class="hy-viewer-loading-sub">' + escapeHtml(selectedEntry.name) + '</div>';
            html += '</div>';
        } else if (selectedEntry.type === 'file' && isImage(selectedEntry.ext)) {
            html += '<img class="hy-viewer-image" src="/' + encodeURI(selectedEntry.path) + '" alt="' + escapeHtml(selectedEntry.name) + '">';
        } else if (selectedEntry.type === 'dir') {
            var dirEntries = treeCache[selectedEntry.path] || [];
            var modelCount = countModelsInDir(dirEntries);
            html += '<div class="hy-viewer-empty">';
            html += '<div class="hy-viewer-empty-icon">\uD83D\uDCC2</div>';
            html += '<div class="hy-viewer-empty-text">' + escapeHtml(selectedEntry.name) + '</div>';
            html += '<div class="hy-viewer-empty-sub">' + dirEntries.length + ' items' + (modelCount > 0 ? ' \u00B7 ' + modelCount + ' models' : '') + '</div>';
            html += '</div>';
        } else {
            html += '<div class="hy-viewer-empty">';
            html += '<div class="hy-viewer-empty-icon">' + getFileIcon(selectedEntry) + '</div>';
            html += '<div class="hy-viewer-empty-text">' + escapeHtml(selectedEntry.name) + '</div>';
            html += '<div class="hy-viewer-empty-sub">' + (selectedEntry.ext || '').toUpperCase() + ' \u00B7 ' + formatSize(selectedEntry.size) + '</div>';
            html += '</div>';
        }

        html += '</div>';
        html += '<div class="hy-viewer-controls">Drag to rotate \u00B7 Scroll to zoom \u00B7 Shift+drag to pan</div>';
        return '<div class="hy-viewer">' + html + '</div>';
    }

    /* ============================================================
       RENDER — Detail Panel (Right Pane)
       ============================================================ */
    function renderDetailPanel() {
        if (!selectedEntry) {
            return '<div class="hy-detail"><div class="hy-detail-empty">Select a file or folder<br>to view details</div></div>';
        }

        var e = selectedEntry;
        var html = '<div class="hy-detail-content">';

        /* Title */
        html += '<div class="hy-detail-title">' + escapeHtml(e.name) + '</div>';
        html += '<div class="hy-detail-subtitle">' + escapeHtml(e.path) + '</div>';

        /* Preview thumbnail if it's a model and has .glb.png */
        if (e.type === 'file' && isModel(e.ext)) {
            var previewPath = e.path + '.png';
            html += '<img class="hy-detail-preview" src="/' + encodeURI(previewPath) + '" alt="preview" onerror="this.style.display=\'none\'">';
        }

        /* File info */
        html += '<div class="hy-detail-section">';
        html += '<div class="hy-detail-section-title">File Info</div>';

        if (e.type === 'file') {
            html += '<div class="hy-detail-row"><span class="hy-detail-label">Type</span><span class="hy-detail-value">' + escapeHtml((e.ext || '').toUpperCase().replace('.', '')) + '</span></div>';
            html += '<div class="hy-detail-row"><span class="hy-detail-label">Size</span><span class="hy-detail-value">' + formatSize(e.size) + '</span></div>';
            if (e.mtime) {
                html += '<div class="hy-detail-row"><span class="hy-detail-label">Modified</span><span class="hy-detail-value">' + formatDate(e.mtime) + '</span></div>';
            }
            html += '<div class="hy-detail-row"><span class="hy-detail-label">3D Model</span><span class="hy-detail-value">' + (isModel(e.ext) ? '<span style="color:#22c55e">Yes</span>' : 'No') + '</span></div>';
            html += '<div class="hy-detail-row"><span class="hy-detail-label">Previewable</span><span class="hy-detail-value">' + (isPreviewable(e.ext) ? '<span style="color:#22c55e">Yes</span>' : '<span style="color:#6a6450">No</span>') + '</span></div>';
        } else {
            var dirEntries = treeCache[e.path] || [];
            html += '<div class="hy-detail-row"><span class="hy-detail-label">Type</span><span class="hy-detail-value">Directory</span></div>';
            html += '<div class="hy-detail-row"><span class="hy-detail-label">Items</span><span class="hy-detail-value">' + dirEntries.length + '</span></div>';
            html += '<div class="hy-detail-row"><span class="hy-detail-label">Models</span><span class="hy-detail-value">' + countModelsInDir(dirEntries) + '</span></div>';
        }
        html += '</div>';

        /* Path */
        html += '<div class="hy-detail-section">';
        html += '<div class="hy-detail-section-title">Path</div>';
        html += '<div class="hy-detail-path">' + escapeHtml(e.path) + '</div>';
        html += '</div>';

        /* View Options — only for previewable 3D models */
        if (e.type === 'file' && isPreviewable(e.ext)) {
            html += '<hr class="hy-detail-divider">';
            html += '<div class="hy-detail-section">';
            html += '<div class="hy-detail-section-title">View Options</div>';
            html += '<div class="hy-view-opts">';
            html += renderViewToggle('showTextures', 'Show Textures', 'Display embedded textures & materials');
            html += renderViewToggle('wireframe', 'Wireframe', 'Overlay wireframe on model');
            html += renderViewToggle('showGrid', 'Show Grid', 'Toggle ground grid');
            html += renderViewToggle('autoRotate', 'Auto-Rotate', 'Slowly spin the model');
            html += renderViewToggle('matcap', 'Clay / Matcap', 'Override with neutral clay material');
            html += '</div>';
            html += '</div>';
        }

        html += '<hr class="hy-detail-divider">';

        /* Actions */
        html += '<div class="hy-detail-section">';
        html += '<div class="hy-detail-section-title">Actions</div>';
        html += '<div class="hy-actions">';

        /* Reveal in Explorer */
        html += '<button class="hy-action-btn" data-action="reveal"><span class="hy-action-btn-icon">\uD83D\uDCC2</span>Reveal in Explorer</button>';

        /* Copy path */
        html += '<button class="hy-action-btn" data-action="copy-path"><span class="hy-action-btn-icon">\uD83D\uDCCE</span>Copy Path</button>';

        /* Model-specific actions */
        if (e.type === 'file' && isModel(e.ext)) {
            html += '<hr class="hy-detail-divider">';
            html += '<button class="hy-action-btn approve-btn" data-action="approve"><span class="hy-action-btn-icon">\u2705</span>Approve to Shared Assets</button>';
        }

        /* Directory-specific actions */
        if (e.type === 'dir') {
            html += '<hr class="hy-detail-divider">';
            var dirModels = treeCache[e.path] ? treeCache[e.path].filter(function(x) { return x.type === 'file' && isModel(x.ext); }) : [];
            if (dirModels.length > 0) {
                html += '<button class="hy-action-btn approve-btn" data-action="approve-all"><span class="hy-action-btn-icon">\u2705</span>Approve All Models (' + dirModels.length + ')</button>';
            }
            html += '<button class="hy-action-btn generate-btn" data-action="generate-folder"><span class="hy-action-btn-icon">\u2728</span>Generate Models (Folder)</button>';
        }

        /* Generate single */
        if (e.type === 'file') {
            html += '<button class="hy-action-btn generate-btn" data-action="generate-single"><span class="hy-action-btn-icon">\u2728</span>Generate Model</button>';
        }

        html += '</div>';
        html += '</div>';
        html += '</div>';

        return '<div class="hy-detail">' + html + '</div>';
    }

    /* ============================================================
       RENDER — Full Layout
       ============================================================ */
    function render() {
        if (!rootEl) return;

        var html = '<div id="hunyuan-browser">';
        html += renderToolbar();
        html += '<div class="hy-panes">';
        html += renderTreePane();
        html += renderViewer();
        html += renderDetailPanel();
        html += '</div>';
        html += '</div>';

        rootEl.innerHTML = html;
        bindEvents();

        // Init Three.js if a previewable model is selected
        if (selectedEntry && selectedEntry.type === 'file' && isPreviewable(selectedEntry.ext)) {
            initThreeViewer(selectedEntry);
        }
    }

    /* ============================================================
       THREE.JS VIEWER
       ============================================================ */
    function initThreeViewer(entry) {
        var modelUrl = '/' + entry.path;
        if (modelUrl === currentModelUrl) return;
        currentModelUrl = modelUrl;

        disposeThree();

        var container = document.getElementById('hy-three-container');
        if (!container) return;

        if (typeof window.THREE === 'undefined') {
            loadThreeJS(function() { buildScene(container, modelUrl); });
        } else {
            buildScene(container, modelUrl);
        }
    }

    function loadThreeJS(callback) {
        var base = 'https://cdn.jsdelivr.net/npm/three@0.137.0/';
        var script1 = document.createElement('script');
        script1.src = base + 'build/three.min.js';
        script1.onload = function() {
            var script2 = document.createElement('script');
            script2.src = base + 'examples/js/controls/OrbitControls.js';
            script2.onload = function() {
                var script3 = document.createElement('script');
                script3.src = base + 'examples/js/loaders/GLTFLoader.js';
                script3.onload = callback;
                document.head.appendChild(script3);
            };
            document.head.appendChild(script2);
        };
        document.head.appendChild(script1);
    }

    function buildScene(container, modelUrl) {
        var THREE = window.THREE;
        var w = container.clientWidth;
        var h = container.clientHeight;

        threeScene = new THREE.Scene();
        threeScene.background = new THREE.Color(0x07070d);

        threeCamera = new THREE.PerspectiveCamera(45, w / h, 0.01, 1000);
        threeCamera.position.set(0, 1.5, 3);

        threeRenderer = new THREE.WebGLRenderer({ antialias: true });
        threeRenderer.setSize(w, h);
        threeRenderer.setPixelRatio(window.devicePixelRatio);
        // r137 uses outputEncoding instead of outputColorSpace
        if (threeRenderer.outputColorSpace !== undefined) {
            threeRenderer.outputColorSpace = THREE.SRGBColorSpace;
        } else {
            threeRenderer.outputEncoding = THREE.sRGBEncoding;
        }
        threeRenderer.toneMapping = THREE.ACESFilmicToneMapping;
        threeRenderer.toneMappingExposure = 1.2;
        container.appendChild(threeRenderer.domElement);

        threeControls = new THREE.OrbitControls(threeCamera, threeRenderer.domElement);
        threeControls.enableDamping = true;
        threeControls.dampingFactor = 0.08;
        threeControls.target.set(0, 0.5, 0);

        // Lighting
        threeScene.add(new THREE.AmbientLight(0xffffff, 0.6));
        var dir1 = new THREE.DirectionalLight(0xffffff, 1.2);
        dir1.position.set(3, 5, 4);
        threeScene.add(dir1);
        var dir2 = new THREE.DirectionalLight(0x8888ff, 0.4);
        dir2.position.set(-3, 2, -4);
        threeScene.add(dir2);

        // Grid
        gridHelper = new THREE.GridHelper(10, 20, 0x2a2545, 0x1a1530);
        gridHelper.visible = viewOpts.showGrid;
        threeScene.add(gridHelper);

        // Auto-rotate
        threeControls.autoRotate = viewOpts.autoRotate;
        threeControls.autoRotateSpeed = 2.0;

        // Load model
        var loader = new THREE.GLTFLoader();
        loader.load(modelUrl, function(gltf) {
            loadedModel = gltf.scene;
            threeScene.add(loadedModel);

            // Store original materials for toggle restore
            loadedModel.traverse(function(obj) {
                if (obj.isMesh && obj.material) {
                    obj.userData._origMaterial = obj.material;
                }
            });

            var box = new THREE.Box3().setFromObject(loadedModel);
            var center = box.getCenter(new THREE.Vector3());
            var size = box.getSize(new THREE.Vector3());
            var maxDim = Math.max(size.x, size.y, size.z);
            var dist = maxDim * 1.8;
            threeCamera.position.set(center.x + dist * 0.5, center.y + dist * 0.4, center.z + dist * 0.7);
            threeControls.target.copy(center);
            threeControls.update();

            // Apply current view options
            applyViewOptions();

            var loading = document.getElementById('hy-viewer-loading');
            if (loading) loading.style.display = 'none';
        }, undefined, function(err) {
            console.error('[HunyuanTab] Model load error:', err);
            var loading = document.getElementById('hy-viewer-loading');
            if (loading) {
                loading.querySelector('.hy-viewer-loading-text').textContent = 'Failed to load model';
                loading.querySelector('.hy-viewer-loading-sub').textContent = String(err);
            }
        });

        function animate() {
            threeAnimId = requestAnimationFrame(animate);
            threeControls.update();
            threeRenderer.render(threeScene, threeCamera);
        }
        animate();

        var resizeObs = new ResizeObserver(function() {
            var nw = container.clientWidth;
            var nh = container.clientHeight;
            if (nw > 0 && nh > 0 && threeRenderer) {
                threeCamera.aspect = nw / nh;
                threeCamera.updateProjectionMatrix();
                threeRenderer.setSize(nw, nh);
            }
        });
        resizeObs.observe(container);
    }

    function disposeThree() {
        if (threeAnimId) { cancelAnimationFrame(threeAnimId); threeAnimId = null; }
        if (threeRenderer) {
            threeRenderer.dispose();
            var canvas = threeRenderer.domElement;
            if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
            threeRenderer = null;
        }
        if (threeScene) {
            threeScene.traverse(function(obj) {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(function(m) { m.dispose(); });
                    } else {
                        obj.material.dispose();
                    }
                }
            });
            threeScene = null;
        }
        threeCamera = null;
        threeControls = null;
        currentModelUrl = null;
        loadedModel = null;
        gridHelper = null;
    }

    /* ============================================================
       EVENT BINDING
       ============================================================ */
    function bindEvents() {
        /* Directory toggle */
        var dirNodes = rootEl.querySelectorAll('[data-dir]');
        for (var i = 0; i < dirNodes.length; i++) {
            (function(node) {
                node.addEventListener('click', function() {
                    var dirPath = this.getAttribute('data-dir');
                    toggleDir(dirPath);
                });
                /* Right-click to select dir without toggling */
                node.addEventListener('contextmenu', function(ev) {
                    ev.preventDefault();
                    var dirPath = this.getAttribute('data-dir');
                    var entry = findEntryByPath(dirPath);
                    if (entry) selectFile(entry);
                });
            })(dirNodes[i]);
        }

        /* File click */
        var fileNodes = rootEl.querySelectorAll('[data-file]');
        for (var j = 0; j < fileNodes.length; j++) {
            (function(node) {
                node.addEventListener('click', function() {
                    var filePath = this.getAttribute('data-file');
                    var entry = findEntryByPath(filePath);
                    if (entry) selectFile(entry);
                });
            })(fileNodes[j]);
        }

        /* Toolbar buttons */
        var rebuildBtn = document.getElementById('hy-btn-rebuild');
        if (rebuildBtn) rebuildBtn.addEventListener('click', rebuildIndex);

        var refreshBtn = document.getElementById('hy-btn-refresh');
        if (refreshBtn) refreshBtn.addEventListener('click', function() {
            treeCache = {};
            expandedDirs = {};
            loadDirectory('').then(function() { render(); });
        });

        /* Search */
        var searchEl = document.getElementById('hy-tree-search');
        if (searchEl) {
            searchEl.addEventListener('input', function() {
                treeSearchQuery = this.value;
                render();
                var newSearch = document.getElementById('hy-tree-search');
                if (newSearch) {
                    newSearch.focus();
                    newSearch.setSelectionRange(newSearch.value.length, newSearch.value.length);
                }
            });
        }

        /* Action buttons */
        var actionBtns = rootEl.querySelectorAll('.hy-action-btn');
        for (var b = 0; b < actionBtns.length; b++) {
            (function(btn) {
                btn.addEventListener('click', function(ev) {
                    ev.stopPropagation();
                    var action = this.getAttribute('data-action');
                    if (!selectedEntry) return;

                    if (action === 'reveal') {
                        revealInExplorer(selectedEntry.path);
                    } else if (action === 'copy-path') {
                        if (navigator.clipboard) {
                            navigator.clipboard.writeText(selectedEntry.path).then(function() {
                                showToast('Path copied', 'success');
                            }).catch(function() {});
                        }
                    } else if (action === 'approve') {
                        approveAsset(selectedEntry.path);
                    } else if (action === 'approve-all') {
                        approveAllInDir(selectedEntry.path);
                    } else if (action === 'generate-folder') {
                        showToast('Generation queued for: ' + selectedEntry.name, 'info');
                        // TODO: wire up actual generation
                    } else if (action === 'generate-single') {
                        showToast('Generation queued for: ' + selectedEntry.name, 'info');
                        // TODO: wire up actual generation
                    }
                });
            })(actionBtns[b]);
        }

        /* View option checkboxes — apply WITHOUT full re-render to preserve Three.js canvas */
        var viewCheckboxes = rootEl.querySelectorAll('[data-viewopt]');
        for (var v = 0; v < viewCheckboxes.length; v++) {
            (function(cb) {
                cb.addEventListener('change', function() {
                    var key = this.getAttribute('data-viewopt');
                    viewOpts[key] = this.checked;
                    applyViewOptions();
                });
            })(viewCheckboxes[v]);
        }
    }

    function findEntryByPath(targetPath) {
        // Walk the tree cache to find the entry
        var parts = targetPath.split('/');
        var dirPath = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
        var entries = treeCache[dirPath];
        if (entries) {
            for (var i = 0; i < entries.length; i++) {
                if (entries[i].path === targetPath) return entries[i];
            }
        }
        // Also check root
        entries = treeCache[''];
        if (entries) {
            for (var j = 0; j < entries.length; j++) {
                if (entries[j].path === targetPath) return entries[j];
            }
        }
        // Build a synthetic entry for directories
        return { name: parts[parts.length - 1] || targetPath, type: 'dir', path: targetPath, ext: null, size: null, mtime: null };
    }

    function approveAllInDir(dirPath) {
        var entries = treeCache[dirPath] || [];
        var models = entries.filter(function(e) { return e.type === 'file' && isModel(e.ext); });
        if (models.length === 0) {
            showToast('No models to approve', 'error');
            return;
        }

        var completed = 0;
        var errors = 0;
        models.forEach(function(model) {
            approveAsset(model.path).then(function(data) {
                completed++;
                if (data && data.error) errors++;
                if (completed === models.length) {
                    showToast('Approved ' + (completed - errors) + '/' + models.length + ' models', errors > 0 ? 'error' : 'success');
                }
            });
        });
    }

    /* ============================================================
       INIT
       ============================================================ */
    function init() {
        rootEl = document.getElementById(ROOT_ID);
        if (!rootEl) return;

        injectStyles();

        // Load root directory, then auto-expand assets/models/hunyuan
        loadDirectory('').then(function() {
            // Auto-expand key directories
            expandedDirs['assets'] = true;
            return loadDirectory('assets');
        }).then(function() {
            expandedDirs['assets/models'] = true;
            return loadDirectory('assets/models');
        }).then(function() {
            expandedDirs['assets/models/hunyuan'] = true;
            return loadDirectory('assets/models/hunyuan');
        }).then(function() {
            render();
        }).catch(function() {
            render();
        });
    }

    return { init: init };
})();
