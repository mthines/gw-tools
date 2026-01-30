/**
 * Install shell integration command
 * Adds shell function to enable 'gw cd' to actually navigate
 */

import * as output from '../lib/output.ts';
import { join } from '$std/path';

/**
 * Execute the install-shell command
 *
 * @param args Command-line arguments for the install-shell command
 */
export async function executeInstallShell(args: string[]): Promise<void> {
  // Check for help flag
  if (args.includes('--help') || args.includes('-h')) {
    showInstallShellHelp();
    Deno.exit(0);
  }

  const removeFlag = args.includes('--remove');
  const quietFlag = args.includes('--quiet') || args.includes('-q');

  // Parse --name flag
  let commandName = 'gw';
  const nameIndex = args.findIndex(arg => arg === '--name' || arg === '-n');
  if (nameIndex !== -1 && nameIndex + 1 < args.length) {
    commandName = args[nameIndex + 1];
  }

  if (removeFlag) {
    await removeShellIntegration(quietFlag, commandName);
  } else {
    await installShellIntegration(quietFlag, commandName);
  }
}

/**
 * Install shell integration function
 */
async function installShellIntegration(quiet: boolean, commandName = 'gw'): Promise<void> {
  // Detect shell
  const shell = Deno.env.get('SHELL') || '';
  const shellName = shell.split('/').pop() || '';

  if (!quiet) {
    console.log(`Detected shell: ${output.bold(shellName || 'unknown')}`);
  }

  const home = Deno.env.get('HOME') || Deno.env.get('USERPROFILE') || '';

  // Determine config file and script file
  let configFile: string;
  let scriptFile: string;
  let shellFunction: string;
  let sourceLine: string;

  // Create filename suffix for non-default command names
  const fileSuffix = commandName === 'gw' ? '' : `-${commandName}`;

  if (shellName === 'zsh') {
    configFile = join(home, '.zshrc');
    scriptFile = join(home, '.gw', 'shell', `integration${fileSuffix}.zsh`);
    shellFunction = getZshFunction(commandName);
    sourceLine = `# gw-tools shell integration (${commandName})\n[ -f ~/.gw/shell/integration${fileSuffix}.zsh ] && source ~/.gw/shell/integration${fileSuffix}.zsh`;
  } else if (shellName === 'bash') {
    configFile = join(home, '.bashrc');
    scriptFile = join(home, '.gw', 'shell', `integration${fileSuffix}.bash`);
    shellFunction = getBashFunction(commandName);
    sourceLine = `# gw-tools shell integration (${commandName})\n[ -f ~/.gw/shell/integration${fileSuffix}.bash ] && source ~/.gw/shell/integration${fileSuffix}.bash`;
  } else if (shellName === 'fish') {
    const configDir = join(home, '.config', 'fish', 'functions');
    configFile = join(configDir, `${commandName}.fish`);
    scriptFile = configFile; // Fish uses function files directly
    shellFunction = getFishFunction(commandName);
    sourceLine = ''; // Fish doesn't need a source line
  } else {
    if (!quiet) {
      output.error(`Unsupported shell: ${shellName}`);
      console.log('\nSupported shells: zsh, bash, fish');
      console.log(
        '\nTo manually add gw cd support, add this to your shell config:',
      );
      console.log(getZshFunction());
    }
    Deno.exit(1);
  }

  // Check if already installed and migrate old format if needed
  let needsMigration = false;
  try {
    const content = await Deno.readTextFile(configFile);

    if (shellName !== 'fish') {
      // Check for old inline format (multi-line function in config file)
      const hasOldFormat = content.includes('# gw-tools shell integration') &&
                           content.includes('gw() {');

      // Check for new format (just source line)
      const hasNewFormat = content.includes('# gw-tools shell integration') &&
                           content.includes('source ~/.gw/shell/integration');

      if (hasOldFormat && !hasNewFormat) {
        needsMigration = true;
        if (!quiet) {
          console.log('Migrating old installation format...');
        }

        // Remove old format from config file
        const lines = content.split('\n');
        const filtered: string[] = [];
        let skipMode = false;

        for (const line of lines) {
          if (line.includes('# gw-tools shell integration')) {
            skipMode = true;
            continue;
          }
          if (skipMode && line.trim() === '}') {
            skipMode = false;
            continue;
          }
          if (!skipMode) {
            filtered.push(line);
          }
        }

        await Deno.writeTextFile(configFile, filtered.join('\n'));
      } else if (hasNewFormat) {
        // New format already installed, just ensure script file exists
        try {
          await Deno.stat(scriptFile);
          if (!quiet) {
            output.success('Shell integration already installed!');
            console.log(
              `Restart your shell or run: ${output.bold(`source ${configFile}`)}`,
            );
          }
          return;
        } catch {
          // Script file missing, continue with installation
          if (!quiet) {
            console.log('Recreating missing integration script...');
          }
        }
      }
    } else {
      // Fish - check if function file exists
      if (content.includes('# gw-tools shell integration')) {
        if (!quiet) {
          output.success('Shell integration already installed!');
        }
        return;
      }
    }
  } catch (error) {
    // File doesn't exist, will be created
    if (error instanceof Deno.errors.NotFound) {
      // File will be created when we append
    } else {
      throw error;
    }
  }

  // Create script file
  try {
    // Ensure directory exists
    const scriptDir = scriptFile.substring(0, scriptFile.lastIndexOf('/'));
    await Deno.mkdir(scriptDir, { recursive: true });

    // Write shell function to script file
    await Deno.writeTextFile(scriptFile, shellFunction);

    if (!quiet) {
      console.log(`Created integration script: ${output.path(scriptFile)}`);
    }
  } catch (error) {
    let message = '';
    if (error instanceof Error) {
      message = error.message;
    } else if (
      typeof error === 'object' &&
      error !== null &&
      'message' in error
    ) {
      message = String((error as any).message);
    } else {
      message = String(error);
    }
    output.error(`Failed to write integration script to ${scriptFile}: ${message}`);
    Deno.exit(1);
  }

  // Add source line to config file (except for fish)
  try {
    if (shellName === 'fish') {
      // Fish doesn't need to source the file, it auto-loads from functions directory
      if (!quiet) {
        output.success('Shell integration installed!');
        console.log(`Added function: ${output.path(configFile)}`);
        console.log('\nFish will automatically load the function.');
        console.log('\nUsage:');
        console.log(`  ${output.bold('gw cd')} ${output.dim('feat-branch')}`);
      }
    } else {
      // Bash/Zsh append source line to config file
      await Deno.writeTextFile(configFile, '\n' + sourceLine + '\n', {
        append: true,
      });

      if (!quiet) {
        output.success('Shell integration installed!');
        console.log(`Added source line to: ${output.path(configFile)}`);
        console.log(`Integration script: ${output.path(scriptFile)}`);
        console.log('\nTo start using it:');
        console.log(`  ${output.bold(`source ${configFile}`)}`);
        console.log('\nOr restart your terminal.');
        console.log('\nUsage:');
        console.log(`  ${output.bold('gw cd')} ${output.dim('feat-branch')}`);
      }
    }
  } catch (error) {
    let message = '';
    if (error instanceof Error) {
      message = error.message;
    } else if (
      typeof error === 'object' &&
      error !== null &&
      'message' in error
    ) {
      message = String((error as any).message);
    } else {
      message = String(error);
    }
    output.error(`Failed to write to ${configFile}: ${message}`);
    Deno.exit(1);
  }
}

/**
 * Remove shell integration function
 */
async function removeShellIntegration(quiet: boolean, commandName = 'gw'): Promise<void> {
  const shell = Deno.env.get('SHELL') || '';
  const shellName = shell.split('/').pop() || '';
  const home = Deno.env.get('HOME') || Deno.env.get('USERPROFILE') || '';

  // Create filename suffix for non-default command names
  const fileSuffix = commandName === 'gw' ? '' : `-${commandName}`;

  let configFile: string;
  let scriptFile: string;

  if (shellName === 'zsh') {
    configFile = join(home, '.zshrc');
    scriptFile = join(home, '.gw', 'shell', `integration${fileSuffix}.zsh`);
  } else if (shellName === 'bash') {
    configFile = join(home, '.bashrc');
    scriptFile = join(home, '.gw', 'shell', `integration${fileSuffix}.bash`);
  } else if (shellName === 'fish') {
    configFile = join(home, '.config', 'fish', 'functions', `${commandName}.fish`);
    scriptFile = configFile; // Fish uses function files directly
  } else {
    if (!quiet) {
      output.error(`Unsupported shell: ${shellName}`);
    }
    Deno.exit(1);
  }

  let foundIntegration = false;

  // Remove the integration script file
  try {
    await Deno.remove(scriptFile);
    foundIntegration = true;
    if (!quiet) {
      console.log(`Removed integration script: ${output.path(scriptFile)}`);
    }
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }

  // Remove source line from config file (for bash/zsh)
  if (shellName !== 'fish') {
    try {
      const content = await Deno.readTextFile(configFile);
      const lines = content.split('\n');
      const filtered: string[] = [];
      let skipNext = false;

      for (const line of lines) {
        // Match both old format and new format with command name
        if (line.includes('# gw-tools shell integration') &&
            (line.includes(`(${commandName})`) || !line.includes('('))) {
          foundIntegration = true;
          skipNext = true;
          continue;
        }
        if (skipNext && line.includes(`source ~/.gw/shell/integration${fileSuffix}`)) {
          skipNext = false;
          continue;
        }
        skipNext = false;
        filtered.push(line);
      }

      await Deno.writeTextFile(configFile, filtered.join('\n'));
      if (!quiet) {
        console.log(`Removed source line from: ${output.path(configFile)}`);
      }
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        let message = '';
        if (error instanceof Error) {
          message = error.message;
        } else if (
          typeof error === 'object' &&
          error !== null &&
          'message' in error
        ) {
          message = String((error as any).message);
        } else {
          message = String(error);
        }
        output.error(`Failed to remove integration: ${message}`);
        Deno.exit(1);
      }
    }
  }

  if (foundIntegration) {
    if (!quiet) {
      output.success('Shell integration removed!');
    }
  } else {
    if (!quiet) {
      output.info('Shell integration not found.');
    }
  }
}

/**
 * Get zsh shell function
 */
function getZshFunction(commandName = 'gw'): string {
  return `# gw-tools shell integration
${commandName}() {
  if [[ "$1" == "cd" ]]; then
    # Pass through help flags directly
    if [[ "$2" == "--help" || "$2" == "-h" ]]; then
      command ${commandName} cd "$2"
      return
    fi
    local target=$(command ${commandName} cd "$2" 2>/dev/null)
    if [[ -n "$target" ]]; then
      cd "$target"
    else
      command ${commandName} cd "$2"
    fi
  elif [[ "$1" == "rm" || "$1" == "remove" ]]; then
    # Get git root before removing (in case we're removing current worktree)
    local git_root=$(command ${commandName} root 2>/dev/null)
    # Execute the remove command
    command ${commandName} "$@"
    local exit_code=$?
    # If removal succeeded and we have a git root, cd to it
    if [[ $exit_code -eq 0 && -n "$git_root" && ! -d "$PWD" ]]; then
      cd "$git_root"
    fi
    return $exit_code
  elif [[ "$1" == "add" ]]; then
    # Execute the command (output streams in real-time)
    command ${commandName} "$@"
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
    command ${commandName} "$@"
  fi
}`;
}

/**
 * Get bash shell function
 */
function getBashFunction(commandName = 'gw'): string {
  return `# gw-tools shell integration
${commandName}() {
  if [[ "$1" == "cd" ]]; then
    # Pass through help flags directly
    if [[ "$2" == "--help" || "$2" == "-h" ]]; then
      command ${commandName} cd "$2"
      return
    fi
    local target=$(command ${commandName} cd "$2" 2>/dev/null)
    if [[ -n "$target" ]]; then
      cd "$target"
    else
      command ${commandName} cd "$2"
    fi
  elif [[ "$1" == "rm" || "$1" == "remove" ]]; then
    # Get git root before removing (in case we're removing current worktree)
    local git_root=$(command ${commandName} root 2>/dev/null)
    # Execute the remove command
    command ${commandName} "$@"
    local exit_code=$?
    # If removal succeeded and we have a git root, cd to it
    if [[ $exit_code -eq 0 && -n "$git_root" && ! -d "$PWD" ]]; then
      cd "$git_root"
    fi
    return $exit_code
  elif [[ "$1" == "add" ]]; then
    # Execute the command (output streams in real-time)
    command ${commandName} "$@"
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
    command ${commandName} "$@"
  fi
}`;
}

/**
 * Get fish shell function
 */
function getFishFunction(commandName = 'gw'): string {
  return `# gw-tools shell integration
function ${commandName}
    if test "$argv[1]" = "cd"
        # Pass through help flags directly
        if test "$argv[2]" = "--help" -o "$argv[2]" = "-h"
            command ${commandName} cd $argv[2]
            return
        end
        set -l target (command ${commandName} cd $argv[2] 2>/dev/null)
        if test -n "$target"
            cd $target
        else
            command ${commandName} cd $argv[2]
        end
    else if test "$argv[1]" = "rm" -o "$argv[1]" = "remove"
        # Get git root before removing (in case we're removing current worktree)
        set -l git_root (command ${commandName} root 2>/dev/null)
        # Execute the remove command
        command ${commandName} $argv
        set -l exit_code $status
        # If removal succeeded and we have a git root, cd to it
        if test $exit_code -eq 0 -a -n "$git_root" -a ! -d "$PWD"
            cd $git_root
        end
        return $exit_code
    else if test "$argv[1]" = "add"
        # Execute the command (output streams in real-time)
        command ${commandName} $argv
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
        command ${commandName} $argv
    end
end`;
}

/**
 * Display help text for the install-shell command
 */
function showInstallShellHelp(): void {
  console.log(`
gw install-shell - Install shell integration for gw cd

Usage:
  gw install-shell [options]

Options:
  --name, -n NAME  Install under a different command name (default: gw)
  --remove, -r     Remove shell integration
  --quiet, -q      Suppress output messages
  -h, --help       Show this help message

Description:
  Installs a shell function that enables 'gw cd <worktree>' to actually
  navigate to the worktree directory. Without this integration, 'gw cd'
  only outputs the path and requires using 'cd $(gw cd <worktree>)'.

  The command detects your shell (zsh, bash, or fish) and creates an
  integration script in ~/.gw/shell/, then adds a single line to your
  shell configuration to source it.

  Use --name to install for aliases or different command names. For example,
  if you have 'alias gw-dev="deno run ..."', you can install integration
  for that alias using '--name gw-dev'.

  Supported shells:
    - Zsh (~/.zshrc sources ~/.gw/shell/integration[-NAME].zsh)
    - Bash (~/.bashrc sources ~/.gw/shell/integration[-NAME].bash)
    - Fish (~/.config/fish/functions/[NAME].fish)

  The installation is idempotent - running it multiple times won't
  create duplicate entries. It will also automatically migrate old
  inline installations to the new format.

Examples:
  # Install shell integration for 'gw'
  gw install-shell

  # Install for development alias 'gw-dev'
  gw install-shell --name gw-dev

  # Remove shell integration for 'gw-dev'
  gw install-shell --name gw-dev --remove

  # Install quietly (for scripts/automation)
  gw install-shell --quiet

After Installation:
  Restart your terminal or run:
    source ~/.zshrc   # for zsh
    source ~/.bashrc  # for bash
    # fish automatically loads functions

  Then use:
    gw cd feat-branch  # navigates directly to the worktree
`);
}
