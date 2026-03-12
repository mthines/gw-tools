---
paths: src/commands/**/*.ts
---

# Command Implementation Rules

## Structure Pattern

Every command follows this structure:

```typescript
/**
 * <Command> command implementation
 * <Brief description>
 */

import * as output from "../lib/output.ts";
// other imports...

function parse<Name>Args(args: string[]) { /* ... */ }
function show<Name>Help(): void { /* console.log with usage */ }

export async function execute<Name>(args: string[]): Promise<void> {
  const parsed = parse<Name>Args(args);
  if (parsed.help) { show<Name>Help(); Deno.exit(0); }
  // validation then implementation
}
```

## Proxy Commands (git worktree wrappers)

For simple wrappers, use the git-proxy utilities:

```typescript
import { executeGitWorktree, showProxyHelp } from '../lib/git-proxy.ts';

export async function execute<Name>(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    showProxyHelp('<command>', '<git-subcommand>', '<description>', ['example1', 'example2']);
    Deno.exit(0);
  }
  await executeGitWorktree('<git-subcommand>', args);
}
```

## Help Text Format

```
gw <command> - <Brief description>

Usage:
  gw <command> [options] [arguments]

Arguments:
  <required-arg>    Description
  [optional-arg]    Description (optional)

Options:
  --option <value>  Description (default: "value")
  -n, --dry-run     Boolean flag description
  -h, --help        Show this help message

Examples:
  # Comment explaining the example
  gw <command> example-args
```

## Error Handling

```typescript
// Fatal errors - exit immediately
output.error('Something went wrong');
Deno.exit(1);

// Non-fatal warnings - continue execution
output.warning('File copy failed - continuing anyway');
```
