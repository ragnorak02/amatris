# Batch Operations Guide

> Safe batch refactoring workflow for the Amatris game portfolio.
> All operations follow a PLAN → APPROVE → APPLY model.

---

## Principles

1. **Never touch binaries** — skip `.exe`, `.dll`, `.so`, `.png`, `.wav`, `.ogg`, `.tres`, `.tscn` (Godot resources), `.prefab`, `.asset` (Unity)
2. **Never touch generated folders** — skip `node_modules/`, `.godot/`, `Library/` (Unity), `build/`, `dist/`, `.import/`
3. **Minimal diffs** — change only what's necessary; preserve formatting, comments, and user edits
4. **Per-repo change summary** — every batch op produces a summary per project before applying
5. **If unsure → write TODO** — leave a `# TODO:` comment rather than guessing

---

## Workflow

### Phase 1: PLAN

```
1. Scan all game project folders
2. For each project:
   a. Identify files that match the operation criteria
   b. List exact files that would change
   c. Preview the diff (before/after)
   d. Flag any ambiguous cases
3. Present summary table:
   | Project | Files Changed | Summary | Risk |
```

**Do NOT modify any files during PLAN phase.**

### Phase 2: APPROVE

```
1. User reviews the plan
2. User approves, modifies, or rejects
3. If rejected → refine plan and re-present
4. If approved → proceed to APPLY
```

### Phase 3: APPLY

```
1. Execute approved changes per project
2. Update cross-references if needed
3. Log changes per project:
   | Project | File | Change | Status |
4. Update games_index.md if compliance status changed
5. Report final summary
```

---

## Common Batch Operations

### Add missing `claude.md` to all projects
```
PLAN: Scan for projects missing claude.md
      Generate template per project (engine-aware)
APPLY: Write claude.md to each project folder
```

### Add missing `game_direction.md` to all projects
```
PLAN: Scan for projects missing game_direction.md
      Generate template per project
APPLY: Write game_direction.md to each project folder
```

### Standardize `.gitignore` across all projects
```
PLAN: Scan each project's .gitignore
      Compare against engine-specific template
      List additions/changes needed
APPLY: Update each .gitignore with missing entries
```

### Bulk status report
```
PLAN: Read all claude.md files
      Extract checkbox completion %
      Detect current phase
APPLY: Update games_index.md with fresh data
       Regenerate games_overview.html + games_heatmap.html
```

---

## Safety Checklist

Before any batch APPLY:

- [ ] Plan was reviewed and approved by user
- [ ] No binary files in change set
- [ ] No generated/cache folders in change set
- [ ] Diffs are minimal and correct
- [ ] Ambiguous cases marked as TODO
- [ ] Backup recommendation given for destructive operations

---

## Requesting a Batch Operation

Tell Claude:

```
"Run batch op: [operation name]"
```

Claude will execute the PLAN phase and present results for your approval before any files are modified.
