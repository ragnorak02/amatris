# Git & GitHub Operations Guide

> Standardized Git/GitHub workflow for the Amatris game portfolio.
> Covers repo expectations, commit standards, and **critical secret safety**.

---

## 1. Repository Expectations

Each game project should have:

- `.git/` initialized (all 11 currently do)
- `.gitignore` appropriate for the engine (Godot, Unity, or Web)
- A remote `origin` configured (when ready for GitHub)
- A `main` branch as the default
- Meaningful commit history with the standard message format

---

## 2. `.gitignore` Guidance

### Godot Projects
```gitignore
# Godot
.godot/
*.import
export_presets.cfg
*.tmp
*.log

# OS
.DS_Store
Thumbs.db
desktop.ini

# IDE
.vscode/
*.swp
*.swo

# Secrets
.env
*.key
*.pem
```

### Unity Projects
```gitignore
# Unity
Library/
Temp/
Obj/
Build/
Builds/
Logs/
UserSettings/
MemoryCaptures/
*.csproj
*.sln
*.suo
*.user
*.pidb
*.booproj

# OS
.DS_Store
Thumbs.db

# Secrets
.env
*.key
*.pem
```

### Web/JS Projects
```gitignore
node_modules/
dist/
build/
.cache/
*.log

# OS
.DS_Store
Thumbs.db

# Secrets
.env
.env.*
*.key
*.pem
```

---

## 3. End-of-Session Checkpoint Workflow

At the end of each work session:

```bash
# 1. Check status
git status

# 2. Review changes
git diff

# 3. Stage specific files (never use git add -A blindly)
git add <specific-files>

# 4. Run secret scan (see Section 5)

# 5. Commit with standard message
git commit -m "chore(checkpoint): update progress + dashboards"

# 6. Push if remote is configured
git push origin main
```

---

## 4. Remote / Push Behavior

### Before pushing:
```bash
# Check if remote exists
git remote -v
```

### If remote IS configured:
```bash
git push origin main
```
- Verify push succeeded by checking output
- Never claim push succeeded without confirmation from git output

### If remote is NOT configured:
```
⚠ No remote "origin" found.

To set up GitHub remote:
1. Create a new repository on GitHub (do NOT initialize with README)
2. Run: git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git
3. Run: git push -u origin main

For SSH:
   git remote add origin git@github.com:YOUR_USERNAME/REPO_NAME.git
```

- Never attempt to push without a configured remote
- Never fabricate push success messages

---

## 5. SECRET SAFETY POLICY (CRITICAL)

### ⚠ THIS SECTION IS MANDATORY FOR ALL COMMITS ⚠

Before **every** commit across **any** project in this portfolio, the following scan **MUST** be performed:

### Files to Scan For

| Pattern | Risk |
|---------|------|
| `.env`, `.env.*` | Environment variables with secrets |
| `*.key` | Private keys |
| `*.pem` | SSL/TLS certificates and keys |
| `*.p12`, `*.pfx` | PKCS#12 keystores |
| `credentials.json` | Service account credentials |
| `*.secret`, `*.secrets` | Generic secret files |

### Content Patterns to Detect

| Pattern | Example |
|---------|---------|
| `-----BEGIN.*PRIVATE KEY-----` | RSA/EC private keys |
| `AKIA[0-9A-Z]{16}` | AWS Access Key IDs |
| `AIza[0-9A-Za-z\-_]{35}` | Google API keys |
| `sk-[a-zA-Z0-9]{20,}` | OpenAI / Stripe secret keys |
| `ghp_[a-zA-Z0-9]{36}` | GitHub personal access tokens |
| `token[=:]\s*["'][^"']+["']` | Generic token assignments |
| `password[=:]\s*["'][^"']+["']` | Hardcoded passwords |
| `secret[=:]\s*["'][^"']+["']` | Generic secrets |
| `mongodb(\+srv)?://[^@]+@` | MongoDB connection strings with auth |
| `postgres(ql)?://[^@]+@` | PostgreSQL connection strings with auth |
| `mysql://[^@]+@` | MySQL connection strings with auth |
| `Authorization:\s*Bearer\s+[A-Za-z0-9\-._~+/]+=*` | Bearer tokens |

### If Suspicious Data Is Detected

```
🛑 COMMIT BLOCKED — POTENTIAL SECRET DETECTED

Suspicious files:
  - path/to/suspicious/file.env
  - path/to/another/credentials.json

Recommended actions:
  1. Add these files to .gitignore
  2. Remove them from staging: git reset HEAD <file>
  3. If already committed: see "Removing secrets from history" below
  4. Only proceed with explicit user confirmation
```

**Do NOT proceed with the commit until the user explicitly confirms.**

### Removing Secrets from Git History

If a secret was accidentally committed:

```bash
# Remove file from all history (DESTRUCTIVE — confirm with user first)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch PATH/TO/SECRET" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (DESTRUCTIVE — requires explicit user approval)
git push origin --force --all
```

**After removal:**
1. Rotate/revoke the exposed credential immediately
2. Update .gitignore to prevent re-commit
3. Notify relevant team members

### Additional Commit Protections

- **Never commit** `node_modules/`, `.godot/`, `Library/` (Unity), `build/`, `dist/`
- **Warn** if files larger than 10MB are staged (likely binaries or generated assets)
- **Prefer minimal, focused commits** — one logical change per commit

---

## 6. Commit Message Standard

### Format
```
type(scope): short description

Optional longer description.
```

### Types
| Type | Use For |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `chore` | Maintenance, checkpoints |
| `refactor` | Code restructuring |
| `docs` | Documentation only |
| `test` | Test additions/changes |
| `style` | Formatting, no logic change |

### Checkpoint Commits
```
chore(checkpoint): update progress + dashboards
```

---

## 7. Portfolio-Level Git Commands

### Check status of all projects
```bash
for dir in Akma crystal3d finalfantasy3d fishing "Hwarang's Path" kingdomDefense mechWar monsterBattle pocketDragon smashLand zelda; do
  echo "=== $dir ==="
  cd "/z/Development/Games/$dir" && git status -s
  cd /z/Development/Games
done
```

### Commit checkpoint across all projects
```bash
# Only after PLAN phase approval and secret scan
for dir in ...; do
  cd "/z/Development/Games/$dir"
  git add -A  # Review staged files first!
  git commit -m "chore(checkpoint): update progress + dashboards"
  cd /z/Development/Games
done
```

> **Warning:** Always review `git status` per project before batch committing.
> Never batch-push without verifying each project's remote configuration.
