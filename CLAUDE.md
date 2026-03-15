# LUMINA — Studio Operating System

Purpose:
Lumina is the unified launcher and development command center for all studio games.
It aggregates structured JSON data from each game and presents a controller-first dashboard.

It does NOT parse markdown for metrics.
It reads JSON only.

---

## Mandatory Verification

Claude must run the implementation-verification skill before reporting completion of any task involving code changes, scene changes, UI changes, or system modifications.

Verification must include:

• scene node checks  
• script existence  
• signal connections  
• runtime interaction confirmation  

---

# Phase 1 — Core Launcher Foundation

## Project Structure
- [x] Launcher boots without errors
- [x] Root game directory auto-detected
- [x] Game folders auto-scanned
- [x] Non-game folders ignored safely

## JSON Parsing
- [x] game.config.json parsed per game
- [x] project_status.json parsed per game
- [x] tests/test_results.json parsed if exists
- [x] Missing file detection implemented
- [x] Non-compliance warning state implemented

---

# Phase 2 — Dashboard Table System

## Table Layout
- [x] All games displayed in single unified table
- [x] Columns toggleable on/off
- [x] Sorting implemented (Phase, Completion %, Last Update)
- [x] Filtering implemented (Phase, Engine, Health)

## Required Columns
- [x] Game Name
- [x] Engine
- [x] Macro Phase
- [ ] Subphase
- [x] Completion %
- [ ] Current Goal
- [ ] Current Task
- [ ] Work Mode
- [x] Last Code Update (minute precision)
- [ ] Last Gameplay Update
- [ ] Last Art Update
- [x] Last Git Commit
- [x] Last Test Run
- [x] Test Status Indicator

---

# Phase 3 — File Viewer System

## Modal Viewer
- [x] Open CLAUDE.md in preview modal
- [x] Open project_status.json (pretty printed)
- [x] Open game.config.json
- [x] Open test_results.json
- [x] Markdown rendered properly
- [x] JSON formatted and colorized

## Safety
- [x] Files open in read-only mode
- [x] Download button explicit (never auto-download)
- [x] Missing file icon shown with tooltip

---

# Phase 4 — Controller Integration

## Navigation
- [x] Full Xbox controller navigation
- [x] A = Launch Game
- [x] Y = View Info
- [x] LB/RB = Switch Tabs
- [x] D-pad & Stick navigation
- [x] Visible controller hint bar

---

# Phase 5 — Git & Automation Awareness

## Status Indicators
- [x] project_status.json timestamps displayed correctly
- [x] Test health color coded:
    - [x] Green = Pass
    - [x] Orange = Warning
    - [x] Red = Fail
    - [x] Grey = Not Run
- [x] Non-compliant repo flagged visually

## Automation Contract
- [x] Enforce presence of required JSON keys
- [x] Highlight stale repos (no update in X days)
- [x] Highlight failing tests

Lumina MUST NOT:
- Modify CLAUDE.md automatically
- Rewrite game files silently
- Parse markdown for metrics

---

# Phase 6 — UI Identity & Branding

## Branding
- [x] Replace all references with LUMINA branding
- [x] Window title updated
- [x] Splash screen updated
- [x] Overlay header updated

## Visual Style
- [x] Dark tactical theme
- [x] Ember/gold accent
- [x] Clear information density
- [x] Minimal animation
- [x] Clean typography

---

# Phase 7 — Stability & Scalability

- [ ] Handles 1–50 game folders efficiently
- [ ] JSON parsing resilient to missing keys
- [ ] Error states gracefully handled
- [ ] No blocking UI during scans
- [ ] Test large-scale portfolio load

---

# Phase 8 — Shared Asset Pipeline

## Asset Infrastructure
- [x] shared_assets/ directory with 3d/2d/audio/textures folders
- [x] asset.meta.json schema per asset
- [x] catalog.json auto-generation
- [x] asset_sync.js CLI (sync, rebuild, status, init-asset)
- [x] Server API (GET /api/assets, sync-status, sync, rebuild-catalog)
- [x] /import-assets Claude skill
- [x] "Assets" column in dashboard table

## Named Packages
- [x] shared_assets/packages.json definition file
- [x] Package-based sync resolution in asset_sync.js
- [x] GET /api/assets/packages endpoint
- [x] POST /api/games/:gameId/packages endpoint
- [x] sharedAssetPackages field in game API response
- [x] Dashboard expand row "Shared Assets" section (5th column)
- [x] Package management modal (toggle per-game subscriptions)
- [x] Package Matrix toolbar view (games x packages grid)
- [x] Backward compatible with pool-based sync

---

# Phase 9 — Electron Desktop App

## Native Application
- [x] Electron wrapper (electron-main.js)
- [x] Dark title bar matching LUMINA theme
- [x] lumina-crystal.ico as window/taskbar icon
- [x] Auto-hidden menu bar (Alt to show)
- [x] F12 DevTools, Ctrl+R reload, Ctrl+/-/0 zoom
- [x] External links open in default browser
- [x] Server starts inside Electron process
- [x] `npm start` launches native app
- [x] `npm run server` / `npm run dev` for browser-only mode
- [x] launch_dashboard.bat updated to launch Electron

## Packaging
- [ ] electron-builder config for .exe installer
- [ ] Auto-update support
- [ ] System tray integration

---

# Phase 10 — Hunyuan 3D Asset Browser

## Folder Tree Browser
- [x] GET /api/browse endpoint (lazy directory listing)
- [x] Collapsible folder tree in left pane
- [x] Auto-expands assets/models/hunyuan on init
- [x] File type icons (models=cyan, images=purple)
- [x] Model count badges per folder
- [x] Search/filter tree
- [x] Path traversal security (restricted to project root)

## 3D Model Viewer
- [x] Three.js GLTFLoader (r137 CDN)
- [x] OrbitControls (drag rotate, scroll zoom, shift+drag pan)
- [x] Auto-fit camera to model bounding box
- [x] Ambient + 2x directional lighting
- [x] Grid helper (toggleable)
- [x] Image preview for .png/.jpg files

## View Options
- [x] Show Textures toggle (strips/restores texture maps)
- [x] Wireframe overlay toggle
- [x] Show Grid toggle
- [x] Auto-Rotate toggle (turntable)
- [x] Clay / Matcap toggle (neutral material for form evaluation)
- [x] Options apply in-place without reloading model

## Asset Approval Workflow
- [x] POST /api/assets/approve endpoint
- [x] Approve single model → copies to shared_assets/3d/
- [x] Approve all models in directory (batch)
- [x] Preview image (.glb.png) copied alongside model
- [x] Toast notifications for approval feedback
- [x] POST /api/open-path endpoint (reveal in Explorer)

## Generation Controls (Stubs)
- [x] Generate Model button (single file)
- [x] Generate Models button (folder)
- [ ] Wire up to Hunyuan API
- [ ] Batch generation queue
- [ ] Generation progress tracking

---

# Phase 11 — Audio Asset Browser

## Audio Tab
- [x] 3-pane layout (list, player, detail)
- [x] Audio file listing with search and filters
- [x] Category filtering (Music/SFX/Ambient/UI)
- [x] Format filtering
- [x] Waveform visualization
- [x] Transport controls (play/pause/stop)
- [x] Volume and loop controls

---

# Phase 12 — Claude Sessions Monitor

## Claude Tab
- [x] Session list with status badges
- [x] Token usage display
- [x] Context bar visualization
- [x] Session detail panel
- [x] Summary strip (Active Sessions, Total Tokens, Pending Input, Completed Today)

---

# Non-Negotiable Rules

- Dashboard reads JSON only.
- project_status.json is single source of truth.
- CLAUDE.md is human/AI guidance only.
- Timestamps are minute precision ISO8601.
- Git hooks handle timestamp automation.
- The dashboard HTML file is `lumina dashboard.html` — there is no other dashboard HTML file.
- Package definitions live in `shared_assets/packages.json`.
- The Electron entry point is `electron-main.js`.
- `npm start` launches the Electron app; `npm run server` for browser-only.

---

# Current Focus

Current Goal: Phase 7 — Stability & Scalability
Current Task: Ensure scalability and resilience
Next Milestone: Phase 7 complete, then wire up Hunyuan generation