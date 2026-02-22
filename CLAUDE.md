# AMATRIS — Studio Operating System

Purpose:
Amatris is the unified launcher and development command center for all studio games.
It aggregates structured JSON data from each game and presents a controller-first dashboard.

It does NOT parse markdown for metrics.
It reads JSON only.

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

Amatris MUST NOT:
- Modify CLAUDE.md automatically
- Rewrite game files silently
- Parse markdown for metrics

---

# Phase 6 — UI Identity & Branding

## Branding
- [ ] Replace all Amatris references with AMATRIS
- [ ] Window title updated
- [ ] Splash screen updated
- [ ] Overlay header updated

## Visual Style
- [ ] Dark tactical theme
- [ ] Ember/gold accent
- [ ] Clear information density
- [ ] Minimal animation
- [ ] Clean typography

---

# Phase 7 — Stability & Scalability

- [ ] Handles 1–50 game folders efficiently
- [ ] JSON parsing resilient to missing keys
- [ ] Error states gracefully handled
- [ ] No blocking UI during scans
- [ ] Test large-scale portfolio load

---

# Non-Negotiable Rules

- Dashboard reads JSON only.
- project_status.json is single source of truth.
- CLAUDE.md is human/AI guidance only.
- Timestamps are minute precision ISO8601.
- Git hooks handle timestamp automation.

---

# Current Focus

Current Goal: Phase 5 — Git & Automation Awareness
Current Task: Implement status indicators and automation contract
Next Milestone: Phase 5 complete