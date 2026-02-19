# Portfolio Schema: project_status.json (v1)

Canonical, machine-readable metadata for each game in the Amatris portfolio.
Supplements `game.config.json` (which handles launcher-specific config like engine, launch type, etc.).

## Location

Each game folder contains an optional `project_status.json` at its root:

```
Akma/project_status.json
crystal3d/project_status.json
zelda/project_status.json
...
```

## Full Schema

```jsonc
{
  // --- Identity ---
  "schemaVersion": 1,              // Integer. Always 1 for this version.
  "gameId":        "akma",          // Lowercase slug matching server-generated ID.
  "title":         "Akma",          // Human-readable display name.
  "lastUpdated":   "2026-02-18T00:00:00Z", // ISO 8601 date of last manual edit.

  // --- Health ---
  "health": {
    "progressPercent": 30,          // 0-100. Overall project completion estimate.
    "buildVersion":    "0.2.0",     // Semver string or null.
    "assetStage":      null         // null | "placeholder_v1" | "wip" | "final"
  },

  // --- Tech Stack ---
  "tech": {
    "engine":        "Godot",       // "Godot" | "Unity" | "HTML5"
    "engineVersion": "4.6",         // Version string.
    "languages":     ["GDScript"],  // Array of language names.
    "graphicsType":  "2D"           // Free-form: "2D", "3D", "2D Isometric", "2D Canvas", etc.
  },

  // --- Features (4-level enum) ---
  "features": {
    "controllerSupport":  "partial",   // "unknown" | "missing" | "partial" | "complete"
    "achievementsSystem": "partial",
    "testScripts":        "complete",
    "saveSystem":         "missing",
    "settingsMenu":       "missing",
    "audio":              "missing",
    "vfx":                "missing"
  },

  // --- Milestones (boolean flags) ---
  "milestones": {
    "firstGraphicsPass":     false,  // Basic art/sprites beyond placeholder.
    "controllerIntegration": false,  // Gamepad input works end-to-end.
    "coreGameplayLoop":      true,   // Primary gameplay mechanic is playable.
    "verticalSlice":         false,  // One complete level/scenario polished.
    "contentComplete":       false,  // All planned content implemented.
    "productionReady":       false   // Ready for public release.
  },

  // --- Testing ---
  "testing": {
    "testCommand": "tests/run-tests.bat", // Relative path to test runner, or null.
    "lastRunAt":   null,                  // ISO 8601 timestamp, or null.
    "status":      "unknown",             // "unknown" | "pass" | "fail" | "error"
    "notes":       ""                     // Free-form notes about test coverage.
  },

  // --- Links ---
  "links": {
    "repo":       null,    // Git remote URL, or null for local-only.
    "launcherId": "akma"   // ID used by the launcher server to identify this game.
  }
}
```

## Field Reference

### Features Taxonomy

7 keys, each with a 4-level enum value:

| Value | Meaning |
|-------|---------|
| `unknown` | Not yet evaluated. |
| `missing` | Evaluated and not present. |
| `partial` | Started but incomplete. |
| `complete` | Fully implemented and functional. |

**Feature keys:**

| Key | Description |
|-----|-------------|
| `controllerSupport` | Xbox/gamepad input works in-game. |
| `achievementsSystem` | In-game achievements tracking. |
| `testScripts` | Automated test suite exists and runs. |
| `saveSystem` | Game state persistence (save/load). |
| `settingsMenu` | In-game settings UI (audio, controls, etc.). |
| `audio` | Sound effects and/or music implemented. |
| `vfx` | Visual effects (particles, shaders, screen effects). |

### Milestones Taxonomy

6 boolean flags ordered by typical development progression:

| Milestone | Description |
|-----------|-------------|
| `firstGraphicsPass` | Basic art/sprites applied beyond grey-box. |
| `controllerIntegration` | Gamepad input works end-to-end. |
| `coreGameplayLoop` | Primary mechanic is playable. |
| `verticalSlice` | One complete, polished scenario. |
| `contentComplete` | All planned content implemented. |
| `productionReady` | Release-quality polish and stability. |

### Asset Stage

| Value | Meaning |
|-------|---------|
| `null` | No specific asset stage tracked. |
| `"placeholder_v1"` | Using placeholder/programmer art. |
| `"wip"` | Work-in-progress custom art. |
| `"final"` | Production-quality assets. |

## Extension Rules

- **Only ADD fields** in future schema versions; never rename or remove existing fields.
- Bump `schemaVersion` when adding new required fields.
- New optional fields can be added without a version bump.
- Consumers must tolerate unknown keys gracefully.

## Relationship to game.config.json

`project_status.json` is an **additive supplement**, not a replacement:

- `game.config.json` = launcher config (engine, launch type, title, genre, features list)
- `project_status.json` = structured development status (feature completeness, milestones, health)

The server merges both when serving `/api/games`.

## Validation

Run the validator to check all project_status.json files:

```
node scripts/validate_portfolio_status.js
```

Checks: file exists, JSON parses, required keys present, enum values valid, booleans correct, ISO date format.
