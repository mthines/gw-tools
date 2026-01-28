#!/usr/bin/env -S deno run --allow-all

/**
 * Main entry point for the gw CLI tool
 */

import { parseGlobalArgs, showGlobalHelp, showVersion } from './lib/cli.ts';
import { executeAdd } from './commands/add.ts';
import { executeCd } from './commands/cd.ts';
import { executeCopy } from './commands/sync.ts';
import { executePull } from './commands/pull.ts';
import { executeInit } from './commands/init.ts';
import { executeInstallShell } from './commands/install-shell.ts';
import { executeRoot } from './commands/root.ts';
import { executeList } from './commands/list.ts';
import { executeRemove } from './commands/remove.ts';
import { executeMove } from './commands/move.ts';
import { executePrune } from './commands/prune.ts';
import { executeLock } from './commands/lock.ts';
import { executeUnlock } from './commands/unlock.ts';
import { executeRepair } from './commands/repair.ts';
import { executeClean } from './commands/clean.ts';
import { executeShowInit } from './commands/show-init.ts';
import * as output from './lib/output.ts';

/**
 * Available commands mapped to their handler functions
 */
const COMMANDS = {
  add: executeAdd,
  cd: executeCd,
  pull: executePull,
  sync: executeCopy,
  init: executeInit,
  'install-shell': executeInstallShell,
  root: executeRoot,
  list: executeList,
  ls: executeList, // Alias for list
  remove: executeRemove,
  rm: executeRemove, // Alias for remove
  move: executeMove,
  mv: executeMove, // Alias for move
  prune: executePrune,
  lock: executeLock,
  unlock: executeUnlock,
  repair: executeRepair,
  clean: executeClean,
  'show-init': executeShowInit,
};

if (import.meta.main) {
  try {
    // Parse global arguments to extract command
    const { command, args, help, version } = parseGlobalArgs(Deno.args);

    // Show version if requested
    if (version) {
      showVersion();
      Deno.exit(0);
    }

    // Show help if requested or no command provided
    if (help || !command) {
      showGlobalHelp();
      Deno.exit(command ? 0 : 1);
    }

    // Get command handler
    const handler = COMMANDS[command as keyof typeof COMMANDS];
    if (!handler) {
      output.error(`Unknown command '${command}'`);
      console.error("Run 'gw --help' for usage information\n");
      Deno.exit(1);
    }

    // Execute command
    await handler(args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    output.error(message);
    Deno.exit(1);
  }
}
