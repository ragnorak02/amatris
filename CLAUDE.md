# Amatris — Studio OS

## Project Overview
This is a game development portfolio containing a **web-based Studio OS launcher** and **11 game projects** across multiple engines. The launcher serves as a data-dense development dashboard for browsing, launching, testing, and managing all games.

## Launcher (`Z:/Development/launcher/`)

### Running
```
cd Z:/Development/launcher
node server.js          → http://localhost:3000  (launcher + all games)
```

Game projects live at `Z:/Development/Games/` (sibling directory). The server serves launcher UI from its own directory and game assets from `../Games/`.

### Key Files
| File | Purpose |
|------|---------|
| `index.html` | Main HTML (header, nav, studio dashboard, game-view, overlay) |
| `server.js` | Node HTTP server — static files + REST API (games, launch, tests, files) |
| `js/studio.js` | Studio dashboard — vertical game list, filtering, sorting, expandable rows |
| `js/game-view.js` | Game launch/close — iframe embed (HTML games) or external window (Godot) |
| `js/overlay.js` | Shift+Tab overlay during gameplay (menu, performance, shortcuts, test runner) |
| `js/file-preview.js` | Side-panel file preview with markdown rendering |
| `js/test-runner.js` | Test execution module — per-game and run-all tests via server API |
| `js/background.js` | Starry night background — stars, clouds, moon |
| `js/gamepad.js` | Xbox controller support (D-pad row navigation, A=launch, X=test) |
| `js/main.js` | Entry point — initializes all modules |
| `css/style.css` | Core launcher styles (header, nav, background, game-view) |
| `css/studio.css` | Studio dashboard + file preview panel styles |
| `css/overlay.css` | Overlay + test result styles |

### Architecture
- **IIFE module pattern** — `Studio`, `GameView`, `Overlay`, `FilePreview`, `TestRunner`, `Background` are all `var X = (function() { ... })()`
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

### Studio Dashboard
- Vertical game list with CSS Grid rows: `[Box Art 64px] [Game Info 1fr] [Dev Metrics 300px] [Health 80px] [Actions 120px]`
- Top toolbar: search (debounced 250ms), engine filter dropdown, sort dropdown, Run All Tests, Refresh
- Expandable row details with tabs: Overview, Commits, Tests, Dev Notes, Changelog, Files
- File links open side-panel preview (markdown, JSON, code rendering)
- Running games show green border glow + pulsing indicator (polled every 3s)
- Keyboard navigation: ArrowUp/Down, j/k, Enter to expand/launch, Escape to close
- SessionStorage cache for `/api/games` (30s TTL)

### Nav Tabs
Store, Library, News, Mods, WIP, Patreon, Credits — "Library" activates the Studio dashboard (default). Other tabs remain placeholder.

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
- **Trigger:** Studio dashboard row buttons, toolbar "Run All Tests", or overlay "Run Tests" during gameplay

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
- Test launcher changes by running `node server.js` and checking `http://localhost:3000`

### General
- Dark fantasy theme throughout — night colors, gold accents (#f0c850, #d4af37)
- No npm/node_modules — server.js uses only Node built-ins (http, fs, path, os, child_process)
- Desktop shortcut: `Amatris Dashboard.bat` on Desktop opens the portfolio portal

## Known Issues
- Menu tabs (Store, News, Mods, etc.) are placeholder — only Library works
- Dashboard completion % depends on checkbox format in game claude.md files
- Hwarang's Path (Unity) is set as placeholder — no auto-launch
