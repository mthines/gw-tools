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

  const completionCode = getZshCompletionFunction(commandName);

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
      if [[ -d "$nav_path" ]]; then
        cd "$nav_path"
      fi
    fi
    return $exit_code
  else
    ${cmdPrefix} "$@"
  fi
}
${completionCode}`;
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

  const completionCode = getBashCompletionFunction(commandName);

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
      if [[ -d "$nav_path" ]]; then
        cd "$nav_path"
      fi
    fi
    return $exit_code
  else
    ${cmdPrefix} "$@"
  fi
}
${completionCode}`;
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

  const completionCode = getFishCompletionFunction(commandName);

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
            if test -d "$nav_path"
                cd $nav_path
            end
        end
        return $exit_code
    else
        ${cmdPrefix} $argv
    end
end
${completionCode}`;
}

/**
 * Get zsh completion code
 */
export function getZshCompletionFunction(commandName = "gw"): string {
  // Sanitize command name for use in shell function names
  // (replace hyphens with underscores)
  const fnName = commandName.replace(/-/g, "_");

  return `
# gw-tools shell completions
__${fnName}_branches() {
  local -a branches
  branches=(\${(f)"$(git for-each-ref \\
    --format='%(refname:short)' \\
    refs/heads/ 2>/dev/null)"})
  local -a remote_branches
  remote_branches=(\${(f)"$(git for-each-ref \\
    --format='%(refname:short)' \\
    refs/remotes/origin/ 2>/dev/null \\
    | sed 's|^origin/||' \\
    | grep -v '^HEAD$')"})
  local -a all_branches
  all_branches=(\${(u)branches[@]} \${(u)remote_branches[@]})
  typeset -U all_branches
  compadd -a all_branches
}

__${fnName}_worktrees() {
  local -a worktrees
  worktrees=(\${(f)"$(git worktree list --porcelain 2>/dev/null \\
    | grep '^worktree ' \\
    | sed 's|^worktree .*/||')"})
  compadd -a worktrees
}

_${fnName}() {
  local -a subcommands
  subcommands=(
    'checkout:Create a new worktree or switch branches'
    'co:Create a new worktree (alias for checkout)'
    'add:Create a new worktree (alias for checkout)'
    'cd:Navigate to a worktree directory'
    'pr:Check out a pull request'
    'update:Update worktree from default branch'
    'sync:Sync files between worktrees'
    'init:Initialize gw configuration'
    'show-init:Generate a gw init command'
    'install-shell:Output shell integration code'
    'root:Get repository root directory'
    'clean:Remove safe worktrees'
    'list:List all worktrees'
    'ls:List all worktrees (alias)'
    'remove:Remove a worktree'
    'rm:Remove a worktree (alias)'
    'move:Move a worktree'
    'mv:Move a worktree (alias)'
    'prune:Cleanup worktrees and branches'
    'lock:Lock a worktree'
    'unlock:Unlock a worktree'
    'repair:Repair worktree admin files'
  )

  if (( CURRENT == 2 )); then
    _describe -t commands 'gw command' subcommands
    return
  fi

  local subcmd="\${words[2]}"
  case "$subcmd" in
    checkout|co|add)
      _arguments -C \\
        '(-h --help)'{-h,--help}'[Show help]' \\
        '--no-cd[Do not navigate to new worktree]' \\
        '--from[Create from specified branch]:branch:__${fnName}_branches' \\
        '--from-staged[Copy staged files to new worktree]' \\
        '-b[Create new branch]:branch:' \\
        '-B[Create or reset branch]:branch:' \\
        '--detach[Detach HEAD]' \\
        '(-f --force)'{-f,--force}'[Force checkout]' \\
        '--track[Track branch from remote]' \\
        '--guess-remote[Guess remote]' \\
        '(-q --quiet)'{-q,--quiet}'[Quiet mode]' \\
        '*:branch:__${fnName}_branches'
      ;;
    cd)
      _arguments -C \\
        '(-h --help)'{-h,--help}'[Show help]' \\
        '*:worktree:__${fnName}_worktrees'
      ;;
    sync)
      _arguments -C \\
        '(-h --help)'{-h,--help}'[Show help]' \\
        '--from[Source worktree]:worktree:__${fnName}_worktrees' \\
        '(-n --dry-run)'{-n,--dry-run}'[Preview without copying]' \\
        '*:worktree:__${fnName}_worktrees'
      ;;
    update)
      _arguments -C \\
        '(-h --help)'{-h,--help}'[Show help]' \\
        '--from[Update from branch]:branch:__${fnName}_branches' \\
        '--remote[Remote name]:remote:' \\
        '(-m --merge)'{-m,--merge}'[Use merge strategy]' \\
        '(-r --rebase)'{-r,--rebase}'[Use rebase strategy]' \\
        '(-f --force)'{-f,--force}'[Skip uncommitted changes check]' \\
        '(-n --dry-run)'{-n,--dry-run}'[Preview operation]'
      ;;
    remove|rm)
      _arguments -C \\
        '(-h --help)'{-h,--help}'[Show help]' \\
        '--preserve-branch[Keep local branch]' \\
        '(-y --yes)'{-y,--yes}'[Skip confirmation]' \\
        '(-f --force)'{-f,--force}'[Force removal]' \\
        '*:worktree:__${fnName}_worktrees'
      ;;
    move|mv)
      _arguments -C \\
        '(-h --help)'{-h,--help}'[Show help]' \\
        '*:worktree:__${fnName}_worktrees'
      ;;
    lock)
      _arguments -C \\
        '(-h --help)'{-h,--help}'[Show help]' \\
        '--reason[Reason for lock]:reason:' \\
        '*:worktree:__${fnName}_worktrees'
      ;;
    unlock)
      _arguments -C \\
        '(-h --help)'{-h,--help}'[Show help]' \\
        '*:worktree:__${fnName}_worktrees'
      ;;
    pr)
      _arguments -C \\
        '(-h --help)'{-h,--help}'[Show help]' \\
        '--name[Custom worktree name]:name:' \\
        '--no-cd[Do not navigate to new worktree]'
      ;;
    list|ls)
      _arguments -C \\
        '(-h --help)'{-h,--help}'[Show help]' \\
        '--porcelain[Machine-readable format]' \\
        '-v[Verbose output]'
      ;;
    prune)
      _arguments -C \\
        '(-h --help)'{-h,--help}'[Show help]' \\
        '--stale-only[Git metadata cleanup only]' \\
        '--no-branches[Skip branch cleanup]' \\
        '(-n --dry-run)'{-n,--dry-run}'[Preview without removing]' \\
        '(-f --force)'{-f,--force}'[Skip confirmation]' \\
        '(-v --verbose)'{-v,--verbose}'[Show detailed output]'
      ;;
    clean)
      _arguments -C \\
        '(-h --help)'{-h,--help}'[Show help]' \\
        '--use-autoclean-threshold[Age-based removal]' \\
        '(-f --force)'{-f,--force}'[Skip safety checks]' \\
        '(-n --dry-run)'{-n,--dry-run}'[Preview without removing]' \\
        '--json[Output as JSON]' \\
        '(-y --yes)'{-y,--yes}'[Skip confirmation]'
      ;;
    init)
      _arguments -C \\
        '(-h --help)'{-h,--help}'[Show help]' \\
        '(-i --interactive)'{-i,--interactive}'[Interactive mode]' \\
        '--root[Git repo root path]:path:_directories' \\
        '--default-source[Default source worktree]:branch:' \\
        '--auto-copy-files[Files to auto-copy]:files:' \\
        '--pre-checkout[Pre-checkout hook]:command:' \\
        '--post-checkout[Post-checkout hook]:command:' \\
        '--clean-threshold[Days before stale]:days:' \\
        '--auto-clean[Enable auto-cleanup]' \\
        '--update-strategy[Merge strategy]:strategy:(merge rebase)'
      ;;
    install-shell)
      _arguments -C \\
        '(-h --help)'{-h,--help}'[Show help]' \\
        '(-n --name)'{-n,--name}'[Command name]:name:' \\
        '(-c --command)'{-c,--command}'[Actual command]:command:' \\
        '(-r --remove)--remove[Remove integration]' \\
        '(-q --quiet)'{-q,--quiet}'[Suppress output]'
      ;;
    root|show-init|repair)
      _arguments -C \\
        '(-h --help)'{-h,--help}'[Show help]'
      ;;
  esac
}

compdef _${fnName} ${commandName}`;
}

/**
 * Get bash completion code
 */
export function getBashCompletionFunction(commandName = "gw"): string {
  const fnName = commandName.replace(/-/g, "_");

  return `
# gw-tools shell completions
__${fnName}_branches() {
  local branches
  branches=$(git for-each-ref \\
    --format='%(refname:short)' \\
    refs/heads/ 2>/dev/null)
  local remote_branches
  remote_branches=$(git for-each-ref \\
    --format='%(refname:short)' \\
    refs/remotes/origin/ 2>/dev/null \\
    | sed 's|^origin/||' \\
    | grep -v '^HEAD$')
  echo "$branches"$'\\n'"$remote_branches" | sort -u
}

__${fnName}_worktrees() {
  git worktree list --porcelain 2>/dev/null \\
    | grep '^worktree ' \\
    | sed 's|^worktree .*/||'
}

_${fnName}_completions() {
  local cur prev subcmd
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  subcmd="\${COMP_WORDS[1]}"

  local subcommands="checkout co add cd pr update sync init \\
show-init install-shell root clean list ls remove rm \\
move mv prune lock unlock repair"

  if [[ \${COMP_CWORD} -eq 1 ]]; then
    COMPREPLY=($(compgen -W "$subcommands" -- "$cur"))
    return
  fi

  # Complete flag values
  case "$prev" in
    --from)
      case "$subcmd" in
        checkout|co|add|update)
          COMPREPLY=($(compgen -W \\
            "$(__${fnName}_branches)" -- "$cur"))
          ;;
        sync)
          COMPREPLY=($(compgen -W \\
            "$(__${fnName}_worktrees)" -- "$cur"))
          ;;
      esac
      return
      ;;
    --update-strategy)
      COMPREPLY=($(compgen -W "merge rebase" -- "$cur"))
      return
      ;;
  esac

  # Complete flags and positional args per subcommand
  case "$subcmd" in
    checkout|co|add)
      if [[ "$cur" == -* ]]; then
        COMPREPLY=($(compgen -W "-h --help --no-cd \\
--from --from-staged -b -B --detach -f --force \\
--track --guess-remote -q --quiet" -- "$cur"))
      else
        COMPREPLY=($(compgen -W \\
          "$(__${fnName}_branches)" -- "$cur"))
      fi
      ;;
    cd)
      if [[ "$cur" == -* ]]; then
        COMPREPLY=($(compgen -W "-h --help" -- "$cur"))
      else
        COMPREPLY=($(compgen -W \\
          "$(__${fnName}_worktrees)" -- "$cur"))
      fi
      ;;
    sync)
      if [[ "$cur" == -* ]]; then
        COMPREPLY=($(compgen -W "-h --help --from \\
-n --dry-run" -- "$cur"))
      else
        COMPREPLY=($(compgen -W \\
          "$(__${fnName}_worktrees)" -- "$cur"))
      fi
      ;;
    update)
      COMPREPLY=($(compgen -W "-h --help --from \\
--remote -m --merge -r --rebase -f --force \\
-n --dry-run" -- "$cur"))
      ;;
    remove|rm)
      if [[ "$cur" == -* ]]; then
        COMPREPLY=($(compgen -W "-h --help \\
--preserve-branch -y --yes -f --force" -- "$cur"))
      else
        COMPREPLY=($(compgen -W \\
          "$(__${fnName}_worktrees)" -- "$cur"))
      fi
      ;;
    move|mv)
      if [[ "$cur" == -* ]]; then
        COMPREPLY=($(compgen -W "-h --help" -- "$cur"))
      else
        COMPREPLY=($(compgen -W \\
          "$(__${fnName}_worktrees)" -- "$cur"))
      fi
      ;;
    lock)
      if [[ "$cur" == -* ]]; then
        COMPREPLY=($(compgen -W \\
          "-h --help --reason" -- "$cur"))
      else
        COMPREPLY=($(compgen -W \\
          "$(__${fnName}_worktrees)" -- "$cur"))
      fi
      ;;
    unlock)
      if [[ "$cur" == -* ]]; then
        COMPREPLY=($(compgen -W "-h --help" -- "$cur"))
      else
        COMPREPLY=($(compgen -W \\
          "$(__${fnName}_worktrees)" -- "$cur"))
      fi
      ;;
    pr)
      COMPREPLY=($(compgen -W "-h --help \\
--name --no-cd" -- "$cur"))
      ;;
    list|ls)
      COMPREPLY=($(compgen -W \\
        "-h --help --porcelain -v" -- "$cur"))
      ;;
    prune)
      COMPREPLY=($(compgen -W "-h --help \\
--stale-only --no-branches -n --dry-run \\
-f --force -v --verbose" -- "$cur"))
      ;;
    clean)
      COMPREPLY=($(compgen -W "-h --help \\
--use-autoclean-threshold -f --force \\
-n --dry-run --json -y --yes" -- "$cur"))
      ;;
    init)
      COMPREPLY=($(compgen -W "-h --help \\
-i --interactive --root --default-source \\
--auto-copy-files --pre-checkout --post-checkout \\
--clean-threshold --auto-clean \\
--update-strategy" -- "$cur"))
      ;;
    install-shell)
      COMPREPLY=($(compgen -W "-h --help -n --name \\
-c --command --remove -q --quiet" -- "$cur"))
      ;;
    root|show-init|repair)
      COMPREPLY=($(compgen -W "-h --help" -- "$cur"))
      ;;
  esac
}

complete -F _${fnName}_completions ${commandName}`;
}

/**
 * Get fish completion code
 */
export function getFishCompletionFunction(commandName = "gw"): string {
  const fnName = commandName.replace(/-/g, "_");

  return `
# gw-tools shell completions
function __${fnName}_branches
  git for-each-ref --format='%(refname:short)' \\
    refs/heads/ 2>/dev/null
  git for-each-ref --format='%(refname:short)' \\
    refs/remotes/origin/ 2>/dev/null \\
    | string replace 'origin/' '' \\
    | string match -v 'HEAD'
end

function __${fnName}_worktrees
  git worktree list --porcelain 2>/dev/null \\
    | string match 'worktree *' \\
    | string replace -r 'worktree .*/' ''
end

function __${fnName}_needs_command
  set -l cmd (commandline -opc)
  test (count $cmd) -eq 1
end

function __${fnName}_using_command
  set -l cmd (commandline -opc)
  test (count $cmd) -ge 2
  and test "$cmd[2]" = "$argv[1]"
end

# Disable file completions by default
complete -c ${commandName} -f

# Subcommands
complete -c ${commandName} -n __${fnName}_needs_command \\
  -a checkout -d 'Create a new worktree or switch branches'
complete -c ${commandName} -n __${fnName}_needs_command \\
  -a co -d 'Create a new worktree (alias)'
complete -c ${commandName} -n __${fnName}_needs_command \\
  -a add -d 'Create a new worktree (alias)'
complete -c ${commandName} -n __${fnName}_needs_command \\
  -a cd -d 'Navigate to a worktree directory'
complete -c ${commandName} -n __${fnName}_needs_command \\
  -a pr -d 'Check out a pull request'
complete -c ${commandName} -n __${fnName}_needs_command \\
  -a update -d 'Update worktree from default branch'
complete -c ${commandName} -n __${fnName}_needs_command \\
  -a sync -d 'Sync files between worktrees'
complete -c ${commandName} -n __${fnName}_needs_command \\
  -a init -d 'Initialize gw configuration'
complete -c ${commandName} -n __${fnName}_needs_command \\
  -a show-init -d 'Generate a gw init command'
complete -c ${commandName} -n __${fnName}_needs_command \\
  -a install-shell -d 'Output shell integration code'
complete -c ${commandName} -n __${fnName}_needs_command \\
  -a root -d 'Get repository root directory'
complete -c ${commandName} -n __${fnName}_needs_command \\
  -a clean -d 'Remove safe worktrees'
complete -c ${commandName} -n __${fnName}_needs_command \\
  -a list -d 'List all worktrees'
complete -c ${commandName} -n __${fnName}_needs_command \\
  -a ls -d 'List all worktrees (alias)'
complete -c ${commandName} -n __${fnName}_needs_command \\
  -a remove -d 'Remove a worktree'
complete -c ${commandName} -n __${fnName}_needs_command \\
  -a rm -d 'Remove a worktree (alias)'
complete -c ${commandName} -n __${fnName}_needs_command \\
  -a move -d 'Move a worktree'
complete -c ${commandName} -n __${fnName}_needs_command \\
  -a mv -d 'Move a worktree (alias)'
complete -c ${commandName} -n __${fnName}_needs_command \\
  -a prune -d 'Cleanup worktrees and branches'
complete -c ${commandName} -n __${fnName}_needs_command \\
  -a lock -d 'Lock a worktree'
complete -c ${commandName} -n __${fnName}_needs_command \\
  -a unlock -d 'Unlock a worktree'
complete -c ${commandName} -n __${fnName}_needs_command \\
  -a repair -d 'Repair worktree admin files'

# checkout/co/add completions
complete -c ${commandName} \\
  -n '__${fnName}_using_command checkout; \\
or __${fnName}_using_command co; \\
or __${fnName}_using_command add' \\
  -l help -s h -d 'Show help'
complete -c ${commandName} \\
  -n '__${fnName}_using_command checkout; \\
or __${fnName}_using_command co; \\
or __${fnName}_using_command add' \\
  -l no-cd -d 'Do not navigate to new worktree'
complete -c ${commandName} \\
  -n '__${fnName}_using_command checkout; \\
or __${fnName}_using_command co; \\
or __${fnName}_using_command add' \\
  -l from -r -a '(__${fnName}_branches)' \\
  -d 'Create from branch'
complete -c ${commandName} \\
  -n '__${fnName}_using_command checkout; \\
or __${fnName}_using_command co; \\
or __${fnName}_using_command add' \\
  -l from-staged -d 'Copy staged files'
complete -c ${commandName} \\
  -n '__${fnName}_using_command checkout; \\
or __${fnName}_using_command co; \\
or __${fnName}_using_command add' \\
  -l force -s f -d 'Force checkout'
complete -c ${commandName} \\
  -n '__${fnName}_using_command checkout; \\
or __${fnName}_using_command co; \\
or __${fnName}_using_command add' \\
  -l quiet -s q -d 'Quiet mode'
complete -c ${commandName} \\
  -n '__${fnName}_using_command checkout; \\
or __${fnName}_using_command co; \\
or __${fnName}_using_command add' \\
  -l detach -d 'Detach HEAD'
complete -c ${commandName} \\
  -n '__${fnName}_using_command checkout; \\
or __${fnName}_using_command co; \\
or __${fnName}_using_command add' \\
  -l track -d 'Track branch from remote'
complete -c ${commandName} \\
  -n '__${fnName}_using_command checkout; \\
or __${fnName}_using_command co; \\
or __${fnName}_using_command add' \\
  -l guess-remote -d 'Guess remote'
complete -c ${commandName} \\
  -n '__${fnName}_using_command checkout; \\
or __${fnName}_using_command co; \\
or __${fnName}_using_command add' \\
  -a '(__${fnName}_branches)' -d 'Branch'

# cd completions
complete -c ${commandName} \\
  -n '__${fnName}_using_command cd' \\
  -l help -s h -d 'Show help'
complete -c ${commandName} \\
  -n '__${fnName}_using_command cd' \\
  -a '(__${fnName}_worktrees)' -d 'Worktree'

# sync completions
complete -c ${commandName} \\
  -n '__${fnName}_using_command sync' \\
  -l help -s h -d 'Show help'
complete -c ${commandName} \\
  -n '__${fnName}_using_command sync' \\
  -l from -r -a '(__${fnName}_worktrees)' \\
  -d 'Source worktree'
complete -c ${commandName} \\
  -n '__${fnName}_using_command sync' \\
  -l dry-run -s n -d 'Preview without copying'
complete -c ${commandName} \\
  -n '__${fnName}_using_command sync' \\
  -a '(__${fnName}_worktrees)' -d 'Worktree'

# update completions
complete -c ${commandName} \\
  -n '__${fnName}_using_command update' \\
  -l help -s h -d 'Show help'
complete -c ${commandName} \\
  -n '__${fnName}_using_command update' \\
  -l from -r -a '(__${fnName}_branches)' \\
  -d 'Update from branch'
complete -c ${commandName} \\
  -n '__${fnName}_using_command update' \\
  -l remote -r -d 'Remote name'
complete -c ${commandName} \\
  -n '__${fnName}_using_command update' \\
  -l merge -s m -d 'Use merge strategy'
complete -c ${commandName} \\
  -n '__${fnName}_using_command update' \\
  -l rebase -s r -d 'Use rebase strategy'
complete -c ${commandName} \\
  -n '__${fnName}_using_command update' \\
  -l force -s f -d 'Skip uncommitted changes check'
complete -c ${commandName} \\
  -n '__${fnName}_using_command update' \\
  -l dry-run -s n -d 'Preview operation'

# remove/rm completions
complete -c ${commandName} \\
  -n '__${fnName}_using_command remove; \\
or __${fnName}_using_command rm' \\
  -l help -s h -d 'Show help'
complete -c ${commandName} \\
  -n '__${fnName}_using_command remove; \\
or __${fnName}_using_command rm' \\
  -l preserve-branch -d 'Keep local branch'
complete -c ${commandName} \\
  -n '__${fnName}_using_command remove; \\
or __${fnName}_using_command rm' \\
  -l yes -s y -d 'Skip confirmation'
complete -c ${commandName} \\
  -n '__${fnName}_using_command remove; \\
or __${fnName}_using_command rm' \\
  -l force -s f -d 'Force removal'
complete -c ${commandName} \\
  -n '__${fnName}_using_command remove; \\
or __${fnName}_using_command rm' \\
  -a '(__${fnName}_worktrees)' -d 'Worktree'

# move/mv completions
complete -c ${commandName} \\
  -n '__${fnName}_using_command move; \\
or __${fnName}_using_command mv' \\
  -l help -s h -d 'Show help'
complete -c ${commandName} \\
  -n '__${fnName}_using_command move; \\
or __${fnName}_using_command mv' \\
  -a '(__${fnName}_worktrees)' -d 'Worktree'

# lock completions
complete -c ${commandName} \\
  -n '__${fnName}_using_command lock' \\
  -l help -s h -d 'Show help'
complete -c ${commandName} \\
  -n '__${fnName}_using_command lock' \\
  -l reason -r -d 'Reason for lock'
complete -c ${commandName} \\
  -n '__${fnName}_using_command lock' \\
  -a '(__${fnName}_worktrees)' -d 'Worktree'

# unlock completions
complete -c ${commandName} \\
  -n '__${fnName}_using_command unlock' \\
  -l help -s h -d 'Show help'
complete -c ${commandName} \\
  -n '__${fnName}_using_command unlock' \\
  -a '(__${fnName}_worktrees)' -d 'Worktree'

# pr completions
complete -c ${commandName} \\
  -n '__${fnName}_using_command pr' \\
  -l help -s h -d 'Show help'
complete -c ${commandName} \\
  -n '__${fnName}_using_command pr' \\
  -l name -r -d 'Custom worktree name'
complete -c ${commandName} \\
  -n '__${fnName}_using_command pr' \\
  -l no-cd -d 'Do not navigate'

# list/ls completions
complete -c ${commandName} \\
  -n '__${fnName}_using_command list; \\
or __${fnName}_using_command ls' \\
  -l help -s h -d 'Show help'
complete -c ${commandName} \\
  -n '__${fnName}_using_command list; \\
or __${fnName}_using_command ls' \\
  -l porcelain -d 'Machine-readable format'
complete -c ${commandName} \\
  -n '__${fnName}_using_command list; \\
or __${fnName}_using_command ls' \\
  -s v -d 'Verbose output'

# prune completions
complete -c ${commandName} \\
  -n '__${fnName}_using_command prune' \\
  -l help -s h -d 'Show help'
complete -c ${commandName} \\
  -n '__${fnName}_using_command prune' \\
  -l stale-only -d 'Git metadata cleanup only'
complete -c ${commandName} \\
  -n '__${fnName}_using_command prune' \\
  -l no-branches -d 'Skip branch cleanup'
complete -c ${commandName} \\
  -n '__${fnName}_using_command prune' \\
  -l dry-run -s n -d 'Preview without removing'
complete -c ${commandName} \\
  -n '__${fnName}_using_command prune' \\
  -l force -s f -d 'Skip confirmation'
complete -c ${commandName} \\
  -n '__${fnName}_using_command prune' \\
  -l verbose -s v -d 'Show detailed output'

# clean completions
complete -c ${commandName} \\
  -n '__${fnName}_using_command clean' \\
  -l help -s h -d 'Show help'
complete -c ${commandName} \\
  -n '__${fnName}_using_command clean' \\
  -l use-autoclean-threshold -d 'Age-based removal'
complete -c ${commandName} \\
  -n '__${fnName}_using_command clean' \\
  -l force -s f -d 'Skip safety checks'
complete -c ${commandName} \\
  -n '__${fnName}_using_command clean' \\
  -l dry-run -s n -d 'Preview without removing'
complete -c ${commandName} \\
  -n '__${fnName}_using_command clean' \\
  -l json -d 'Output as JSON'
complete -c ${commandName} \\
  -n '__${fnName}_using_command clean' \\
  -l yes -s y -d 'Skip confirmation'

# init completions
complete -c ${commandName} \\
  -n '__${fnName}_using_command init' \\
  -l help -s h -d 'Show help'
complete -c ${commandName} \\
  -n '__${fnName}_using_command init' \\
  -l interactive -s i -d 'Interactive mode'
complete -c ${commandName} \\
  -n '__${fnName}_using_command init' \\
  -l root -r -d 'Git repo root path'
complete -c ${commandName} \\
  -n '__${fnName}_using_command init' \\
  -l default-source -r -d 'Default source worktree'
complete -c ${commandName} \\
  -n '__${fnName}_using_command init' \\
  -l auto-copy-files -r -d 'Files to auto-copy'
complete -c ${commandName} \\
  -n '__${fnName}_using_command init' \\
  -l pre-checkout -r -d 'Pre-checkout hook'
complete -c ${commandName} \\
  -n '__${fnName}_using_command init' \\
  -l post-checkout -r -d 'Post-checkout hook'
complete -c ${commandName} \\
  -n '__${fnName}_using_command init' \\
  -l clean-threshold -r -d 'Days before stale'
complete -c ${commandName} \\
  -n '__${fnName}_using_command init' \\
  -l auto-clean -d 'Enable auto-cleanup'
complete -c ${commandName} \\
  -n '__${fnName}_using_command init' \\
  -l update-strategy -r -a 'merge rebase' \\
  -d 'Default merge strategy'

# install-shell completions
complete -c ${commandName} \\
  -n '__${fnName}_using_command install-shell' \\
  -l help -s h -d 'Show help'
complete -c ${commandName} \\
  -n '__${fnName}_using_command install-shell' \\
  -l name -s n -r -d 'Command name'
complete -c ${commandName} \\
  -n '__${fnName}_using_command install-shell' \\
  -l command -s c -r -d 'Actual command'
complete -c ${commandName} \\
  -n '__${fnName}_using_command install-shell' \\
  -l remove -d 'Remove integration'
complete -c ${commandName} \\
  -n '__${fnName}_using_command install-shell' \\
  -l quiet -s q -d 'Suppress output'

# root/show-init/repair completions
complete -c ${commandName} \\
  -n '__${fnName}_using_command root; \\
or __${fnName}_using_command show-init; \\
or __${fnName}_using_command repair' \\
  -l help -s h -d 'Show help'`;
}

/**
 * Display help text for the install-shell command
 */
function showInstallShellHelp(): void {
  console.log(`
gw install-shell - Output shell integration and completions for gw

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
  navigate to the worktree directory, provides real-time streaming output for
  commands like 'gw checkout', and registers TAB completions for subcommands,
  branch names, worktree names, and flags.

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
