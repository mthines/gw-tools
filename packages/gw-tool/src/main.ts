#!/usr/bin/env -S deno run --allow-all

/**
 * Main entry point for the gw CLI tool
 */

import { parseGlobalArgs, showGlobalHelp } from "./lib/cli.ts";
import { executeAdd } from "./commands/add.ts";
import { executeCopy } from "./commands/copy.ts";
import { executeInit } from "./commands/init.ts";
import { executeRoot } from "./commands/root.ts";
import * as output from "./lib/output.ts";

/**
 * Available commands mapped to their handler functions
 */
const COMMANDS = {
  add: executeAdd,
  copy: executeCopy,
  init: executeInit,
  root: executeRoot,
  // Future commands can be added here:
  // list: executeList,
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
