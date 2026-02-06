/**
 * Init command implementation
 * Initializes the gw configuration for a repository
 */

import { join, resolve } from '$std/path';
import { saveConfig } from '../lib/config.ts';
import { findGitRoot, pathExists, validatePathExists } from '../lib/path-resolver.ts';
import type { Config } from '../lib/types.ts';
import * as output from '../lib/output.ts';
import { showLogo } from '../lib/cli.ts';
import { signalNavigation } from '../lib/shell-navigation.ts';
import { executeInstallShell } from './install-shell.ts';

/**
 * Check if shell integration is installed
 */
async function isShellIntegrationInstalled(): Promise<boolean> {
  const shell = Deno.env.get('SHELL') || '';
  const shellName = shell.split('/').pop() || '';
  const home = Deno.env.get('HOME') || Deno.env.get('USERPROFILE') || '';

  if (!home) {
    return false;
  }

  let scriptFile: string;

  if (shellName === 'zsh') {
    scriptFile = join(home, '.gw', 'shell', 'integration.zsh');
  } else if (shellName === 'bash') {
    scriptFile = join(home, '.gw', 'shell', 'integration.bash');
  } else if (shellName === 'fish') {
    scriptFile = join(home, '.config', 'fish', 'functions', 'gw.fish');
  } else {
    // Unsupported shell
    return false;
  }

  try {
    await Deno.stat(scriptFile);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parsed init command arguments
 */
interface ParsedInitArgs {
  help: boolean;
  interactive: boolean;
  root?: string;
  defaultBranch?: string;
  autoCopyFiles?: string[];
  preAddHooks?: string[];
  postAddHooks?: string[];
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
    } else if (arg === '--pre-add' && i + 1 < args.length) {
      // Add to pre-add hooks array (can be specified multiple times)
      if (!result.preAddHooks) result.preAddHooks = [];
      result.preAddHooks.push(args[++i]);
    } else if (arg === '--post-add' && i + 1 < args.length) {
      // Add to post-add hooks array (can be specified multiple times)
      if (!result.postAddHooks) result.postAddHooks = [];
      result.postAddHooks.push(args[++i]);
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
    if (first.startsWith('git@') || first.startsWith('https://') || first.startsWith('http://') || first.startsWith('file://')) {
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
 * Check if gw is already initialized in current or parent directories
 */
async function isAlreadyInitialized(): Promise<{ initialized: boolean; gitRoot?: string }> {
  try {
    const gitRoot = await findGitRoot();
    const configPath = join(gitRoot, '.gw', 'config.json');
    const exists = await pathExists(configPath);
    return { initialized: exists, gitRoot };
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
  preAddHooks?: string[];
  postAddHooks?: string[];
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
    preAddHooks?: string[];
    postAddHooks?: string[];
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

  // Pre-add hooks
  console.log();
  const wantPreHooks = prompt(`Do you want to add pre-add hooks? (y/n) [${output.dim('n')}]: `);
  if (wantPreHooks?.toLowerCase() === 'y' || wantPreHooks?.toLowerCase() === 'yes') {
    console.log(output.dim('  Enter commands to run before creating worktrees'));
    console.log(output.dim('  Variables: {worktree}, {worktreePath}, {gitRoot}, {branch}'));
    const preHooks: string[] = [];
    let hookNum = 1;
    while (true) {
      const hookInput = prompt(`  Pre-add hook ${hookNum} (leave blank to finish): `);
      if (!hookInput || !hookInput.trim()) break;
      preHooks.push(hookInput.trim());
      hookNum++;
    }
    if (preHooks.length > 0) {
      config.preAddHooks = preHooks;
    }
  }

  // Post-add hooks
  console.log();
  const wantPostHooks = prompt(`Do you want to add post-add hooks? (y/n) [${output.dim('n')}]: `);
  if (wantPostHooks?.toLowerCase() === 'y' || wantPostHooks?.toLowerCase() === 'yes') {
    console.log(output.dim('  Enter commands to run after creating worktrees'));
    console.log(output.dim('  Variables: {worktree}, {worktreePath}, {gitRoot}, {branch}'));
    const postHooks: string[] = [];
    let hookNum = 1;
    while (true) {
      const hookInput = prompt(`  Post-add hook ${hookNum} (leave blank to finish): `);
      if (!hookInput || !hookInput.trim()) break;
      postHooks.push(hookInput.trim());
      hookNum++;
    }
    if (postHooks.length > 0) {
      config.postAddHooks = postHooks;
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
  const autoCleanInput = prompt(`[autoClean]: Want to cleanup stale worktrees? (y/n) [${output.dim('n')}]:`);
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
                                  when creating new worktrees with 'gw add'
  --pre-add <command>             Command to run before 'gw add' creates a worktree
                                  (can be specified multiple times for multiple hooks)
  --post-add <command>            Command to run after 'gw add' creates a worktree
                                  (can be specified multiple times for multiple hooks)
  --clean-threshold <days>        Number of days before worktrees are considered
                                  stale for 'gw clean' (default: 7)
  --auto-clean                    Prompt to cleanup stale worktrees (after add/list, 24h cooldown)
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
  # Interactive mode - prompts for all configuration options
  # If not in a git repo, will first prompt for repository URL to clone
  gw init --interactive

  # Initialize with auto-detected root and auto-copy files
  gw init --auto-copy-files .env,secrets/

  # Initialize with custom default source (auto-detects root)
  gw init --default-source master

  # Initialize with post-add hook to install dependencies
  gw init --post-add "cd {worktreePath} && pnpm install"

  # Initialize with pre-add validation hook
  gw init --pre-add "echo 'Creating worktree: {worktree}'"

  # Initialize with multiple hooks
  gw init --pre-add "echo 'Starting...'" --post-add "cd {worktreePath} && pnpm install" --post-add "echo 'Done!'"

  # Initialize with explicit repository root
  gw init --root /Users/username/Workspace/repo.git

  # Initialize with update strategy
  gw init --update-strategy rebase

  # Initialize with all options
  gw init --root /Users/username/Workspace/repo.git --default-source master --auto-copy-files .env,secrets/ --post-add "cd {worktreePath} && pnpm install" --update-strategy merge

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
  if (parsed.preAddHooks || parsed.postAddHooks) {
    config.hooks = {
      add: {},
    };
    if (parsed.preAddHooks && parsed.preAddHooks.length > 0) {
      config.hooks.add!.pre = parsed.preAddHooks;
    }
    if (parsed.postAddHooks && parsed.postAddHooks.length > 0) {
      config.hooks.add!.post = parsed.postAddHooks;
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

    let config: Partial<Config>;
    if (parsed.interactive) {
      config = promptForConfig();
    } else {
      config = buildConfigFromArgs(parsed);
    }

    // Detect default branch from remote
    const detectedBranch = await detectDefaultBranch(fullPath);
    if (!parsed.defaultBranch && !parsed.interactive) {
      config.defaultBranch = detectedBranch;
    }

    config.root = fullPath;
    await saveConfig(fullPath, config as Config);
    output.success('Configuration created');

    // Step 4: Create default worktree via gw add
    const defaultBranch = config.defaultBranch || detectedBranch;
    console.log(`\nCreating ${defaultBranch} worktree...`);

    // Get the path to the gw executable (this file)
    const gwPath = new URL(import.meta.url).pathname;
    const mainPath = resolve(gwPath, '../../main.ts');

    // Call add command to create worktree
    const addCmd = new Deno.Command('deno', {
      args: ['run', '--allow-all', mainPath, 'add', defaultBranch],
      cwd: fullPath,
      stdout: 'inherit',
      stderr: 'inherit',
    });

    const { code } = await addCmd.output();
    if (code !== 0) {
      output.warning('Failed to create default worktree automatically');
      output.info(`You can create it manually with: cd ${targetDir} && gw add ${defaultBranch}`);
    } else {
      output.success(`Created ${defaultBranch} worktree`);
    }

    // Success summary
    console.log('\n' + output.checkmark() + ' Repository initialized successfully!\n');
    console.log(`  Repository: ${output.path(fullPath)}`);
    console.log(`  Config: ${output.path(join(fullPath, '.gw/config.json'))}`);
    console.log(`  Default worktree: ${output.bold(defaultBranch)}`);
    console.log();

    // Check for shell integration and offer to install if not present
    const hasShellIntegration = await isShellIntegrationInstalled();
    if (!hasShellIntegration) {
      console.log(output.dim('Shell integration is not installed.'));
      console.log(output.dim('This enables automatic navigation with "gw cd" and "gw init".\n'));

      const response = prompt('Would you like to install shell integration now? (y/n): ');

      if (response?.toLowerCase() === 'y' || response?.toLowerCase() === 'yes') {
        console.log();
        try {
          await executeInstallShell(['--quiet']);
          output.success('Shell integration installed!');
          console.log('\nRestart your terminal or run:');
          const shell = Deno.env.get('SHELL') || '';
          const shellName = shell.split('/').pop() || '';
          if (shellName === 'zsh') {
            console.log(`  ${output.bold('source ~/.zshrc')}`);
          } else if (shellName === 'bash') {
            console.log(`  ${output.bold('source ~/.bashrc')}`);
          } else if (shellName === 'fish') {
            console.log('  Fish will automatically load the function.');
          }
          console.log();
        } catch (error) {
          // executeInstallShell exits on error, but just in case
          output.warning('Shell integration installation failed.');
          console.log(`You can install it manually later with: ${output.bold('gw install-shell')}\n`);
        }
      } else {
        console.log();
        console.log(output.dim('You can install it later with: ') + output.bold('gw install-shell'));
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
  const { initialized, gitRoot } = await isAlreadyInitialized();

  if (initialized && !parsed.interactive) {
    output.info('gw is already initialized in this repository');
    console.log(`  Config: ${output.path(join(gitRoot!, '.gw/config.json'))}`);
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
    // Try auto-detection
    try {
      rootPath = await findGitRoot();
      output.info(`Auto-detected git root: ${output.path(rootPath)}`);
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
    if (interactiveConfig.preAddHooks && !parsed.preAddHooks) {
      parsed.preAddHooks = interactiveConfig.preAddHooks;
    }
    if (interactiveConfig.postAddHooks && !parsed.postAddHooks) {
      parsed.postAddHooks = interactiveConfig.postAddHooks;
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
    root: rootPath,
    defaultBranch: parsed.defaultBranch || 'main',
    cleanThreshold: 7, // Default value
  };

  // Add autoCopyFiles if provided
  if (parsed.autoCopyFiles && parsed.autoCopyFiles.length > 0) {
    config.autoCopyFiles = parsed.autoCopyFiles;
  }

  // Add hooks if provided
  if (parsed.preAddHooks || parsed.postAddHooks) {
    config.hooks = {
      add: {},
    };
    if (parsed.preAddHooks && parsed.preAddHooks.length > 0) {
      config.hooks.add!.pre = parsed.preAddHooks;
    }
    if (parsed.postAddHooks && parsed.postAddHooks.length > 0) {
      config.hooks.add!.post = parsed.postAddHooks;
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

  // Save config at the git root (so it can be found by all worktrees)
  try {
    await saveConfig(rootPath, config);
    output.success('Configuration created successfully');
    console.log(`  Config file: ${output.path(`${rootPath}/.gw/config.json`)}`);
    console.log(`  Repository root: ${output.path(rootPath)}`);
    console.log(`  Default source worktree: ${output.bold(config.defaultBranch || 'main')}`);
    if (config.autoCopyFiles) {
      console.log(`  Auto-copy files: ${output.dim(config.autoCopyFiles.join(', '))}`);
    }
    if (config.hooks?.add?.pre) {
      console.log(`  Pre-add hooks: ${output.dim(config.hooks.add.pre.length.toString())} command(s)`);
    }
    if (config.hooks?.add?.post) {
      console.log(`  Post-add hooks: ${output.dim(config.hooks.add.post.length.toString())} command(s)`);
    }
    if (config.cleanThreshold !== undefined) {
      console.log(`  Clean threshold: ${output.bold(config.cleanThreshold.toString())} days`);
    }
    if (config.autoClean) {
      console.log(`  Auto-cleanup: ${output.bold('enabled')} ${output.dim('(interactive prompts, 24h cooldown)')}`);
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
