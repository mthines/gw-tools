#!/usr/bin/env -S deno run --allow-all

/**
 * Main entry point for the gw CLI tool
 */

import { parseGlobalArgs, showGlobalHelp } from "./lib/cli.ts";
import { executeCopy } from "./commands/copy.ts";
import { executeRoot } from "./commands/root.ts";

/**
 * Available commands mapped to their handler functions
 */
const COMMANDS = {
  copy: executeCopy,
  root: executeRoot,
  // Future commands can be added here:
  // init: executeInit,
  // list: executeList,
  // "add-repo": executeAddRepo,
};

if (import.meta.main) {
  try {
    // Parse global arguments to extract command
    const { command, args, help } = parseGlobalArgs(Deno.args);

    // Show help if requested or no command provided
    if (help || !command) {
      showGlobalHelp();
      Deno.exit(command ? 0 : 1);
    }

    // Get command handler
    const handler = COMMANDS[command as keyof typeof COMMANDS];
    if (!handler) {
      console.error(`Error: Unknown command '${command}'`);
      console.error("Run 'gw --help' for usage information");
      Deno.exit(1);
    }

    // Execute command
    await handler(args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    Deno.exit(1);
  }
}
