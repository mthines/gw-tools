/**
 * Install shell integration command
 * Outputs shell function code to stdout for use with eval
 */

import * as output from "../lib/output.ts";
import { join } from "@std/path";

/**
 * Execute the install-shell command
 *
 * @param args Command-line arguments for the install-shell command
 */
export async function executeInstallShell(args: string[]): Promise<void> {
  // Check for help flag
  if (args.includes("--help") || args.includes("-h")) {
    showInstallShellHelp();
    Deno.exit(0);
  }

  const removeFlag = args.includes("--remove");
  const quietFlag = args.includes("--quiet") || args.includes("-q");

  // Parse --name flag
  let commandName = "gw";
  const nameIndex = args.findIndex((arg) => arg === "--name" || arg === "-n");
  if (nameIndex !== -1 && nameIndex + 1 < args.length) {
    commandName = args[nameIndex + 1];
  }

  // Parse --command flag (actual command to run, e.g., for aliases)
  let actualCommand: string | undefined;
  const commandIndex = args.findIndex((arg) =>
    arg === "--command" || arg === "-c"
  );
  if (commandIndex !== -1 && commandIndex + 1 < args.length) {
    actualCommand = args[commandIndex + 1];
  }

  if (removeFlag) {
    await removeShellIntegration(quietFlag, commandName);
  } else {
    await outputShellIntegration(commandName, actualCommand);
  }
}

/**
 * Output shell integration code to stdout
 */
async function outputShellIntegration(
  commandName = "gw",
  actualCommand?: string,
): Promise<void> {
  // Detect shell
  const shell = Deno.env.get("SHELL") || "";
  const shellName = shell.split("/").pop() || "";
  // const home = Deno.env.get('HOME') || Deno.env.get('USERPROFILE') || '';

  let shellFunction: string;

  if (shellName === "zsh") {
    shellFunction = getZshFunction(commandName, actualCommand);
  } else if (shellName === "bash") {
    shellFunction = getBashFunction(commandName, actualCommand);
  } else if (shellName === "fish") {
    shellFunction = getFishFunction(commandName, actualCommand);
  } else {
    // Always show this error on stderr
    output.error(`Unsupported shell: ${shellName || "unknown"}`);
    console.log("\nSupported shells: zsh, bash, fish");
    console.log("Set SHELL environment variable to your shell path.");
    console.log("\nYou can still use gw without shell integration,");
    console.log('but "gw cd" will not be available.');
    Deno.exit(1);
  }

  // Write shell function to stdout
  const encoder = new TextEncoder();
  await Deno.stdout.write(encoder.encode(shellFunction + "\n"));
}

/**
 * Remove shell integration (legacy files + new eval-based lines)
 */
async function removeShellIntegration(
  quiet: boolean,
  commandName = "gw",
): Promise<void> {
  const shell = Deno.env.get("SHELL") || "";
  const shellName = shell.split("/").pop() || "";
  const home = Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || "";

  if (!home) {
    output.error("HOME environment variable is not set");
    console.log("\nShell integration removal requires HOME to be set.");
    Deno.exit(1);
  }

  // Create filename suffix for non-default command names
  const fileSuffix = commandName === "gw" ? "" : `-${commandName}`;

  let configFile: string | undefined;

  if (shellName === "zsh") {
    configFile = join(home, ".zshrc");
  } else if (shellName === "bash") {
    configFile = join(home, ".bashrc");
  } else if (shellName === "fish") {
    configFile = join(home, ".config", "fish", "config.fish");
  } else {
    if (!quiet) {
      output.error(`Unsupported shell: ${shellName}`);
    }
    Deno.exit(1);
  }

  let foundIntegration = false;

  // Remove old integration script files (legacy format)
  const legacyScriptFiles = [
    join(home, ".gw", "shell", `integration${fileSuffix}.zsh`),
    join(home, ".gw", "shell", `integration${fileSuffix}.bash`),
  ];

  for (const scriptFile of legacyScriptFiles) {
    try {
      await Deno.remove(scriptFile);
      foundIntegration = true;
      if (!quiet) {
        console.log(
          `Removed legacy integration script: ${output.path(scriptFile)}`,
        );
      }
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
    }
  }

  // Remove old Fish function files (legacy format)
  const fishFunctionFile = join(
    home,
    ".config",
    "fish",
    "functions",
    `${commandName}.fish`,
  );
  try {
    await Deno.remove(fishFunctionFile);
    foundIntegration = true;
    if (!quiet) {
      console.log(
        `Removed legacy fish function: ${output.path(fishFunctionFile)}`,
      );
    }
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }

  // Remove lines from config file
  if (configFile) {
    try {
      const content = await Deno.readTextFile(configFile);
      const lines = content.split("\n");
      const filtered: string[] = [];
      let skipNext = false;

      for (const line of lines) {
        // Remove old format: comment + source line
        if (
          line.includes("# gw-tools shell integration") &&
          (line.includes(`(${commandName})`) || !line.includes("("))
        ) {
          foundIntegration = true;
          skipNext = true;
          continue;
        }
        if (
          skipNext &&
          line.includes(`source ~/.gw/shell/integration${fileSuffix}`)
        ) {
          skipNext = false;
          continue;
        }
        skipNext = false;

        // Remove old inline format (multi-line function in config)
        if (
          line.includes("# gw-tools shell integration") &&
          !line.includes("eval") && !line.includes("source")
        ) {
          // Start of old inline block - skip until closing brace
          foundIntegration = true;
          // We'll handle this by just marking found and letting the comment line be removed
          continue;
        }

        // Remove new eval-based format
        if (line.includes("gw install-shell")) {
          foundIntegration = true;
          continue;
        }

        filtered.push(line);
      }

      if (foundIntegration) {
        await Deno.writeTextFile(configFile, filtered.join("\n"));
        if (!quiet) {
          console.log(`Updated: ${output.path(configFile)}`);
        }
      }
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        const message = error instanceof Error ? error.message : String(error);
        output.error(`Failed to remove integration: ${message}`);
        Deno.exit(1);
      }
    }
  }

  // Clean up empty legacy directories
  try {
    const shellDir = join(home, ".gw", "shell");
    const files = [];
    for await (const entry of Deno.readDir(shellDir)) {
      files.push(entry);
    }
    if (files.length === 0) {
      await Deno.remove(shellDir);
      if (!quiet) {
        console.log(`Removed empty directory: ${output.path(shellDir)}`);
      }
    }
  } catch {
    // Directory doesn't exist or not empty, ignore
  }

  if (foundIntegration) {
    if (!quiet) {
      output.success("Shell integration removed!");
    }
  } else {
    if (!quiet) {
      output.info("Shell integration not found.");
    }
  }
}

/**
 * Get zsh shell function
 */
export function getZshFunction(
  commandName = "gw",
  actualCommand?: string,
): string {
  // Use provided command or default to 'command <name>'
  const cmdPrefix = actualCommand || `command ${commandName}`;

  return `# gw-tools shell integration
${commandName}() {
  if [[ "$1" == "cd" ]]; then
    # Pass through help flags directly
    if [[ "$2" == "--help" || "$2" == "-h" ]]; then
      ${cmdPrefix} cd "$2"
      return
    fi
    local target=$(${cmdPrefix} cd "$2" 2>/dev/null)
    if [[ -n "$target" ]]; then
      cd "$target"
    else
      ${cmdPrefix} cd "$2"
    fi
  elif [[ "$1" == "rm" || "$1" == "remove" ]]; then
    # Get git root before removing (in case we're removing current worktree)
    local git_root=$(${cmdPrefix} root 2>/dev/null)
    # Execute the remove command
    ${cmdPrefix} "$@"
    local exit_code=$?
    # If removal succeeded and we have a git root, cd to it
    if [[ $exit_code -eq 0 && -n "$git_root" && ! -d "$PWD" ]]; then
      cd "$git_root"
    fi
    return $exit_code
  elif [[ "$1" == "add" || "$1" == "checkout" || "$1" == "co" || "$1" == "pr" || "$1" == "init" ]]; then
    # Execute the command (output streams in real-time)
    ${cmdPrefix} "$@"
    local exit_code=$?
    # Check for navigation marker file
    local nav_file="$HOME/.gw/tmp/last-nav"
    if [[ -f "$nav_file" ]]; then
      local nav_path=$(cat "$nav_file")
      rm -f "$nav_file"
      cd "$nav_path"
    fi
    return $exit_code
  else
    ${cmdPrefix} "$@"
  fi
}`;
}

/**
 * Get bash shell function
 */
export function getBashFunction(
  commandName = "gw",
  actualCommand?: string,
): string {
  // Use provided command or default to 'command <name>'
  const cmdPrefix = actualCommand || `command ${commandName}`;

  return `# gw-tools shell integration
${commandName}() {
  if [[ "$1" == "cd" ]]; then
    # Pass through help flags directly
    if [[ "$2" == "--help" || "$2" == "-h" ]]; then
      ${cmdPrefix} cd "$2"
      return
    fi
    local target=$(${cmdPrefix} cd "$2" 2>/dev/null)
    if [[ -n "$target" ]]; then
      cd "$target"
    else
      ${cmdPrefix} cd "$2"
    fi
  elif [[ "$1" == "rm" || "$1" == "remove" ]]; then
    # Get git root before removing (in case we're removing current worktree)
    local git_root=$(${cmdPrefix} root 2>/dev/null)
    # Execute the remove command
    ${cmdPrefix} "$@"
    local exit_code=$?
    # If removal succeeded and we have a git root, cd to it
    if [[ $exit_code -eq 0 && -n "$git_root" && ! -d "$PWD" ]]; then
      cd "$git_root"
    fi
    return $exit_code
  elif [[ "$1" == "add" || "$1" == "checkout" || "$1" == "co" || "$1" == "pr" || "$1" == "init" ]]; then
    # Execute the command (output streams in real-time)
    ${cmdPrefix} "$@"
    local exit_code=$?
    # Check for navigation marker file
    local nav_file="$HOME/.gw/tmp/last-nav"
    if [[ -f "$nav_file" ]]; then
      local nav_path=$(cat "$nav_file")
      rm -f "$nav_file"
      cd "$nav_path"
    fi
    return $exit_code
  else
    ${cmdPrefix} "$@"
  fi
}`;
}

/**
 * Get fish shell function
 */
export function getFishFunction(
  commandName = "gw",
  actualCommand?: string,
): string {
  // Use provided command or default to 'command <name>'
  const cmdPrefix = actualCommand || `command ${commandName}`;

  return `# gw-tools shell integration
function ${commandName}
    if test "$argv[1]" = "cd"
        # Pass through help flags directly
        if test "$argv[2]" = "--help" -o "$argv[2]" = "-h"
            ${cmdPrefix} cd $argv[2]
            return
        end
        set -l target (${cmdPrefix} cd $argv[2] 2>/dev/null)
        if test -n "$target"
            cd $target
        else
            ${cmdPrefix} cd $argv[2]
        end
    else if test "$argv[1]" = "rm" -o "$argv[1]" = "remove"
        # Get git root before removing (in case we're removing current worktree)
        set -l git_root (${cmdPrefix} root 2>/dev/null)
        # Execute the remove command
        ${cmdPrefix} $argv
        set -l exit_code $status
        # If removal succeeded and we have a git root, cd to it
        if test $exit_code -eq 0 -a -n "$git_root" -a ! -d "$PWD"
            cd $git_root
        end
        return $exit_code
    else if test "$argv[1]" = "add" -o "$argv[1]" = "checkout" -o "$argv[1]" = "co" -o "$argv[1]" = "pr" -o "$argv[1]" = "init"
        # Execute the command (output streams in real-time)
        ${cmdPrefix} $argv
        set -l exit_code $status
        # Check for navigation marker file
        set -l nav_file "$HOME/.gw/tmp/last-nav"
        if test -f "$nav_file"
            set -l nav_path (cat "$nav_file")
            rm -f "$nav_file"
            cd $nav_path
        end
        return $exit_code
    else
        ${cmdPrefix} $argv
    end
end`;
}

/**
 * Display help text for the install-shell command
 */
function showInstallShellHelp(): void {
  console.log(`
gw install-shell - Output shell integration code for gw

Usage:
  eval "$(gw install-shell)"           # Add to ~/.zshrc or ~/.bashrc
  gw install-shell | source            # Add to ~/.config/fish/config.fish
  gw install-shell --remove            # Remove shell integration

Options:
  --name, -n NAME     Output for a different command name (default: gw)
  --command, -c CMD   Actual command to run (use with --name for aliases/dev)
  --remove, -r        Remove shell integration from config files
  --quiet, -q         Suppress output messages (for --remove)
  -h, --help          Show this help message

Description:
  Outputs a shell function to stdout that enables 'gw cd <worktree>' to actually
  navigate to the worktree directory, and provides real-time streaming output for
  commands like 'gw checkout'.

  Add the eval line to your shell configuration file so it runs on every new shell:

    # Zsh (~/.zshrc)
    eval "$(gw install-shell)"

    # Bash (~/.bashrc)
    eval "$(gw install-shell)"

    # Fish (~/.config/fish/config.fish)
    gw install-shell | source

  Use --name with --command to set up development aliases:

    eval "$(gw install-shell --name gw-dev --command 'deno run --allow-all main.ts')"

  Use --remove to clean up shell integration from config files (removes both
  legacy file-based and eval-based integration).

Examples:
  # Test the output
  gw install-shell

  # Add to your shell config
  echo 'eval "$(gw install-shell)"' >> ~/.zshrc

  # Install for development (with Deno)
  echo 'eval "$(gw install-shell --name gw-dev --command "deno run --allow-all ~/path/to/main.ts")"' >> ~/.zshrc

  # Remove all shell integration
  gw install-shell --remove

After adding the eval line:
  Restart your terminal or run:
    source ~/.zshrc   # for zsh
    source ~/.bashrc  # for bash
    # fish automatically picks up changes

  Then use:
    gw cd feat-branch  # navigates directly to the worktree
`);
}
