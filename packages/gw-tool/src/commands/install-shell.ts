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

  if (removeFlag) {
    await removeShellIntegration(quietFlag);
  } else {
    await installShellIntegration(quietFlag);
  }
}

/**
 * Install shell integration function
 */
async function installShellIntegration(quiet: boolean): Promise<void> {
  // Detect shell
  const shell = Deno.env.get('SHELL') || '';
  const shellName = shell.split('/').pop() || '';

  if (!quiet) {
    console.log(`Detected shell: ${output.bold(shellName || 'unknown')}`);
  }

  // Determine config file
  let configFile: string;
  let shellFunction: string;

  if (shellName === 'zsh') {
    const home = Deno.env.get('HOME') || Deno.env.get('USERPROFILE') || '';
    configFile = join(home, '.zshrc');
    shellFunction = getZshFunction();
  } else if (shellName === 'bash') {
    const home = Deno.env.get('HOME') || Deno.env.get('USERPROFILE') || '';
    configFile = join(home, '.bashrc');
    shellFunction = getBashFunction();
  } else if (shellName === 'fish') {
    const home = Deno.env.get('HOME') || Deno.env.get('USERPROFILE') || '';
    const configDir = join(home, '.config', 'fish', 'functions');
    configFile = join(configDir, 'gw.fish');
    shellFunction = getFishFunction();
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

  // Check if already installed
  try {
    const content = await Deno.readTextFile(configFile);
    if (content.includes('# gw-tools shell integration')) {
      if (!quiet) {
        output.success('Shell integration already installed!');
        console.log(
          `Restart your shell or run: ${output.bold(`source ${configFile}`)}`,
        );
      }
      return;
    }
  } catch (error) {
    // File doesn't exist, will be created
    if (error instanceof Deno.errors.NotFound) {
      // For fish, ensure directory exists
      if (shellName === 'fish') {
        const configDir = join(
          Deno.env.get('HOME') || '',
          '.config',
          'fish',
          'functions',
        );
        await Deno.mkdir(configDir, { recursive: true });
      }
    } else {
      throw error;
    }
  }

  // Add to config file
  try {
    if (shellName === 'fish') {
      // Fish uses separate function files
      await Deno.writeTextFile(configFile, shellFunction);
    } else {
      // Bash/Zsh append to config file
      await Deno.writeTextFile(configFile, '\n' + shellFunction + '\n', {
        append: true,
      });
    }

    if (!quiet) {
      output.success('Shell integration installed!');
      console.log(`Added to: ${output.path(configFile)}`);
      console.log('\nTo start using it:');
      console.log(`  ${output.bold(`source ${configFile}`)}`);
      console.log('\nOr restart your terminal.');
      console.log('\nUsage:');
      console.log(`  ${output.bold('gw cd')} ${output.dim('feat-branch')}`);
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
async function removeShellIntegration(quiet: boolean): Promise<void> {
  const shell = Deno.env.get('SHELL') || '';
  const shellName = shell.split('/').pop() || '';
  const home = Deno.env.get('HOME') || Deno.env.get('USERPROFILE') || '';

  let configFile: string;

  if (shellName === 'zsh') {
    configFile = join(home, '.zshrc');
  } else if (shellName === 'bash') {
    configFile = join(home, '.bashrc');
  } else if (shellName === 'fish') {
    configFile = join(home, '.config', 'fish', 'functions', 'gw.fish');
  } else {
    if (!quiet) {
      output.error(`Unsupported shell: ${shellName}`);
    }
    Deno.exit(1);
  }

  try {
    if (shellName === 'fish') {
      // Remove the fish function file
      await Deno.remove(configFile);
      if (!quiet) {
        output.success('Shell integration removed!');
      }
    } else {
      // Remove from bash/zsh config
      const content = await Deno.readTextFile(configFile);
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
      if (!quiet) {
        output.success('Shell integration removed!');
        console.log(`Removed from: ${output.path(configFile)}`);
      }
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      if (!quiet) {
        output.info('Shell integration not found.');
      }
    } else {
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

/**
 * Get zsh shell function
 */
function getZshFunction(): string {
  return `# gw-tools shell integration
gw() {
  if [[ "$1" == "cd" ]]; then
    # Pass through help flags directly
    if [[ "$2" == "--help" || "$2" == "-h" ]]; then
      command gw cd "$2"
      return
    fi
    local target=$(command gw cd "$2" 2>/dev/null)
    if [[ -n "$target" ]]; then
      cd "$target"
    else
      command gw cd "$2"
    fi
  elif [[ "$1" == "rm" || "$1" == "remove" ]]; then
    # Get git root before removing (in case we're removing current worktree)
    local git_root=$(command gw root 2>/dev/null)
    # Execute the remove command
    command gw "$@"
    local exit_code=$?
    # If removal succeeded and we have a git root, cd to it
    if [[ $exit_code -eq 0 && -n "$git_root" && ! -d "$PWD" ]]; then
      cd "$git_root"
    fi
    return $exit_code
  elif [[ "$1" == "add" ]]; then
    # Capture output to check for navigation marker
    local output
    output=$(command gw "$@" 2>&1)
    local exit_code=$?
    # Check if output contains navigation marker
    if [[ "$output" == *"__GW_NAVIGATE__:"* ]]; then
      local nav_path=\${output##*__GW_NAVIGATE__:}
      nav_path=\${nav_path%%$'\\n'*}
      # Print everything except the navigation marker line
      echo "$output" | grep -v "__GW_NAVIGATE__:"
      cd "$nav_path"
    else
      echo "$output"
    fi
    return $exit_code
  else
    command gw "$@"
  fi
}`;
}

/**
 * Get bash shell function
 */
function getBashFunction(): string {
  return `# gw-tools shell integration
gw() {
  if [[ "$1" == "cd" ]]; then
    # Pass through help flags directly
    if [[ "$2" == "--help" || "$2" == "-h" ]]; then
      command gw cd "$2"
      return
    fi
    local target=$(command gw cd "$2" 2>/dev/null)
    if [[ -n "$target" ]]; then
      cd "$target"
    else
      command gw cd "$2"
    fi
  elif [[ "$1" == "rm" || "$1" == "remove" ]]; then
    # Get git root before removing (in case we're removing current worktree)
    local git_root=$(command gw root 2>/dev/null)
    # Execute the remove command
    command gw "$@"
    local exit_code=$?
    # If removal succeeded and we have a git root, cd to it
    if [[ $exit_code -eq 0 && -n "$git_root" && ! -d "$PWD" ]]; then
      cd "$git_root"
    fi
    return $exit_code
  elif [[ "$1" == "add" ]]; then
    # Capture output to check for navigation marker
    local output
    output=$(command gw "$@" 2>&1)
    local exit_code=$?
    # Check if output contains navigation marker
    if [[ "$output" == *"__GW_NAVIGATE__:"* ]]; then
      local nav_path=\${output##*__GW_NAVIGATE__:}
      nav_path=\${nav_path%%$'\\n'*}
      # Print everything except the navigation marker line
      echo "$output" | grep -v "__GW_NAVIGATE__:"
      cd "$nav_path"
    else
      echo "$output"
    fi
    return $exit_code
  else
    command gw "$@"
  fi
}`;
}

/**
 * Get fish shell function
 */
function getFishFunction(): string {
  return `# gw-tools shell integration
function gw
    if test "$argv[1]" = "cd"
        # Pass through help flags directly
        if test "$argv[2]" = "--help" -o "$argv[2]" = "-h"
            command gw cd $argv[2]
            return
        end
        set -l target (command gw cd $argv[2] 2>/dev/null)
        if test -n "$target"
            cd $target
        else
            command gw cd $argv[2]
        end
    else if test "$argv[1]" = "rm" -o "$argv[1]" = "remove"
        # Get git root before removing (in case we're removing current worktree)
        set -l git_root (command gw root 2>/dev/null)
        # Execute the remove command
        command gw $argv
        set -l exit_code $status
        # If removal succeeded and we have a git root, cd to it
        if test $exit_code -eq 0 -a -n "$git_root" -a ! -d "$PWD"
            cd $git_root
        end
        return $exit_code
    else if test "$argv[1]" = "add"
        # Capture output to check for navigation marker
        set -l output (command gw $argv 2>&1)
        set -l exit_code $status
        # Check if output contains navigation marker
        if string match -q "*__GW_NAVIGATE__:*" "$output"
            set -l nav_path (string replace -r '.*__GW_NAVIGATE__:' '' "$output" | string split -n '\\n')[1]
            # Print everything except the navigation marker line
            for line in $output
                if not string match -q "*__GW_NAVIGATE__:*" "$line"
                    echo $line
                end
            end
            cd $nav_path
        else
            printf '%s\\n' $output
        end
        return $exit_code
    else
        command gw $argv
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
  --remove, -r     Remove shell integration
  --quiet, -q      Suppress output messages
  -h, --help       Show this help message

Description:
  Installs a shell function that enables 'gw cd <worktree>' to actually
  navigate to the worktree directory. Without this integration, 'gw cd'
  only outputs the path and requires using 'cd $(gw cd <worktree>)'.

  The command detects your shell (zsh, bash, or fish) and adds the
  appropriate function to your shell configuration file.

  Supported shells:
    - Zsh (~/.zshrc)
    - Bash (~/.bashrc)
    - Fish (~/.config/fish/functions/gw.fish)

  The installation is idempotent - running it multiple times won't
  create duplicate entries.

Examples:
  # Install shell integration
  gw install-shell

  # Remove shell integration
  gw install-shell --remove

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
