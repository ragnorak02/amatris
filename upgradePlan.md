# Lumina v2 — Phase 0 Design Summary

> **Purpose**: Commit to architecture in writing before any implementation begins.
> **Date**: 2026-03-15
> **Scope**: Transform Lumina from a project dashboard into a multi-mode Studio OS shell.

---

## 1. Executive Summary

### What Lumina Is Today
Lumina is a Node.js-served portfolio dashboard that auto-discovers game folders, parses their `game.config.json` and `project_status.json` files, and renders a 29-column sortable/filterable table in a single-page HTML app. It supports Xbox controller navigation, file preview modals, test execution, and a shared asset pipeline (scaffolded but empty). The UI has 7 navigation tabs declared but only **Library** is implemented — the rest are placeholders.

### What Lumina v2 Will Be
A **Studio OS shell** — a persistent app frame with 4 true application modes:

| Mode | Purpose |
|------|---------|
| **Lumina** | Project dashboard (current table, enhanced) |
| **Claude** | Lumina-scoped ClaudeCount embed (session monitoring) |
| **Hunyuan** | 3D asset browser with Three.js preview |
| **Audio** | Audio asset browser with waveform player |

The transformation replaces the current "one big page with placeholder tabs" model with a **content-swap architecture**: a sticky header shell persists across modes, each mode owns its own scrollable content region, and index files replace repeated live scanning.

---

## 2. Current Architecture Snapshot

### 2.1 File Inventory

| File | Lines | Size | Role |
|------|------:|-----:|------|
| `lumina dashboard.html` | 1,450 | 60 KB | Standalone portfolio dashboard (inline CSS + JS) |
| `server.js` | 1,163 | 45 KB | Node HTTP server, game discovery, all API routes |
| `js/studio.js` | 1,425 | 57 KB | Main dashboard logic (render, sort, filter, expand, detail tabs) |
| `css/studio.css` | 1,438 | 34 KB | Dashboard layout, table, detail panel, modals |
| `css/overlay.css` | 956 | 21 KB | Shift+Tab overlay, perf panel |
| `css/style.css` | 285 | 6 KB | Portal/launcher page styles |
| `index.html` | ~200 | — | Launcher portal (7 tabs, sidebar, game grid, overlay) |
| **Total core** | **~6,917** | **~223 KB** | |

### 2.2 Tab System (Current)

**Main navigation tabs** (declared in `index.html`, lines 48-54):
`store` · `library` · `news` · `mods` · `wip` · `patreon` · `credits`

- Only `library` is implemented. The other 6 are empty placeholders.
- State tracked by `currentNavTab` in `studio.js`.

**Detail tabs** (per-game, in `studio.js`):
`overview` · `status` · `commits` · `tests` · `devnotes` · `changelog` · `files`
— All 7 implemented with keyboard/gamepad cycling.

### 2.3 CSS Architecture

**Custom properties** (16 color variables in `:root`):
```
--bg: #0a0a12    --gold: #d4af37      --green: #22c55e
--row-even       --gold-light          --yellow
--row-odd        --cyan: #00d4ff      --orange
--header-bg      --text / --text-dim   --red
--border         --text-dark           --purple
```

**Z-index layers**: 0 (base) → 10 (header) → 50 (game view) → 100 (modals) → 200 (detail panel) → 1000 (launch overlay)

**3 CSS files** + inline styles in dashboard HTML (~480 lines of embedded CSS).

### 2.4 Server API (17 Endpoints)

| Method | Path | Category |
|--------|------|----------|
| GET | `/api/games` | Game discovery |
| GET | `/api/file?path=` | File reader |
| GET | `/api/running` | Process tracking |
| POST | `/api/tests/run-all` | Test execution |
| POST | `/api/tests/:gameId` | Test execution |
| POST | `/api/claude/:gameId` | Tool launch |
| GET | `/api/assets` | Asset pipeline |
| GET | `/api/assets/packages` | Asset pipeline |
| GET | `/api/assets/sync-status` | Asset pipeline |
| POST | `/api/assets/sync/:gameId` | Asset pipeline |
| POST | `/api/assets/rebuild-catalog` | Asset pipeline |
| POST | `/api/games/:gameId/packages` | Asset pipeline |
| GET | `/launch/:gameId` | Legacy launch |
| GET | `/close-game/:gameId` | Legacy close |
| GET | `/system-stats` | System info |
| GET | `/open-folder/screenshots` | File system |
| GET | `/*` | Static file serving |

**Server type**: Raw `http.createServer()` with manual routing (no Express).

### 2.5 Data Model

**Per-game files** (read by server on `/api/games`):
- `game.config.json` — engine, phase, features, shared asset config
- `project_status.json` — timestamps, completion %, status, goals
- `tests/test_results.json` — test pass/fail/skip counts
- `CLAUDE.md` — detected for compliance scoring

**Game discovery**: `fs.readdirSync()` excluding 11 dirs in `NON_GAME_DIRS`:
`.claude` · `.git` · `css` · `js` · `refImages` · `scripts` · `node_modules` · `screenshots` · `docs` · `shared_assets` · `game assets`

**Current portfolio**: ~33-44 game folders detected (varies by which have config files).

### 2.6 Shared Asset Pipeline

```
shared_assets/
├── 2d/ (characters, props, tiles, ui)
├── 3d/ (buildings, characters, creatures, environment, foliage, npcs, props)
├── audio/ (music, sfx)
├── textures/ (materials)
├── packages.json    ← empty (packages: [])
└── catalog.json     ← empty (assetCount: 0)
```

Infrastructure fully scaffolded. `scripts/asset_sync.js` CLI works. Server endpoints wired. No actual assets populated yet.

### 2.7 Input System

| File | Role |
|------|------|
| `js/input-manager.js` | Semantic action bus + context stack (launcher / detail_panel / overlay) |
| `js/gamepad.js` | Xbox controller polling, button mapping |
| `js/game-view.js` | Game launch (iframe / external window) |
| `js/overlay.js` | Shift+Tab overlay, perf monitoring |
| `js/background.js` | Animated starfield |
| `js/file-preview.js` | Modal file viewer |
| `js/test-runner.js` | Test execution UI |
| `js/main.js` | Entry point |

**10 semantic actions**: NAV_UP/DOWN/LEFT/RIGHT, CONFIRM, BACK, INFO, TAB_PREV/NEXT, MENU

---

## 3. Target Architecture Commitments

### 3.1 App Shell — Persistent Sticky Header

The header becomes the **app frame** and never scrolls off screen.

```
┌──────────────────────────────────────────────────────────────────┐
│ [Crystal Icon]  LUMINA   │ Lumina │ Claude │ Hunyuan │ Audio │  │
│                          │────────┘        │         │       │  │
│              [Pin Tray: 2 pinned games]    [🚀 Claude] [🎲 Hunyuan] │
└──────────────────────────────────────────────────────────────────┘
```

**Commitments:**
- `position: sticky; top: 0; z-index: 1000;`
- Crystal icon larger, positioned left
- Title text: just `LUMINA`
- 4 mode tabs with selected/hover/idle states
- Dynamic pin tray (2 pinned games default, expandable)
- Launcher icons (Claude for Lumina, Claude for Hunyuan)
- Shadow/border separation from scrolling content

### 3.2 Four True Modes

Each mode is a **content container** that shows/hides on tab switch. No full page reload. No overlays.

| Mode | Content | State |
|------|---------|-------|
| **Lumina** | Stats cards + filter bar + project table (existing, enhanced) | Functional |
| **Claude** | ClaudeCount-style session grid + detail panel | Mock/layout |
| **Hunyuan** | 3-pane asset browser (list │ Three.js preview │ detail) | Mock + stub viewer |
| **Audio** | 3-pane audio browser (list │ waveform player │ detail) | Mock + stub player |

**Switching logic**: Toggle `display` or `visibility` on mode containers. Active mode gets `display: flex`, others get `display: none`. Header persists.

### 3.3 Scroll Model

- App shell: **fixed** (never scrolls)
- Each mode's content area: **independently scrollable**
- Scrollbar: thin, styled with Lumina accent colors
- Formula: `max-height: calc(100vh - shellHeight)`

### 3.4 Index-Driven Data

New first-class concept: **indexes** replace repeated live scanning.

```
indexes/
├── project_index.json    ← aggregated game metadata
├── asset_index.json      ← 3D asset catalog for Hunyuan browser
└── audio_index.json      ← audio asset catalog for Audio browser
```

Indexes are:
- Human-readable JSON
- Regenerated by scanners (manual or automated)
- Consumed by dashboard UI for fast hydration
- Designed so Claude Code can read them without scanning the full tree

### 3.5 Scanner Architecture

New concept: **scanners** populate indexes.

```
scanners/
├── (project_scanner.js)   ← scans game folders → project_index.json
├── (asset_scanner.js)     ← scans 3D assets → asset_index.json
└── (audio_scanner.js)     ← scans audio files → audio_index.json
```

Phase 0 defines responsibilities only. Implementation is deferred.

### 3.6 Asset Browser Layout (Hunyuan + Audio)

Both browsers share the same 3-pane pattern:

```
┌─────────────┬──────────────────┬────────────────┐
│  Asset List  │   Preview Area   │  Detail Panel  │
│  (scrollable)│  (Three.js or    │  (metadata,    │
│              │   waveform)      │   usage, tags)  │
│  - thumbnail │                  │                │
│  - name      │                  │                │
│  - type      │                  │                │
│  - status    │                  │                │
└─────────────┴──────────────────┴────────────────┘
```

Left pane ~25%, center ~45%, right ~30%.

---

## 4. Directory Structure Changes

### New Directories

```
Z:\Development\lumina\
├── indexes/                          ← NEW: index files
│   ├── project_index.json            (stub)
│   ├── asset_index.json              (stub)
│   └── audio_index.json              (stub)
├── scanners/                         ← NEW: scanner scripts (stubs)
├── assets/                           ← NEW: studio-level assets
│   ├── models/
│   │   └── hunyuan/                  (3D asset storage direction)
│   └── audio/
│       ├── music/
│       └── sfx/
```

### Existing — No Changes

```
├── shared_assets/                    ← stays as-is, bridges to new structure
├── scripts/                          ← existing CLI tools unchanged
├── css/                              ← modified, not moved
├── js/                               ← modified + new modules, not moved
├── docs/                             ← unchanged
```

### Relationship: `shared_assets/` vs `assets/`

- `shared_assets/` = existing per-game pipeline (package subscriptions, pool sync)
- `assets/` = new studio-level asset storage (Hunyuan outputs, audio library)
- Both coexist. `shared_assets/` is not deprecated. Future bridge possible.

---

## 5. Data Contracts

### 5.1 project_index.json

```json
{
  "version": 1,
  "generatedAt": "2026-03-15T12:00:00Z",
  "gameCount": 33,
  "games": [
    {
      "id": "projectRagnorak",
      "name": "Project Ragnorak",
      "engine": "godot",
      "phase": 5,
      "completion": 42,
      "status": "active",
      "genre": ["RPG", "Action"],
      "lastUpdated": "2026-03-15T10:30:00Z",
      "hasTests": true,
      "testHealth": "pass",
      "complianceScore": 85,
      "path": "Z:\\Development\\lumina\\projectRagnorak"
    }
  ]
}
```

### 5.2 asset_index.json (3D Assets)

```json
{
  "version": 1,
  "generatedAt": "2026-03-15T12:00:00Z",
  "assetCount": 0,
  "assets": [
    {
      "id": "tree_oak_01",
      "displayName": "Oak Tree 01",
      "version": "1.0",
      "category": "foliage",
      "fileType": "glb",
      "sourcePath": "assets/models/hunyuan/tree_oak_01/tree_oak_01.glb",
      "previewPath": "assets/models/hunyuan/tree_oak_01/previews/thumb.png",
      "textured": true,
      "animated": false,
      "polyCount": null,
      "scaleNotes": "1 unit = 1 meter",
      "status": "ready",
      "usedInGames": [],
      "tags": ["tree", "nature", "foliage"],
      "createdAt": "2026-03-15T12:00:00Z",
      "indexedAt": "2026-03-15T12:00:00Z"
    }
  ]
}
```

**16 fields** per 3D asset: id, displayName, version, category, fileType, sourcePath, previewPath, textured, animated, polyCount, scaleNotes, status, usedInGames, tags, createdAt, indexedAt.

### 5.3 audio_index.json

```json
{
  "version": 1,
  "generatedAt": "2026-03-15T12:00:00Z",
  "assetCount": 0,
  "assets": [
    {
      "id": "battle_theme_01",
      "displayName": "Battle Theme 01",
      "category": "music",
      "format": "ogg",
      "duration": 142.5,
      "sourceType": "shared",
      "packageOrigin": null,
      "usedInGames": [],
      "tags": ["battle", "epic", "orchestral"],
      "loopable": true,
      "normalized": true,
      "sourcePath": "assets/audio/music/battle_theme_01.ogg",
      "createdAt": "2026-03-15T12:00:00Z",
      "indexedAt": "2026-03-15T12:00:00Z"
    }
  ]
}
```

**14 fields** per audio asset: id, displayName, category, format, duration, sourceType, packageOrigin, usedInGames, tags, loopable, normalized, sourcePath, createdAt, indexedAt.

### 5.4 Genre Taxonomy

For the filter system, genres are defined as:

```
2D · 3D · RPG · Action · Racing · Adventure · Strategy · Platformer · Roguelite
```

Stored in `game.config.json` per game as `"genre": ["RPG", "Action"]`. Multi-select filtering supported.

### 5.5 Pin Tray Data Shape

```json
{
  "pinnedGames": [
    {
      "gameId": "projectRagnorak",
      "name": "Project Ragnorak",
      "icon": "⚔️",
      "completion": 42,
      "phase": 5,
      "status": "active",
      "lastUpdated": "2026-03-15T10:30:00Z",
      "nextStep": "Phase 6: MP, ATB, Abilities"
    }
  ]
}
```

Stored in `localStorage`. Max 2 displayed by default, expandable later. Each chip shows: icon, name, completion %, phase, last updated, next step.

---

## 6. Critical Files to Modify

### High Impact

| File | Change Scope | What Changes |
|------|-------------|--------------|
| `lumina dashboard.html` | **Major restructure** | Becomes the standalone dashboard; OR gets absorbed into `index.html` mode system |
| `index.html` | **Major restructure** | Replace 7 placeholder tabs with 4 mode tabs, add app shell header, add mode containers |
| `css/studio.css` | **Heavy additions** | Sticky header, mode containers, pin tray, thin scrollbar, 3-pane browser layouts, expanded row actions |
| `js/studio.js` | **Heavy rework** | Mode switching logic, pin tray state, filter rework (remove Unity, add genres), row expansion action buttons |
| `server.js` | **Moderate additions** | New endpoints for indexes, possible scanner triggers, Claude/tool launch routes |

### New Files

| File | Purpose |
|------|---------|
| `js/claude-tab.js` | Claude mode rendering, mock session data |
| `js/hunyuan-tab.js` | Hunyuan mode rendering, asset list, Three.js viewer init |
| `js/audio-tab.js` | Audio mode rendering, audio list, player controls |
| `indexes/project_index.json` | Stub index file |
| `indexes/asset_index.json` | Stub index file |
| `indexes/audio_index.json` | Stub index file |

### Unchanged

| File | Reason |
|------|--------|
| `js/input-manager.js` | Action system works as-is; may add new context names |
| `js/gamepad.js` | Controller polling unchanged |
| `js/overlay.js` | Overlay system independent |
| `shared_assets/*` | Existing pipeline untouched |
| `scripts/asset_sync.js` | CLI tool unchanged |
| `docs/*` | Documentation stays separate |

---

## 7. Phased Execution Order

The master plan's 20 phases distill into **17 implementation steps** grouped by dependency.

### Wave 1 — App Shell Foundation (Steps 1-3)

| Step | Master Phases | Description | Depends On |
|------|--------------|-------------|------------|
| 1 | Phase 1, 3 | Build persistent sticky header with crystal icon, LUMINA title, 4 mode tabs | — |
| 2 | Phase 2 | Add dynamic pin tray to header | Step 1 |
| 3 | Phase 9 | Add global launcher icons (Claude for Lumina, Claude for Hunyuan) | Step 1 |

### Wave 2 — Mode Infrastructure (Steps 4-6)

| Step | Master Phases | Description | Depends On |
|------|--------------|-------------|------------|
| 4 | Phase 4 | Refactor Lumina tab content into its own mode container | Step 1 |
| 5 | Phase 5, 6 | Make project list independently scrollable + thin scrollbar | Step 4 |
| 6 | Phase 7 | Rework filter bar (remove Unity, add genre filters, multi-select) | Step 4 |

### Wave 3 — Dashboard Enhancements (Steps 7-8)

| Step | Master Phases | Description | Depends On |
|------|--------------|-------------|------------|
| 7 | Phase 8 | Add expandable row action section (Run, Claude, Terminal, VS Code, Repo, Tests) | Step 4 |
| 8 | Phase 19 | Wire safe launch actions (path-based commands) | Step 7 |

### Wave 4 — New Mode Scaffolds (Steps 9-12)

| Step | Master Phases | Description | Depends On |
|------|--------------|-------------|------------|
| 9 | Phase 10 | Scaffold Claude tab (session grid + detail panel, mock data) | Step 1 |
| 10 | Phase 11 | Scaffold Hunyuan browser (3-pane layout, asset list, detail panel) | Step 1 |
| 11 | Phase 12 | Add Three.js viewer surface in Hunyuan tab | Step 10 |
| 12 | Phase 13 | Scaffold Audio browser (3-pane layout, waveform player, detail panel) | Step 1 |

### Wave 5 — Data Architecture (Steps 13-15)

| Step | Master Phases | Description | Depends On |
|------|--------------|-------------|------------|
| 13 | Phase 14 | Create `indexes/` folder with stub index files | — |
| 14 | Phase 15 | Create `scanners/` folder, define scanner responsibilities | Step 13 |
| 15 | Phase 16 | Define 3D + audio metadata model stubs | Steps 10, 12 |

### Wave 6 — Polish & States (Steps 16-17)

| Step | Master Phases | Description | Depends On |
|------|--------------|-------------|------------|
| 16 | Phase 17, 18 | Add empty/loading/mock/error states for all modes; visual polish pass | Steps 9-12 |
| 17 | Phase 20 | Verify future-scale design commitments (extensible shell, scanner hooks, index contracts) | All |

### Dependency Graph

```
Step 1 (header) ──┬── Step 2 (pin tray)
                  ├── Step 3 (launchers)
                  ├── Step 4 (Lumina mode) ──┬── Step 5 (scroll)
                  │                          ├── Step 6 (filters)
                  │                          └── Step 7 (row actions) ── Step 8 (wiring)
                  ├── Step 9 (Claude tab)
                  ├── Step 10 (Hunyuan) ── Step 11 (Three.js)
                  └── Step 12 (Audio)

Step 13 (indexes) ── Step 14 (scanners) ── Step 15 (metadata)

Steps 9-12 ── Step 16 (polish) ── Step 17 (verify)
```

---

## 8. What's Mock vs Real

| Feature | Status | Notes |
|---------|--------|-------|
| **Sticky header** | Real | Functional CSS + HTML |
| **Mode tab switching** | Real | JS show/hide on mode containers |
| **Pin tray** | Real (localStorage) | Pin/unpin functional, data from `/api/games` |
| **Lumina project table** | Real | Existing table, enhanced with scroll + filters |
| **Genre filters** | Mock initially | Needs `genre` field added to `game.config.json` per game |
| **Row expansion actions** | Partially real | Run/Claude/Terminal/VS Code wired where paths are simple; Repo/Tests may be stubs |
| **Header launchers** | Real | Shell commands with known paths |
| **Claude tab** | Mock | Layout only, fake session cards, placeholder data |
| **Hunyuan asset list** | Mock | Hardcoded sample entries or reads from empty `asset_index.json` |
| **Three.js viewer** | Stub | Container + loading/empty states; no real model loading initially |
| **Audio browser** | Mock | Hardcoded sample entries or reads from empty `audio_index.json` |
| **Audio player** | Stub | Play/pause UI, waveform placeholder; real playback possible if audio files exist |
| **Index files** | Stub | Valid JSON structure, 0 entries |
| **Scanners** | Architecture only | Folder + responsibility docs, no executable code |

---

## 9. Acceptance Criteria

### App Shell / Header
- [ ] Lumina crystal icon is larger and visually prominent
- [ ] Title reads `LUMINA` (not "LUMINA — Studio Operating System")
- [ ] Top toolbar is sticky (`position: sticky; top: 0`)
- [ ] Tabs exist for Lumina / Claude / Hunyuan / Audio
- [ ] Toolbar persists when switching modes
- [ ] Dynamic pin tray displays up to 2 pinned games
- [ ] Pinned games show: icon, name, completion %, phase, last updated

### Lumina Mode
- [ ] Project table remains fully functional inside Lumina mode container
- [ ] Table scrolls independently (header does not scroll)
- [ ] Thin styled scrollbar visible on scroll containers
- [ ] Unity filter removed from filter bar
- [ ] Genre filter tags added (2D, 3D, RPG, Action, Racing, Adventure, Strategy, Platformer, Roguelite)
- [ ] Filters support multi-select
- [ ] Row expansion reveals action icon buttons (Run, Claude, Terminal, VS Code, Repo, Tests)
- [ ] Expanded area styled as a mini control panel

### Launchers
- [ ] Header has "Launch Claude (Lumina)" button → `claude --dangerously-skip-permissions` in `Z:\Development\lumina`
- [ ] Header has "Launch Claude (Hunyuan)" button → `claude --dangerously-skip-permissions` in `Z:\ComfyUI-Hunyuan`
- [ ] Safe path-based actions wired (open folder, open terminal, open VS Code)

### Claude Mode
- [ ] Claude tab renders as a true mode (not overlay)
- [ ] Visually resembles a ClaudeCount embed
- [ ] Contains: session summary strip, session list/grid, detail panel, mock controls
- [ ] Non-destructive (no real data writes)

### Hunyuan Mode
- [ ] Hunyuan tab renders as a true mode
- [ ] 3-pane layout: asset list | Three.js preview | detail panel
- [ ] Detail panel fields: name, version, textured, animated, used in games, tags, status
- [ ] Three.js viewer container exists with loading/empty/error states
- [ ] Index-driven design (reads from `asset_index.json`)

### Audio Mode
- [ ] Audio tab renders as a true mode
- [ ] 3-pane layout: audio list | player/waveform | detail panel
- [ ] Player area has play/pause, scrub bar, waveform region
- [ ] Detail panel fields: name, format, duration, source type, used in games, tags, loopable
- [ ] Index-driven design (reads from `audio_index.json`)

### Architecture
- [ ] `indexes/` directory exists with 3 stub JSON files
- [ ] `scanners/` directory exists (stubs/docs only)
- [ ] Mode switching works without full page reload
- [ ] Each mode's content scrolls independently
- [ ] No destructive writes to game repo files
- [ ] Existing functionality (game table, controller nav, overlay) not broken

---

## 10. Verification Plan

### Quick Smoke Test
1. `node server.js` — server starts on port 3001 without errors
2. Open `http://localhost:3001` — launcher loads
3. Navigate to dashboard — project table renders with all games
4. **Header**: Crystal icon visible, title reads LUMINA, 4 tabs present, pin tray visible
5. **Tab switching**: Click each tab — content swaps, header persists, no reload
6. **Scroll**: In Lumina mode, scroll the project table — header stays fixed
7. **Pin tray**: Pin a game — chip appears in header; switch tabs — pin persists
8. **Filters**: Search works, genre filters visible, Unity filter absent
9. **Row expand**: Click expand on a game row — action buttons appear
10. **Launchers**: Header launcher icons present with correct tooltips

### Mode-Specific Checks
- **Claude tab**: Session summary strip renders, mock session cards visible, detail panel shows on selection
- **Hunyuan tab**: 3-pane layout renders, empty/loading state shows in viewer, detail panel has all metadata fields
- **Audio tab**: 3-pane layout renders, player area with controls visible, detail panel has all metadata fields

### Regression Checks
- Controller navigation still works (D-pad, A/Y/LB/RB)
- File preview modal still opens (CLAUDE.md, JSON files)
- Test runner still executes
- Overlay (Shift+Tab) still functions
- Dashboard sorting and column toggles still work

### Data Contract Checks
- `indexes/project_index.json` — valid JSON, correct schema
- `indexes/asset_index.json` — valid JSON, correct schema
- `indexes/audio_index.json` — valid JSON, correct schema
- No orphaned references to old tab IDs (store, news, mods, wip, patreon, credits)
