/**
 * Init command implementation
 * Initializes the gw configuration for a repository
 */

import { join, resolve } from '@std/path';
import { ensureConfigDir, ensureSchemaInConfig, resolveConfigPaths, saveConfigTemplate } from '../lib/config.ts';
import { findGitRoot, getWorktreeRoot, pathExists, validatePathExists } from '../lib/path-resolver.ts';
import type { Config } from '../lib/types.ts';
import * as output from '../lib/output.ts';
import { showLogo } from '../lib/cli.ts';
import { signalNavigation } from '../lib/shell-navigation.ts';
import { isShellIntegrationInstalled } from '../lib/shell-integration.ts';

/**
 * Parsed init command arguments
 */
interface ParsedInitArgs {
  help: boolean;
  interactive: boolean;
  root?: string;
  defaultBranch?: string;
  autoCopyFiles?: string[];
  preCheckoutHooks?: string[];
  postCheckoutHooks?: string[];
  cleanThreshold?: number;
  autoClean?: boolean;
  updateStrategy?: 'merge' | 'rebase';
  repoUrl?: string;
  targetDirectory?: string;
}

/**
 * Parse init command arguments
 */
function parseInitArgs(args: string[]): ParsedInitArgs {
  const result: ParsedInitArgs = {
    help: false,
    interactive: false,
  };

  const positionalArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--interactive' || arg === '-i') {
      result.interactive = true;
    } else if (arg === '--root' && i + 1 < args.length) {
      result.root = args[++i];
    } else if (arg === '--default-source' && i + 1 < args.length) {
      result.defaultBranch = args[++i];
    } else if (arg === '--auto-copy-files' && i + 1 < args.length) {
      // Split comma-separated list
      const filesArg = args[++i];
      result.autoCopyFiles = filesArg.split(',').map((f) => f.trim());
    } else if ((arg === '--pre-checkout' || arg === '--pre-add') && i + 1 < args.length) {
      // Add to pre-checkout hooks array (can be specified multiple times)
      // --pre-add is kept for backwards compatibility
      if (!result.preCheckoutHooks) result.preCheckoutHooks = [];
      result.preCheckoutHooks.push(args[++i]);
    } else if ((arg === '--post-checkout' || arg === '--post-add') && i + 1 < args.length) {
      // Add to post-checkout hooks array (can be specified multiple times)
      // --post-add is kept for backwards compatibility
      if (!result.postCheckoutHooks) result.postCheckoutHooks = [];
      result.postCheckoutHooks.push(args[++i]);
    } else if (arg === '--clean-threshold' && i + 1 < args.length) {
      const value = parseInt(args[++i], 10);
      if (!isNaN(value) && value >= 0) {
        result.cleanThreshold = value;
      } else {
        throw new Error('--clean-threshold must be a non-negative number');
      }
    } else if (arg === '--auto-clean') {
      result.autoClean = true;
    } else if (arg === '--update-strategy' && i + 1 < args.length) {
      const strategy = args[++i];
      if (strategy === 'merge' || strategy === 'rebase') {
        result.updateStrategy = strategy;
      } else {
        throw new Error("--update-strategy must be either 'merge' or 'rebase'");
      }
    } else if (!arg.startsWith('-')) {
      // Collect positional args (non-flags)
      positionalArgs.push(arg);
    }
  }

  // Parse positional args
  if (positionalArgs.length > 0) {
    const first = positionalArgs[0];
    // Check if looks like git URL (including file:// for testing)
    if (
      first.startsWith('git@') ||
      first.startsWith('https://') ||
      first.startsWith('http://') ||
      first.startsWith('file://')
    ) {
      result.repoUrl = first;
      if (positionalArgs.length > 1) {
        result.targetDirectory = positionalArgs[1];
      }
    }
  }

  return result;
}

/**
 * Extract repository name from URL path
 */
function extractRepoName(path: string): string {
  // Extract last segment, keep .git suffix for bare repos
  // "user/repo.git" -> "repo.git"
  // "user/repo" -> "repo.git"
  const parts = path.split('/');
  const lastPart = parts[parts.length - 1];

  // If it already has .git suffix, keep it
  if (lastPart.endsWith('.git')) {
    return lastPart;
  }

  // Otherwise, add .git suffix for bare repository convention
  return `${lastPart}.git`;
}

/**
 * Parse git URL to extract repository name
 */
function parseGitUrl(url: string): { repoName: string } {
  // Handle SSH: git@github.com:user/repo.git
  if (url.startsWith('git@')) {
    const match = url.match(/git@[^:]+:(.+)/);
    if (!match) {
      throw new Error('Invalid SSH URL format');
    }
    return { repoName: extractRepoName(match[1]) };
  }

  // Handle HTTPS: https://github.com/user/repo.git
  try {
    const parsed = new URL(url);
    return { repoName: extractRepoName(parsed.pathname.slice(1)) };
  } catch {
    throw new Error('Invalid git URL format');
  }
}

/**
 * Clone a git repository with --no-checkout
 */
async function cloneRepository(url: string, targetDir: string): Promise<void> {
  const cmd = new Deno.Command('git', {
    args: ['clone', '--no-checkout', url, targetDir],
    stdout: 'inherit',
    stderr: 'inherit',
  });

  const { code } = await cmd.output();
  if (code !== 0) {
    throw new Error(`Failed to clone repository from ${url}`);
  }
}

/**
 * Create gw_root branch in repository
 */
async function createGwRootBranch(repoPath: string): Promise<void> {
  const cmd = new Deno.Command('git', {
    args: ['-C', repoPath, 'switch', '-c', 'gw_root'],
    stdout: 'inherit',
    stderr: 'inherit',
  });

  const { code } = await cmd.output();
  if (code !== 0) {
    throw new Error('Failed to create gw_root branch');
  }
}

/**
 * Check if a repository is empty (has no commits)
 */
async function isRepoEmpty(repoPath: string): Promise<boolean> {
  const cmd = new Deno.Command('git', {
    args: ['-C', repoPath, 'rev-parse', 'HEAD'],
    stdout: 'piped',
    stderr: 'piped',
  });

  const { code } = await cmd.output();
  return code !== 0;
}

/**
 * Create an initial empty commit on the current branch
 * Needed for empty repos so that worktrees can be created
 */
async function createInitialCommit(repoPath: string): Promise<void> {
  const cmd = new Deno.Command('git', {
    args: ['-C', repoPath, 'commit', '--allow-empty', '-m', 'Initial commit (gw)'],
    stdout: 'piped',
    stderr: 'piped',
  });

  const { code } = await cmd.output();
  if (code !== 0) {
    throw new Error('Failed to create initial commit');
  }
}

/**
 * Create default worktree directly from gw_root
 * Used for empty repos where the default branch doesn't exist yet
 */
async function createWorktreeFromRoot(repoPath: string, branchName: string, worktreePath: string): Promise<boolean> {
  const cmd = new Deno.Command('git', {
    args: ['-C', repoPath, 'worktree', 'add', '-b', branchName, worktreePath, 'gw_root'],
    stdout: 'inherit',
    stderr: 'inherit',
  });

  const { code } = await cmd.output();
  return code === 0;
}

/**
 * Detect the default branch from remote
 */
async function detectDefaultBranch(repoPath: string): Promise<string> {
  // Try to get remote HEAD
  const cmd = new Deno.Command('git', {
    args: ['-C', repoPath, 'symbolic-ref', 'refs/remotes/origin/HEAD', '--short'],
    stdout: 'piped',
    stderr: 'piped',
  });

  const { code, stdout } = await cmd.output();

  if (code === 0) {
    const fullRef = new TextDecoder().decode(stdout).trim();
    // "origin/main" -> "main"
    return fullRef.replace('origin/', '');
  }

  // Fallback: try common names
  for (const branch of ['main', 'master', 'develop']) {
    const checkCmd = new Deno.Command('git', {
      args: ['-C', repoPath, 'show-ref', '--verify', `refs/remotes/origin/${branch}`],
      stdout: 'piped',
      stderr: 'piped',
    });
    const { code: checkCode } = await checkCmd.output();
    if (checkCode === 0) {
      return branch;
    }
  }

  // Final fallback
  return 'main';
}

/**
 * Check if gw is already initialized in current or parent directories.
 * Detects whether the config is in the worktree (committable) or only
 * at the bare repo root (needs migration).
 */
async function isAlreadyInitialized(): Promise<{
  initialized: boolean;
  configDir?: string;
  needsMigration?: boolean;
}> {
  try {
    const worktreeRoot = await getWorktreeRoot();
    const gitRoot = await findGitRoot();
    const worktreeConfig = join(worktreeRoot, '.gw', 'config.json');
    const bareRootConfig = join(gitRoot, '.gw', 'config.json');

    // Config in worktree — already committable
    if (await pathExists(worktreeConfig)) {
      return { initialized: true, configDir: worktreeRoot };
    }
    // Config at bare root only — needs migration to worktree
    if (await pathExists(bareRootConfig)) {
      return {
        initialized: true,
        configDir: gitRoot,
        needsMigration: worktreeRoot !== gitRoot,
      };
    }
    return { initialized: false };
  } catch {
    return { initialized: false };
  }
}

/**
 * Prompt for configuration in interactive mode
 */
function promptForConfig(): {
  defaultBranch?: string;
  autoCopyFiles?: string[];
  preCheckoutHooks?: string[];
  postCheckoutHooks?: string[];
  cleanThreshold?: number;
  autoClean?: boolean;
  updateStrategy?: 'merge' | 'rebase';
} {
  console.log();
  console.log();
  showLogo();

  console.log('\n' + output.bold('Interactive Configuration') + '\n');
  console.log(output.dim('Press Enter to accept defaults. Leave blank to skip optional settings.\n'));

  const config: {
    defaultBranch?: string;
    autoCopyFiles?: string[];
    preCheckoutHooks?: string[];
    postCheckoutHooks?: string[];
    cleanThreshold?: number;
    autoClean?: boolean;
    updateStrategy?: 'merge' | 'rebase';
  } = {};

  // Default branch
  const defaultBranchInput = prompt(`Default source worktree name [${output.dim('main')}]: `);
  if (defaultBranchInput && defaultBranchInput.trim()) {
    config.defaultBranch = defaultBranchInput.trim();
  }

  // Auto-copy files
  console.log();
  const wantAutoCopy = prompt(`Do you want to auto-copy files when creating worktrees? (y/n) [${output.dim('n')}]: `);
  if (wantAutoCopy?.toLowerCase() === 'y' || wantAutoCopy?.toLowerCase() === 'yes') {
    console.log(output.dim('  Enter comma-separated file/directory paths (e.g., .env,secrets/)'));
    const autoCopyInput = prompt('  Files to auto-copy: ');
    if (autoCopyInput && autoCopyInput.trim()) {
      config.autoCopyFiles = autoCopyInput
        .split(',')
        .map((f) => f.trim())
        .filter((f) => f);
    }
  }

  // Pre-checkout hooks
  console.log();
  const wantPreHooks = prompt(`Do you want to add pre-checkout hooks? (y/n) [${output.dim('n')}]: `);
  if (wantPreHooks?.toLowerCase() === 'y' || wantPreHooks?.toLowerCase() === 'yes') {
    console.log(output.dim('  Enter commands to run before creating worktrees'));
    console.log(output.dim('  Variables: {worktree}, {worktreePath}, {gitRoot}, {branch}'));
    const preHooks: string[] = [];
    let hookNum = 1;
    while (true) {
      const hookInput = prompt(`  Pre-checkout hook ${hookNum} (leave blank to finish): `);
      if (!hookInput || !hookInput.trim()) break;
      preHooks.push(hookInput.trim());
      hookNum++;
    }
    if (preHooks.length > 0) {
      config.preCheckoutHooks = preHooks;
    }
  }

  // Post-checkout hooks
  console.log();
  const wantPostHooks = prompt(`Do you want to add post-checkout hooks? (y/n) [${output.dim('n')}]: `);
  if (wantPostHooks?.toLowerCase() === 'y' || wantPostHooks?.toLowerCase() === 'yes') {
    console.log(output.dim('  Enter commands to run after creating worktrees'));
    console.log(output.dim('  Variables: {worktree}, {worktreePath}, {gitRoot}, {branch}'));
    const postHooks: string[] = [];
    let hookNum = 1;
    while (true) {
      const hookInput = prompt(`  Post-checkout hook ${hookNum} (leave blank to finish): `);
      if (!hookInput || !hookInput.trim()) break;
      postHooks.push(hookInput.trim());
      hookNum++;
    }
    if (postHooks.length > 0) {
      config.postCheckoutHooks = postHooks;
    }
  }

  // Clean threshold
  console.log();
  const cleanThresholdInput = prompt(`Days before worktrees are considered stale [${output.dim('7')}]:`);
  if (cleanThresholdInput && cleanThresholdInput.trim()) {
    const value = parseInt(cleanThresholdInput.trim(), 10);
    if (!isNaN(value) && value >= 0) {
      config.cleanThreshold = value;
    } else {
      console.log(output.warning('  Invalid value, using default (7 days)'));
    }
  }

  // Auto-clean
  console.log();
  const autoCleanInput = prompt(`Want to automatically cleanup stale worktrees? (y/n) [${output.dim('n')}]:`);
  if (autoCleanInput?.toLowerCase() === 'y' || autoCleanInput?.toLowerCase() === 'yes') {
    config.autoClean = true;
  }

  // Update strategy
  console.log();
  const updateStrategyInput = prompt(`Default update strategy (merge/rebase) [${output.dim('merge')}]:`);
  if (updateStrategyInput && updateStrategyInput.trim()) {
    const strategy = updateStrategyInput.trim().toLowerCase();
    if (strategy === 'merge' || strategy === 'rebase') {
      config.updateStrategy = strategy;
    } else {
      console.log(output.warning('  Invalid value, using default (merge)'));
    }
  }

  console.log();
  return config;
}

/**
 * Show help for the init command
 */
function showInitHelp(): void {
  console.log(`Usage: gw init [repository-url] [directory] [options]

Initialize gw configuration for a git repository.

Can be used in two modes:
  1. Clone mode: Clone a repository and set up gw configuration
  2. Existing repo mode: Initialize gw in an existing repository

Options:
  -i, --interactive               Interactively prompt for configuration options
  --root <path>                   Specify the git repository root path (optional, auto-detects if not provided)
  --default-source <name>         Set the default source worktree (default: "main")
  --auto-copy-files <files>       Comma-separated list of files to auto-copy
                                  when creating new worktrees with 'gw checkout'
  --pre-checkout <command>        Command to run before 'gw checkout' creates a worktree
                                  (can be specified multiple times for multiple hooks)
  --post-checkout <command>       Command to run after 'gw checkout' creates a worktree
                                  (can be specified multiple times for multiple hooks)
  --clean-threshold <days>        Number of days before worktrees are considered
                                  stale for 'gw clean' (default: 7)
  --auto-clean                    Silently cleanup stale worktrees in background (after checkout/list, non-blocking)
  --update-strategy <strategy>    Set default update strategy: 'merge' or 'rebase'
                                  (default: merge)
  -h, --help                      Show this help message

Hook Variables:
  Hooks support variable substitution:
    {worktree}      - The worktree name (e.g., "feat/new-feature")
    {worktreePath}  - Full absolute path to the worktree
    {gitRoot}       - The git repository root path
    {branch}        - The branch name

Clone Examples:
  # Clone and initialize (creates repo.git/ directory, auto-navigates to it)
  gw init git@github.com:user/repo.git

  # Clone into specific directory
  gw init git@github.com:user/repo.git my-project

  # Clone with HTTPS
  gw init https://github.com/user/repo.git

  # Clone and configure interactively (prompts for URL if not in git repo)
  gw init git@github.com:user/repo.git --interactive

  Note: Cloned repos use .git suffix (bare repo convention) and automatically
        navigate to the repo directory (requires shell integration)

Existing Repository Examples:
  # Initialize and commit config to share with your team
  gw init --auto-copy-files .env --post-checkout "pnpm install"
  git add .gw/config.json && git commit -m "chore: share gw config"

  # Migrate existing config to worktree (makes it committable)
  # Just re-run gw init — it detects the old config and copies it
  gw init

  # Interactive mode - prompts for all configuration options
  gw init --interactive

  # Initialize with auto-detected root and auto-copy files
  gw init --auto-copy-files .env,secrets/

  # Initialize with custom default source (auto-detects root)
  gw init --default-source master

  # Initialize with post-checkout hook to install dependencies
  gw init --post-checkout "cd {worktreePath} && pnpm install"

  # Initialize with pre-checkout validation hook
  gw init --pre-checkout "echo 'Creating worktree: {worktree}'"

  # Initialize with multiple hooks
  gw init --pre-checkout "echo 'Starting...'" --post-checkout "cd {worktreePath} && pnpm install" --post-checkout "echo 'Done!'"

  # Initialize with explicit repository root
  gw init --root /Users/username/Workspace/repo.git

  # Initialize with update strategy
  gw init --update-strategy rebase

  # Initialize with all options
  gw init --root /Users/username/Workspace/repo.git --default-source master --auto-copy-files .env,secrets/ --post-checkout "cd {worktreePath} && pnpm install" --update-strategy merge

  # Interactive mode with explicit root
  gw init --interactive --root /Users/username/Workspace/repo.git

  # Show help
  gw init --help
`);
}

/**
 * Build config from parsed arguments
 */
function buildConfigFromArgs(parsed: ParsedInitArgs): Partial<Config> {
  const config: Partial<Config> = {
    defaultBranch: parsed.defaultBranch || 'main',
    cleanThreshold: 7,
  };

  // Add autoCopyFiles if provided
  if (parsed.autoCopyFiles && parsed.autoCopyFiles.length > 0) {
    config.autoCopyFiles = parsed.autoCopyFiles;
  }

  // Add hooks if provided
  if (parsed.preCheckoutHooks || parsed.postCheckoutHooks) {
    config.hooks = {
      checkout: {},
    };
    if (parsed.preCheckoutHooks && parsed.preCheckoutHooks.length > 0) {
      config.hooks.checkout!.pre = parsed.preCheckoutHooks;
    }
    if (parsed.postCheckoutHooks && parsed.postCheckoutHooks.length > 0) {
      config.hooks.checkout!.post = parsed.postCheckoutHooks;
    }
  }

  // Add cleanThreshold if provided
  if (parsed.cleanThreshold !== undefined) {
    config.cleanThreshold = parsed.cleanThreshold;
  }

  // Add autoClean if provided
  if (parsed.autoClean !== undefined) {
    config.autoClean = parsed.autoClean;
  }

  // Add updateStrategy if provided
  if (parsed.updateStrategy) {
    config.updateStrategy = parsed.updateStrategy;
  }

  return config;
}

/**
 * Initialize from a cloned repository
 */
async function initializeFromClone(parsed: ParsedInitArgs): Promise<void> {
  const repoUrl = parsed.repoUrl!;

  // Determine target directory
  let targetDir: string;
  if (parsed.targetDirectory) {
    targetDir = parsed.targetDirectory;
  } else {
    const { repoName } = parseGitUrl(repoUrl);
    targetDir = repoName;
  }

  const fullPath = resolve(targetDir);

  // Check if directory already exists
  if (await pathExists(fullPath)) {
    output.error(`Directory already exists: ${output.path(fullPath)}`);
    Deno.exit(1);
  }

  try {
    // Step 1: Clone
    output.info(`Cloning repository from ${repoUrl}...`);
    await cloneRepository(repoUrl, targetDir);
    output.success(`Repository cloned to ${output.path(targetDir)}`);

    // Step 2: Create gw_root branch
    console.log('\nSetting up gw_root branch...');
    await createGwRootBranch(fullPath);
    output.success('Created gw_root branch');

    // Step 3: Build and save config
    console.log('\nInitializing gw configuration...');

    // Get configuration from interactive prompts or parsed args
    if (parsed.interactive) {
      const interactiveConfig = promptForConfig();

      // Merge interactive config into parsed (interactive values take precedence unless parsed has values)
      if (interactiveConfig.defaultBranch && !parsed.defaultBranch) {
        parsed.defaultBranch = interactiveConfig.defaultBranch;
      }
      if (interactiveConfig.autoCopyFiles && !parsed.autoCopyFiles) {
        parsed.autoCopyFiles = interactiveConfig.autoCopyFiles;
      }
      if (interactiveConfig.preCheckoutHooks && !parsed.preCheckoutHooks) {
        parsed.preCheckoutHooks = interactiveConfig.preCheckoutHooks;
      }
      if (interactiveConfig.postCheckoutHooks && !parsed.postCheckoutHooks) {
        parsed.postCheckoutHooks = interactiveConfig.postCheckoutHooks;
      }
      if (interactiveConfig.cleanThreshold !== undefined && parsed.cleanThreshold === undefined) {
        parsed.cleanThreshold = interactiveConfig.cleanThreshold;
      }
      if (interactiveConfig.autoClean !== undefined && parsed.autoClean === undefined) {
        parsed.autoClean = interactiveConfig.autoClean;
      }
      if (interactiveConfig.updateStrategy && !parsed.updateStrategy) {
        parsed.updateStrategy = interactiveConfig.updateStrategy;
      }
    }

    // Build config from parsed args (this handles the hook structure conversion)
    const config = buildConfigFromArgs(parsed);

    // Detect default branch from remote
    const detectedBranch = await detectDefaultBranch(fullPath);
    if (!parsed.defaultBranch) {
      config.defaultBranch = detectedBranch;
    }

    // Save config temporarily at bare root (worktree doesn't exist yet)
    await saveConfigTemplate(fullPath, config as Config);

    // Step 4: Create default worktree
    const defaultBranch = config.defaultBranch || detectedBranch;
    console.log(`\nCreating ${defaultBranch} worktree...`);

    // Check if the repo is empty (no commits yet)
    const emptyRepo = await isRepoEmpty(fullPath);

    if (emptyRepo) {
      // Empty repo: create an initial commit on gw_root so we
      // have a base to branch from, then create the worktree
      // directly instead of going through `gw add`
      output.info('Empty repository detected, creating initial commit...');
      await createInitialCommit(fullPath);

      const worktreePath = join(fullPath, defaultBranch);
      const success = await createWorktreeFromRoot(fullPath, defaultBranch, worktreePath);

      if (!success) {
        output.warning('Failed to create default worktree automatically');
        output.info(`You can create it manually with: cd ${targetDir} && gw add ${defaultBranch}`);
      } else {
        output.success(`Created ${defaultBranch} worktree`);
      }
    } else {
      // Non-empty repo: use gw add as normal
      // Detect if we're running from a compiled binary or in development
      const execPath = Deno.execPath();
      const isCompiled = !execPath.endsWith('/deno') && !execPath.endsWith('\\deno.exe');

      let addCmd: Deno.Command;
      if (isCompiled) {
        addCmd = new Deno.Command('gw', {
          args: ['add', defaultBranch],
          cwd: fullPath,
          stdout: 'inherit',
          stderr: 'inherit',
        });
      } else {
        const gwPath = new URL(import.meta.url).pathname;
        const mainPath = resolve(gwPath, '../../main.ts');
        addCmd = new Deno.Command('deno', {
          args: ['run', '--allow-all', mainPath, 'add', defaultBranch],
          cwd: fullPath,
          stdout: 'inherit',
          stderr: 'inherit',
        });
      }

      const { code } = await addCmd.output();
      if (code !== 0) {
        output.warning('Failed to create default worktree automatically');
        output.info(`You can create it manually with: cd ${targetDir} && gw add ${defaultBranch}`);
      } else {
        output.success(`Created ${defaultBranch} worktree`);
      }
    }

    // Move config from bare root into the worktree (committable)
    const worktreePath = join(fullPath, defaultBranch);
    const bareConfigDir = join(fullPath, '.gw');
    const worktreeConfigDir = join(worktreePath, '.gw');
    try {
      await Deno.mkdir(worktreeConfigDir, { recursive: true });
      // Copy config and gitignore to worktree
      for (const fileName of ['config.json', '.gitignore']) {
        const src = join(bareConfigDir, fileName);
        const dst = join(worktreeConfigDir, fileName);
        try {
          await Deno.copyFile(src, dst);
        } catch {
          // .gitignore might not exist yet, that's fine
        }
      }
      // Remove the bare root config (worktree copy is the source of truth)
      try {
        await Deno.remove(join(bareConfigDir, 'config.json'));
      } catch {
        // best effort
      }
      output.success('Configuration created (committable)');
    } catch {
      // If move fails, config stays at bare root — still works
      output.success('Configuration created');
    }

    // Success summary
    console.log('\n' + output.checkmark() + ' Repository initialized successfully!\n');
    console.log(`  Repository: ${output.path(fullPath)}`);
    console.log(`  Config: ${output.path(join(worktreePath, '.gw/config.json'))}`);
    console.log(`  Default worktree: ${output.bold(defaultBranch)}`);
    console.log(`\n  Commit config: ${output.bold(`cd ${defaultBranch} && git add .gw/config.json`)}`);
    console.log();

    // Check for shell integration and offer to install if not present
    const hasShellIntegration = await isShellIntegrationInstalled();
    if (!hasShellIntegration) {
      console.log(output.dim('Shell integration is not installed.'));
      console.log(output.dim('This enables automatic navigation with "gw cd" and "gw init".\n'));

      const response = prompt('Would you like to set up shell integration? (Y/n): ');

      // Default to yes if user just presses Enter
      const shouldInstall =
        !response || response.trim() === '' || response.toLowerCase() === 'y' || response.toLowerCase() === 'yes';

      if (shouldInstall && response?.toLowerCase() !== 'n' && response?.toLowerCase() !== 'no') {
        console.log();
        try {
          const shellEnv = Deno.env.get('SHELL') || '';
          const detectedShell = shellEnv.split('/').pop() || '';
          const homeDir = Deno.env.get('HOME') || '';

          let shellConfigFile: string;
          let evalLine: string;

          if (detectedShell === 'zsh') {
            shellConfigFile = join(homeDir, '.zshrc');
            evalLine = 'eval "$(gw install-shell)"';
          } else if (detectedShell === 'bash') {
            shellConfigFile = join(homeDir, '.bashrc');
            evalLine = 'eval "$(gw install-shell)"';
          } else if (detectedShell === 'fish') {
            shellConfigFile = join(homeDir, '.config', 'fish', 'config.fish');
            evalLine = 'gw install-shell | source';
          } else {
            output.warning(`Unsupported shell: ${detectedShell || 'unknown'}`);
            console.log(`You can install it manually later with: ${output.bold('gw install-shell')}\n`);
            await signalNavigation(fullPath);
            return;
          }

          await Deno.writeTextFile(shellConfigFile, '\n' + evalLine + '\n', {
            append: true,
          });
          output.success('Shell integration added!');
          console.log(`  Added to: ${output.path(shellConfigFile)}`);
          console.log('\nRestart your terminal or run:');
          if (detectedShell === 'fish') {
            console.log(`  ${output.bold(`source ${shellConfigFile}`)}`);
          } else {
            console.log(`  ${output.bold(`source ${shellConfigFile}`)}`);
          }
          console.log();
        } catch {
          // executeInstallShell exits on error, but just in case
          output.warning('Shell integration setup failed.');
          console.log(`You can install it manually later with: ${output.bold('gw install-shell')}\n`);
        }
      } else {
        console.log();
        console.log(output.dim('You can add it later by adding this to your shell config:'));
        console.log(`  ${output.bold('eval "$(gw install-shell)"')}`);
        console.log();
      }
    }

    // Navigate to the repository directory
    await signalNavigation(fullPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    output.error(`Failed to initialize repository: ${message}`);

    // Cleanup on failure
    if (await pathExists(fullPath)) {
      output.info('Cleaning up partial clone...');
      try {
        await Deno.remove(fullPath, { recursive: true });
      } catch {
        output.warning(`Please manually remove: ${fullPath}`);
      }
    }

    Deno.exit(1);
  }
}

/**
 * Initialize existing repository
 */
async function initializeExistingRepo(parsed: ParsedInitArgs): Promise<void> {
  // Check if already initialized
  const { initialized, configDir, needsMigration } = await isAlreadyInitialized();

  if (initialized && needsMigration) {
    // Config exists at bare root but not in worktree — copy it for committing
    const worktreeRoot = await getWorktreeRoot();
    const sourceConfig = join(configDir!, '.gw', 'config.json');
    const targetDir = join(worktreeRoot, '.gw');
    const targetConfig = join(targetDir, 'config.json');

    try {
      await ensureConfigDir(worktreeRoot);
      await Deno.copyFile(sourceConfig, targetConfig);
      await ensureSchemaInConfig(targetConfig);
      output.success('Config copied to worktree (now committable)');
      console.log(`  From: ${output.path(sourceConfig)}`);
      console.log(`  To:   ${output.path(targetConfig)}`);
      console.log(`\nCommit it: ${output.bold('git add .gw/config.json')}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      output.error(`Failed to copy config: ${message}`);
      Deno.exit(1);
    }
    return;
  }

  if (initialized && !parsed.interactive) {
    const knownConfigPath = join(configDir!, '.gw', 'config.json');
    await ensureConfigDir(configDir!);
    await ensureSchemaInConfig(knownConfigPath);
    output.info('gw is already initialized in this repository');
    console.log(`  Config: ${output.path(knownConfigPath)}`);
    const { localConfigPath } = await resolveConfigPaths();
    if (localConfigPath) {
      console.log(`  Local overrides: ${output.path(localConfigPath)}`);
    }
    console.log(`\nUse ${output.bold('gw init --interactive')} to reconfigure`);
    return;
  }

  // Determine root path: use provided --root or try auto-detection
  let rootPath: string;

  if (parsed.root) {
    // User provided --root, use it
    rootPath = resolve(parsed.root);

    try {
      await validatePathExists(rootPath, 'directory');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      output.error(message);
      Deno.exit(1);
    }
  } else {
    // Save config in the worktree root (committable by default).
    // Falls back to git root if not inside a worktree.
    try {
      rootPath = await getWorktreeRoot();
      output.info(`Auto-detected worktree root: ${output.path(rootPath)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      output.error(`Could not auto-detect git root - ${message}`);
      console.error('Please specify the repository root with --root option or provide a repository URL\n');
      showInitHelp();
      Deno.exit(1);
    }
  }

  // If interactive mode, prompt for configuration
  if (parsed.interactive) {
    const interactiveConfig = promptForConfig();

    // Merge interactive config with parsed args (parsed args take precedence)
    if (interactiveConfig.defaultBranch && !parsed.defaultBranch) {
      parsed.defaultBranch = interactiveConfig.defaultBranch;
    }
    if (interactiveConfig.autoCopyFiles && !parsed.autoCopyFiles) {
      parsed.autoCopyFiles = interactiveConfig.autoCopyFiles;
    }
    if (interactiveConfig.preCheckoutHooks && !parsed.preCheckoutHooks) {
      parsed.preCheckoutHooks = interactiveConfig.preCheckoutHooks;
    }
    if (interactiveConfig.postCheckoutHooks && !parsed.postCheckoutHooks) {
      parsed.postCheckoutHooks = interactiveConfig.postCheckoutHooks;
    }
    if (interactiveConfig.cleanThreshold !== undefined && parsed.cleanThreshold === undefined) {
      parsed.cleanThreshold = interactiveConfig.cleanThreshold;
    }
    if (interactiveConfig.autoClean !== undefined && parsed.autoClean === undefined) {
      parsed.autoClean = interactiveConfig.autoClean;
    }
    if (interactiveConfig.updateStrategy && !parsed.updateStrategy) {
      parsed.updateStrategy = interactiveConfig.updateStrategy;
    }
  }

  // Create config
  const config: Config = {
    defaultBranch: parsed.defaultBranch || 'main',
    cleanThreshold: 7, // Default value
  };

  // Add autoCopyFiles if provided
  if (parsed.autoCopyFiles && parsed.autoCopyFiles.length > 0) {
    config.autoCopyFiles = parsed.autoCopyFiles;
  }

  // Add hooks if provided
  if (parsed.preCheckoutHooks || parsed.postCheckoutHooks) {
    config.hooks = {
      checkout: {},
    };
    if (parsed.preCheckoutHooks && parsed.preCheckoutHooks.length > 0) {
      config.hooks.checkout!.pre = parsed.preCheckoutHooks;
    }
    if (parsed.postCheckoutHooks && parsed.postCheckoutHooks.length > 0) {
      config.hooks.checkout!.post = parsed.postCheckoutHooks;
    }
  }

  // Add cleanThreshold if provided
  if (parsed.cleanThreshold !== undefined) {
    config.cleanThreshold = parsed.cleanThreshold;
  }

  // Add autoClean if provided
  if (parsed.autoClean !== undefined) {
    config.autoClean = parsed.autoClean;
  }

  // Add updateStrategy if provided
  if (parsed.updateStrategy) {
    config.updateStrategy = parsed.updateStrategy;
  }

  // Save config (committable by default — in worktree root)
  try {
    await saveConfigTemplate(rootPath, config);
    output.success('Configuration created successfully');
    console.log(`  Config file: ${output.path(`${rootPath}/.gw/config.json`)}`);
    console.log(`  Repository root: ${output.path(rootPath)}`);
    console.log(`  Default source worktree: ${output.bold(config.defaultBranch || 'main')}`);
    if (config.autoCopyFiles) {
      console.log(`  Auto-copy files: ${output.dim(config.autoCopyFiles.join(', '))}`);
    }
    if (config.hooks?.checkout?.pre) {
      console.log(`  Pre-checkout hooks: ${output.dim(config.hooks.checkout.pre.length.toString())} command(s)`);
    }
    if (config.hooks?.checkout?.post) {
      console.log(`  Post-checkout hooks: ${output.dim(config.hooks.checkout.post.length.toString())} command(s)`);
    }
    if (config.cleanThreshold !== undefined) {
      console.log(`  Clean threshold: ${output.bold(config.cleanThreshold.toString())} days`);
    }
    if (config.autoClean) {
      console.log(
        `  Auto-cleanup: ${output.bold('enabled')} ${output.dim('(background, non-blocking, non-blocking)')}`
      );
    }
    if (config.updateStrategy) {
      console.log(`  Update strategy: ${output.bold(config.updateStrategy)}`);
    }
    console.log();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    output.error(`Failed to create config - ${message}`);
    Deno.exit(1);
  }
}

/**
 * Execute the init command
 *
 * @param args Command-line arguments for the init command
 */
export async function executeInit(args: string[]): Promise<void> {
  const parsed = parseInitArgs(args);

  // Show help if requested
  if (parsed.help) {
    showInitHelp();
    Deno.exit(0);
  }

  // In interactive mode without a URL, check if we need to prompt for one
  if (parsed.interactive && !parsed.repoUrl && !parsed.root) {
    // Check if we're in a git repository
    try {
      await findGitRoot();
      // We're in a git repo, proceed with existing repo mode
    } catch {
      // Not in a git repo, prompt for URL
      console.log();
      showLogo();
      console.log('\n' + output.bold('Repository Setup') + '\n');
      console.log('You are not in a git repository.');
      console.log('Enter a repository URL to clone, or press Enter to specify a repository path with --root.\n');

      const urlInput = prompt('Repository URL (leave blank to exit): ');

      if (urlInput && urlInput.trim()) {
        // User provided a URL, switch to clone mode
        parsed.repoUrl = urlInput.trim();
      } else {
        // User didn't provide URL, show error
        console.log();
        output.error('No repository URL or path provided');
        console.log('\nTo clone a repository:');
        console.log(`  ${output.bold('gw init <repository-url>')}`);
        console.log('\nTo initialize an existing repository:');
        console.log(`  ${output.bold('cd <repository> && gw init --interactive')}`);
        console.log('\nOr specify a repository path:');
        console.log(`  ${output.bold('gw init --interactive --root <path>')}`);
        Deno.exit(1);
      }
    }
  }

  // Branch based on clone vs. existing repo
  if (parsed.repoUrl) {
    // Clone mode
    await initializeFromClone(parsed);
  } else {
    // Existing repo mode
    await initializeExistingRepo(parsed);
  }
}
