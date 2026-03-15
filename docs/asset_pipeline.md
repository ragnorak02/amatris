# Shared Asset Pipeline

The shared asset pipeline lets you generate assets once and distribute them across all eligible game repos.

## Quick Start

```bash
# Import a new asset (via Claude skill)
/import-assets C:\path\to\my\new\model

# Or manually: place files in shared_assets/3d/props/my_asset/ and create asset.meta.json

# Rebuild the catalog
node scripts/asset_sync.js --rebuild-catalog

# See what would sync (dry run)
node scripts/asset_sync.js

# Actually sync to all opted-in games
node scripts/asset_sync.js --execute

# Check status
node scripts/asset_sync.js --status
```

## Directory Structure

```
shared_assets/
  catalog.json                    ← auto-generated master index
  3d/
    characters/   props/   environment/   buildings/
    foliage/   creatures/   npcs/
  2d/
    characters/   props/   tiles/   ui/
  audio/
    sfx/   music/
  textures/
    materials/
```

Each asset lives in its own folder: `shared_assets/<dimension>/<category>/<asset_name>/`

## Asset Metadata (`asset.meta.json`)

Every asset folder requires an `asset.meta.json`:

```json
{
  "schemaVersion": 1,
  "id": "my_sword",
  "name": "My Sword",
  "type": "model",
  "dimension": "3d",
  "theme": "fantasy",
  "category": "props",
  "tags": ["sword", "weapon"],
  "files": [
    { "name": "sword.fbx", "format": "fbx", "sizeBytes": 52428 }
  ],
  "source": {
    "tool": "ComfyUI + Hunyuan3D-2",
    "origin": "ai-generated",
    "license": "internal"
  },
  "status": "raw",
  "version": 1,
  "contentHash": "sha256:abc123...",
  "created": "2026-03-14T10:00:00Z",
  "updated": "2026-03-14T10:00:00Z"
}
```

### Status Lifecycle

`raw` → `reviewed` → `approved` → `deprecated`

Only **approved** assets are synced to game repos.

### Fields

| Field | Values |
|-------|--------|
| `type` | `model`, `sprite`, `texture`, `tileset`, `audio`, `ui` |
| `dimension` | `2d`, `3d` |
| `theme` | `fantasy`, `sci-fi`, `modern`, `cartoon`, `generic` |
| `category` | Matches parent folder name |
| `source.origin` | `ai-generated`, `hand-made`, `third-party` |

## Game Opt-In

Games opt into the pipeline by adding `sharedAssets` to their `game.config.json`.

### Package-Based (Preferred)

Subscribe to named asset packages:

```json
{
  "sharedAssets": {
    "enabled": true,
    "packages": ["fantasy-weapons", "fantasy-characters"],
    "formats": ["fbx", "glb", "gltf"],
    "targetDir": "assets/models/shared",
    "exclude": []
  }
}
```

Packages are defined in `shared_assets/packages.json`:

```json
{
  "schemaVersion": 1,
  "packages": [
    {
      "id": "fantasy-weapons",
      "name": "Fantasy Weapons Pack",
      "description": "Medieval fantasy melee weapons",
      "dimension": "3d",
      "category": "props",
      "theme": "fantasy",
      "assets": ["sword", "katana", "club"],
      "created": "2026-03-14T22:00:00Z",
      "updated": "2026-03-14T22:00:00Z"
    }
  ]
}
```

### Pool-Based (Legacy)

Match assets by dimension/category/theme criteria:

```json
{
  "sharedAssets": {
    "enabled": true,
    "pools": [
      {
        "dimension": "3d",
        "categories": ["characters", "props", "environment"],
        "themes": ["fantasy"],
        "formats": ["fbx", "glb"],
        "targetDir": "assets/models/shared"
      }
    ],
    "exclude": ["some_asset_id"]
  }
}
```

The sync engine checks `packages` first; if present, uses package-based resolution. Otherwise falls back to pool-based matching.

### Pool Matching Rules

An asset is eligible for a game pool when ALL of these match:
1. `asset.dimension` == pool `dimension`
2. `asset.category` in pool `categories`
3. `asset.theme` in pool `themes`
4. At least one `asset.files[].format` in pool `formats`
5. `asset.id` not in game `exclude` list
6. `asset.status === "approved"`

## Sync Engine CLI

```
node scripts/asset_sync.js                           # Dry-run all games
node scripts/asset_sync.js --execute                  # Sync all games
node scripts/asset_sync.js --game projectRagnorak     # Single game (dry-run)
node scripts/asset_sync.js --asset knight --execute   # Single asset to all games
node scripts/asset_sync.js --rebuild-catalog          # Rebuild catalog.json
node scripts/asset_sync.js --status                   # Show sync overview
node scripts/asset_sync.js --init-asset <path>        # Scaffold asset.meta.json
node scripts/asset_sync.js --force                    # Override local modifications
```

### Conflict Resolution

| Scenario | Behavior |
|----------|----------|
| **NEW_ASSET** — target doesn't exist | Copy |
| **UP_TO_DATE** — hash matches | Skip |
| **UPDATE_AVAILABLE** — source newer, target unmodified | Overwrite |
| **LOCAL_MODIFIED** — target was edited after sync | Skip + warn |
| **LOCAL_ONLY** — target exists but never synced | Skip + warn |
| `--force` | Override LOCAL_MODIFIED (creates `.backup` first) |

## Server API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/assets` | GET | Return catalog contents |
| `/api/assets/packages` | GET | Return all packages with asset counts and missing asset warnings |
| `/api/assets/sync-status` | GET | Per-game sync status |
| `/api/assets/sync/:gameId` | POST | Trigger sync (`?execute=true`) |
| `/api/assets/rebuild-catalog` | POST | Rebuild catalog.json |
| `/api/games/:gameId/packages` | POST | Update a game's subscribed packages |

## Dashboard

The "Assets" column in the Features group shows the sync ratio (e.g., "3/9") for games that have opted in. Games without `sharedAssets` config show "—".

### Package Management UI

- **Expand row**: 5th column "Shared Assets" shows subscribed package badges
- **Manage Packages button**: Opens modal to toggle package subscriptions per game
- **Package Matrix button**: Toolbar toggle shows a cross-game matrix (games x packages) with subscription dots
- Saving from the modal writes to `game.config.json` via `POST /api/games/:gameId/packages`
