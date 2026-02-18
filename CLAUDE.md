# Amatris — Studio OS

## Project Overview
This is a game development portfolio containing a **web-based Studio OS launcher** and **11+ game projects** across multiple engines. The launcher serves as a data-dense development dashboard for browsing, launching, testing, and managing all games.

## Launcher (`Z:/Development/amatris/`)

### Running
```
cd Z:/Development/amatris
node server.js          → http://localhost:3000  (launcher + all games)
```

Game projects live as subdirectories alongside the launcher files. The server auto-discovers game folders containing `game.config.json`, `claude.md`, or `project.godot`.

### Key Files
| File | Purpose |
|------|---------|
| `index.html` | Main HTML — header, nav tabs, sidebar + grid studio layout, game-view, overlay, fire-wolf SVG logo |
| `server.js` | Node HTTP server — static files + REST API (games, launch, tests, files) |
| `js/input-manager.js` | **Input abstraction layer** — semantic action pub/sub bus + context stack |
| `js/studio.js` | Studio dashboard — sidebar filters, dense portrait card grid, InputManager wiring, tab memory |
| `js/game-view.js` | Game launch/close — iframe embed (HTML) or external window (Godot), pushes/pops InputManager context |
| `js/overlay.js` | Shift+Tab overlay during gameplay (menu, performance, shortcuts), pushes/pops overlay context |
| `js/file-preview.js` | Side-panel file preview with markdown rendering |
| `js/test-runner.js` | Test execution module — per-game and run-all tests via server API |
| `js/background.js` | Starry night background — stars, clouds |
| `js/gamepad.js` | Xbox controller support — emits semantic actions via InputManager, context-aware routing |
| `js/main.js` | Entry point — initializes all modules on DOMContentLoaded |
| `css/style.css` | Core launcher styles (header, nav, background, fire-wolf logo, flame animation) |
| `css/studio.css` | Studio dashboard — sidebar, portrait card grid, detail panel, file preview panel |
| `css/overlay.css` | Overlay + test result styles |

### Architecture
- **IIFE module pattern** — `InputManager`, `Studio`, `GameView`, `Overlay`, `FilePreview`, `TestRunner`, `Background`, `GamepadInput` are all `var X = (function() { ... })()`
- **InputManager** (central input bus):
  - Semantic actions: `NAV_UP`, `NAV_DOWN`, `NAV_LEFT`, `NAV_RIGHT`, `CONFIRM`, `BACK`, `INFO`, `TAB_PREV`, `TAB_NEXT`, `MENU`
  - Pub/sub: `on(action, cb)`, `off(action, cb)`, `emit(action, data)`
  - Context stack: `pushContext(ctx)`, `popContext()`, `getContext()` — contexts: `launcher`, `detail_panel`, `gameplay`, `overlay`
  - Both keyboard (studio.js) and gamepad (gamepad.js) emit to the same bus
- **Server API endpoints:**
  - `GET /api/games` — all game metadata + live completion % from claude.md
  - `GET /api/file?path=...` — safe file content for preview (path-traversal protected)
  - `POST /api/tests/:gameId` — run tests for one game
  - `POST /api/tests/run-all` — sequential test execution for all games
  - `GET /api/running` — which games are currently running (PID-based)
  - `GET /launch/:id` — start game (Godot/HTML5/Unity)
  - `GET /close-game/:id` — kill running game process
  - `GET /system-stats` — CPU/RAM/disk usage
- **Per-game config** via `game.config.json` in each game folder (varying schemas, normalized server-side)
- **Godot path** in server.js: `C:\Users\nick\Downloads\Godot_v4.6-stable_win64.exe\Godot_v4.6-stable_win64.exe`

### Studio Dashboard Layout
- **Sidebar** (`#studio-sidebar`, 220px): collapsible filter sections for Platforms (Godot/Unity/HTML5) and Genres (RPG/Action/Adventure/Strategy) with item counts
- **Game Grid** (`#studio-game-list`): `repeat(auto-fill, minmax(180px, 1fr))` responsive portrait cards (~4-5/row at 1920px)
- **Portrait Cards**: `aspect-ratio: 3/4`, gradient art + emoji icon, engine badge top-left, action buttons top-right (visible on hover/focus), bottom info strip (title, genre, 2px completion bar)
- **Selection**: gold border + scale(1.05) + glow, unselected cards dim to 0.8 opacity
- **Toolbar**: search (debounced 250ms), sort dropdown, game count, Run All Tests, Refresh
- **Detail panel**: slides in from right (420px), header banner + completion bar + tabs (Overview/Commits/Tests/Dev Notes/Changelog/Files)
- Running games show green border + pulsing "RUNNING" badge (polled every 3s)
- SessionStorage cache for `/api/games` (30s TTL)

### Fire-Wolf Logo
- Inline SVG (`#logo-icon`) in top-right, 80x80px, gold silhouette (`#d4af37`, `#f0c850`)
- Flame mane paths with `.flame-path` CSS animation (staggered `flameFlicker` keyframes)
- Glowing eye accent (`#ff6030`), hover scale(1.1) with gold drop-shadow

### Input System
- **Keyboard** (handled in studio.js):
  - Arrow keys / hjkl = grid navigation (emits NAV_*)
  - Enter = CONFIRM (launch), Escape = BACK (close detail), I = INFO (open detail)
  - Shift+ArrowLeft/Right = TAB_PREV/TAB_NEXT (cycle nav tabs)
  - `/` = focus search bar
- **Xbox Controller** (handled in gamepad.js):
  - D-pad/left stick = NAV_*, A = CONFIRM, B = BACK, Y = INFO
  - LB = TAB_PREV, RB = TAB_NEXT, Start = MENU
  - Gameplay: Start = toggle overlay, hold Y (1s) = exit game
  - Overlay: B/Start = close, D-pad = tile nav, A = activate
- **Grid Navigation**: 2D wrap-around on all edges (right→first, left→last, down→top of column, up→bottom of column)
- **Tab Memory**: `lastSelectedPerTab` saves/restores game selection per nav tab when switching with LB/RB

### Nav Tabs
Store, Library, News, Mods, WIP, Patreon, Credits — "Library" activates the Studio dashboard (default). LB/RB gamepad cycling wraps around. Other tabs remain placeholder.

## Portfolio Dashboard (served via same server)
| Page | URL |
|------|-----|
| Portal hub | `/hybrid_knights_portal.html` |
| Game cards + search/filter | `/games_overview.html` |
| Completion heatmap | `/games_heatmap.html` |
| Markdown index | `/games_index.md` |

Dashboard reads `claude.md` checkboxes from each game folder to calculate completion %.

## Game Projects (11 total)

| # | Folder | Title | Engine | Genre |
|---|--------|-------|--------|-------|
| 1 | `Akma` | Akma | Godot 4.6 | Roguelite RPG |
| 2 | `crystal3d` | Hybrid Nights | Godot 4.6 | 3D Action RPG |
| 3 | `finalfantasy3d` | Korean Fantasy RPG | Godot 4.4 | Action RPG |
| 4 | `fishing` | Isles of the Blue Current | Godot 4.6 | Fishing Adventure |
| 5 | `Hwarang's Path` | Hwarang's Path | Unity 6 | Turn-based RPG |
| 6 | `kingdomDefense` | Korean Fantasy TD | Godot 4.6 | Tower Defense |
| 7 | `mechWar` | MechWar | Godot 4.6 | Isometric Mech Tactics |
| 8 | `monsterBattle` | Monster Catcher | Godot 4.6 | Monster RPG |
| 9 | `pocketDragon` | Dragon League | Godot 4.4 | Dragon-battling RPG |
| 10 | `smashLand` | SmashLand | Godot 4.6 | Platform Fighter |
| 11 | `zelda` | Zelda | HTML5/JS | Action Adventure |

Each game has its own `claude.md`/`CLAUDE.md` with detailed architecture docs and a `game.config.json` for launcher metadata. **Always read the game's CLAUDE.md before making changes to that game.**

## Test Contract
- **Standard location:** `{game}/tests/run-tests.(gd|mjs|bat|sh)`
- **Execution:** Server discovers test runner automatically per game
- **Output:** Structured JSON to stdout with `gameId`, `status`, `testsTotal`, `testsPassed`, `details[]`
- **Trigger:** Studio dashboard card buttons, toolbar "Run All Tests", or overlay "Run Tests" during gameplay

## Conventions

### Code Style
- Launcher JS: vanilla ES5-compatible, IIFE modules, no build step, no npm dependencies
- Godot games: GDScript, programmatic UI construction (no .tscn UI layouts)
- All UI across games built programmatically in code, not in visual editors

### When Editing Games
- Read the game's own `claude.md` first — it has architecture, patterns, and gotchas
- Read the game's `game_direction.md` for design intent and phase planning
- Run game-specific tests after changes (most games have test runners)
- Godot games: if adding `class_name` scripts, run `--headless --import` first

### When Editing the Launcher
- Game metadata comes from `game.config.json` per game folder — normalized by server.js `/api/games`
- Studio.js fetches from `/api/games` — no hardcoded game data in client JS
- File preview validates paths server-side — never serves files outside GAMES_DIR
- **InputManager** must load before all other scripts (first `<script>` tag after stylesheets)
- All input actions flow through InputManager — keyboard emits in studio.js, gamepad emits in gamepad.js
- Components subscribe to semantic actions, never read raw input directly
- Context stack determines which handlers are active (`launcher` → `gameplay` → `overlay`)
- Test launcher changes by running `node server.js` and checking `http://localhost:3000`

### General
- Dark fantasy theme throughout — night colors, gold accents (#f0c850, #d4af37)
- No npm/node_modules — server.js uses only Node built-ins (http, fs, path, os, child_process)
- Desktop shortcut: `Amatris Dashboard.bat` on Desktop opens the portfolio portal
- Fire-wolf SVG logo replaces the old moon element (pure inline SVG + CSS animation)

## Known Issues
- Menu tabs (Store, News, Mods, etc.) are placeholder — only Library works
- Dashboard completion % depends on checkbox format in game claude.md files
- Hwarang's Path (Unity) is set as placeholder — no auto-launch
- Sidebar hides at <900px viewport width (responsive breakpoint)
