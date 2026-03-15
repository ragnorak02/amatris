# GLOBAL RULES (LUMINA)

This project inherits the LUMINA studio rules.

Non-negotiable:

- Claude must run the **implementation-verification skill** before declaring completion.
- Claude must provide verification proof output.
- Claude must confirm the working directory before modifying files.
- If a Godot scene changes, Claude must print the node tree.
- Claude may not claim completion without verification output.

If local rules conflict with global rules, **global rules win**.

---

# Mandatory Verification Protocol

Claude must run verification before completing tasks involving:

- code changes
- scene changes
- gameplay systems
- UI systems
- signals or input systems

Verification output must include:

• scene node tree  
• attached scripts  
• signal connections  
• interaction confirmation  

Completion without verification output is **invalid**.

---

# Implementation Protocol

Before implementing any feature Claude must:

1. Explain the architecture change
2. List files that will be modified
3. Implement the change
4. Run verification
5. Print verification output

Claude must **not silently modify systems**.

---

# LUMINA Development Specification

Game Title: {GAME_TITLE}

Genre: {GENRE}

Engine: Godot 4.6  
Platform: PC  
Controller: Xbox required (keyboard fallback allowed)

Executable Path:

Z:/godot/godot.exe

---

# LUMINA Studio Rules

- `project_status.json` is the **single source of truth**
- `CLAUDE.md` defines development checkpoints
- Launcher reads **JSON only**
- Never delete checklist items
- Mark unused items **N/A**

---

# Launcher Contract

Launcher integration must remain valid.

Required files:

game.config.json  
project_status.json  
achievements.json  

Test command must run without manual steps.

Timestamps must use **ISO8601 minute precision**.

---

# Godot Execution Contract

Godot installed at:

Z:/godot

Claude MUST use:

Z:/godot/godot.exe

Rules:

- Never assume PATH
- Never reinstall the engine
- Never use alternate installations

---

## Headless Boot

Z:/godot/godot.exe --path . --headless --quit-after 1

---

## Headless Test Runner

Z:/godot/godot.exe --path . --headless --scene res://tests/test_runner.tscn

---

# Project Overview

{SHORT_GAME_DESCRIPTION}

---

# Core Gameplay Loop

Example format:

Player Start  
→ Core Mechanic  
→ Interaction / Combat  
→ Progression Reward  
→ Repeat

Claude should refine this loop during development.

---

# Core Pillars

Define the **design pillars** for the game.

Examples:

- Fast movement
- Skill-based gameplay
- Replayability
- Simple controls

---

# Architecture Summary

Scene structure should remain modular.

Typical structure:

MainMenu  
GameScene  
UIScene  
PauseMenu  

Autoload systems may include:

GameManager  
SaveManager  
AudioManager  
InputManager  
SceneTransition  

---

# Structured Development Checklist

LUMINA STANDARD DEVELOPMENT ROADMAP

---

# Macro Phase 1 — Project Setup

- [ ] Repo structure validated
- [ ] Templates generated
- [ ] CLAUDE.md present
- [ ] game.config.json created
- [ ] project_status.json created
- [ ] achievements.json created
- [ ] Godot project created
- [ ] Project launches successfully
- [ ] Controller input detected
- [ ] Keyboard fallback working

---

# Macro Phase 2 — Player Controller

- [ ] Player scene created
- [ ] Movement implemented
- [ ] Camera system implemented
- [ ] Input mapping completed
- [ ] Controller responsiveness verified
- [ ] Player animations placeholder
- [ ] Basic collision detection
- [ ] Pause functionality

---

# Macro Phase 3 — Core Gameplay Mechanic

Examples depending on genre:

Combat / Driving / Farming / Flight / Platforming

- [ ] Core mechanic implemented
- [ ] Interaction logic created
- [ ] Basic feedback (visual or audio)
- [ ] Mechanic stability test
- [ ] Core gameplay loop functional

---

# Macro Phase 4 — Enemy or Interaction Systems

- [ ] Enemy or obstacle created
- [ ] Interaction logic working
- [ ] Damage / reward systems
- [ ] Difficulty tuning
- [ ] Multiple entities supported

---

# Macro Phase 5 — Progression Systems

- [ ] Score or currency system
- [ ] Upgrade system
- [ ] Save system
- [ ] Achievement hooks
- [ ] Progress persistence

---

# Macro Phase 6 — UI Systems

- [ ] HUD implemented
- [ ] Pause menu
- [ ] Settings menu
- [ ] Game over / success screen
- [ ] UI responsiveness

---

# Macro Phase 7 — Audio & Visual Feedback

- [ ] AudioManager implemented
- [ ] Music playback
- [ ] SFX triggers
- [ ] Particle effects
- [ ] Screen feedback

---

# Macro Phase 8 — Testing & Automation

- [ ] Test runner implemented
- [ ] Smoke tests created
- [ ] Core mechanic tests
- [ ] Save/load tests
- [ ] Controller tests
- [ ] Performance baseline

---

# Debug Flags

Recommended debug flags:

DEBUG_PLAYER  
DEBUG_AI  
DEBUG_COMBAT  
DEBUG_UI  
DEBUG_PROGRESS  

All debug flags must default to **false**.

---

# Automation Contract

After major updates:

1. Update `project_status.json`
2. Run headless boot
3. Run automated tests
4. Commit changes
5. Push repository

Launcher depends on this.

---

# Current Focus

Current Phase: Phase 1 — Project Setup

Next Goal: Implement Player Controller

---

# Known Gaps

List incomplete systems here.

Example:

- placeholder art still used
- audio assets missing

---

# Long-Term Vision

Describe the eventual expanded version of the game.

Examples:

- additional levels
- boss encounters
- multiplayer
- expanded progression systems

---

END OF FILE