---
title: 'Team Configuration Management'
impact: MEDIUM
tags:
  - team
  - sharing
  - onboarding
---

# Team Configuration Management

## Overview

Share gw configuration with your team through version control.
Proper team setup ensures consistent workflows and easy onboarding.

## Core Principles

- **Commit `.gw/config.json` to repo**: Team gets config automatically.
- **Document auto-copy files**: Help team understand what's needed.
- **Use `gw show-init` for documentation**: Generate setup command.
- **Separate team vs personal config**: Some files are personal only.

## Sharing Configuration

### Commit to Version Control

```bash
git add .gw/config.json
git commit -m "chore: add gw configuration"
git push
```

### Benefits

- Team members get configuration automatically
- Consistent workflow across team
- Version-controlled changes
- Easy onboarding

## Team-Wide vs Personal Files

### Team-Wide (Commit)

Files everyone needs:

```json
{
  "autoCopyFiles": [".env.template", "ssl/development-cert.pem", "config/shared.json"]
}
```

### Personal (Don't Commit)

Create `.gw/config.local.json` for personal overrides. It's automatically
gitignored by `.gw/.gitignore` and merged on top of `config.json` (local wins).

```bash
# Create personal override with extra files
cat > .gw/config.local.json << 'EOF'
{
  "autoCopyFiles": [".env", ".env.local", "my-dev-config.json"]
}
EOF
```

## Documentation

### In README

```markdown
## Development Setup

### Prerequisites

- Node.js 18+
- gw-tools: `npm install -g gw-tool`

### Initial Setup

1. Clone the repository
2. Set up environment:
   \`\`\`bash
   cp .env.example .env
   # Get secrets from team lead or password manager
   \`\`\`
3. Create feature worktree:
   \`\`\`bash
   gw checkout feature-name
   \`\`\`

### Auto-Copied Files

The following files are automatically copied to new worktrees:

- `.env` - Environment variables
- `ssl/` - Development SSL certificates
- `secrets/` - Service credentials
```

### Generate Setup Command

```bash
# Show init command from current config
gw show-init

# Output:
# gw init --auto-copy-files .env,secrets/ --post-checkout 'cd {worktreePath} && pnpm install'

# Copy to clipboard (macOS)
gw show-init | pbcopy
```

## Onboarding Checklist

### For New Developers

1. Clone repository
2. Install gw: `npm install -g gw-tool`
3. Install shell integration:
   ```bash
   eval "$(gw install-shell)"
   # Add to ~/.zshrc or ~/.bashrc
   ```
4. Set up secrets (one-time):
   ```bash
   cd main
   cp .env.example .env
   # Get actual values from team lead
   ```
5. Create first worktree:
   ```bash
   gw checkout feature-onboarding
   # Files automatically copied
   ```

### Verify Setup Works

```bash
# Should create worktree with all files
gw checkout test-setup

# Check files exist
ls test-setup/.env
ls test-setup/secrets/

# Clean up
gw remove test-setup
```

## Keeping Secrets Updated

When secrets change in defaultBranch:

```bash
# Notify team
# Team members sync their worktrees:

# Sync to current worktree
gw sync

# Sync to specific worktree
gw sync feature-branch
```

## Troubleshooting

### New Team Member Missing Files

**Symptom**: Files not in new worktrees.

**Cause**: Secrets not set up in defaultBranch worktree.

**Fix**:

```bash
# Team member needs to set up source files first
cd main
cp .env.example .env
# Add secrets

# Then create worktrees
gw checkout feature-x
```

### Config Out of Sync

**Symptom**: Different team members have different config.

**Fix**:

```bash
# Pull latest config
git pull

# Reinitialize if needed
gw init
```

## References

- Related rule: [setup](./setup.md)
- Related rule: [auto-copy](./auto-copy.md)
