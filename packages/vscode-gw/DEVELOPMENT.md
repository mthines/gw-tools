# Development

## Building

```bash
# Build the extension
nx build vscode-gw

# Package as .vsix
nx package vscode-gw

# Watch mode for development
cd packages/vscode-gw && node esbuild.config.mjs --watch
```

## Publishing

```bash
# Release to VS Code Marketplace + Open VSX
nx release vscode-gw

# Dry-run release (verify PAT, show what would publish)
nx release vscode-gw --configuration=dry-run
```

The extension is published to both marketplaces on merge to `main` (when source changes are detected) or via manual workflow dispatch with `force_release_vscode`.

| Marketplace                                                  | Secret Required                                                                                                                         |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| [VS Code Marketplace](https://marketplace.visualstudio.com/) | `VSCE_PAT` - [Create a PAT](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#get-a-personal-access-token) |
| [Open VSX Registry](https://open-vsx.org/)                   | `OVSX_PAT` - [Create a token](https://open-vsx.org/user-settings/tokens)                                                                |

Tags follow the pattern `vscode-gw-v{version}` (e.g., `vscode-gw-v0.2.0`).

## How It Works

The extension reads data from two sources:

1. **Git worktree list** (`git worktree list --porcelain`) - for the worktree explorer
2. **`.gw/` directory** - for agent task visualization, parsing the markdown artifacts (task.md, plan.md, walkthrough.md) created by the autonomous workflow agent

The artifact files follow the format defined in the [autonomous-workflow skill](../../skills/autonomous-workflow/SKILL.md).
