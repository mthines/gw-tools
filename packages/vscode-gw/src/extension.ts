/**
 * GW Worktrees - VS Code Extension
 *
 * Provides a sidebar view for Git worktree management (list, open, create, remove).
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { WorktreeProvider, WorktreeItem } from './providers/worktree-provider';
import { WorktreeWatcher } from './watchers/worktree-watcher';
import {
  removeWorktree,
  createWorktreeWithProgress,
  createWorktreeFromStagedWithProgress,
  HookFailureError,
  checkoutPr,
  cleanWorktrees,
  syncWorktree,
  listWorktrees,
  listBranches,
  getDefaultBranch,
  updateWorktree,
  stripAnsi,
  stripRemotePrefix,
  hasUncommittedChanges,
  hasStagedFiles,
  getWorktreePath,
  setLogger,
} from './parsers/git-worktree';

const AGENT_TASKS_PROMPT_KEY = 'vscode-gw.agentTasksMigrationPromptShown';

async function showMigrationPromptOnce(context: vscode.ExtensionContext): Promise<void> {
  if (context.globalState.get<boolean>(AGENT_TASKS_PROMPT_KEY)) return;

  const choice = await vscode.window.showInformationMessage(
    'Agent Tasks moved to a new extension. Install "Agent Tasks" from the Marketplace to continue using it.',
    'Install',
    "Don't show again"
  );

  if (choice === 'Install') {
    try {
      await vscode.commands.executeCommand('workbench.extensions.installExtension', 'mthines.agent-tasks');
    } catch {
      // Fallback: open Marketplace listing externally if direct install fails
      // (e.g., extension not yet published)
      await vscode.env.openExternal(
        vscode.Uri.parse('https://marketplace.visualstudio.com/items?itemName=mthines.agent-tasks')
      );
    }
  }
  if (choice) {
    await context.globalState.update(AGENT_TASKS_PROMPT_KEY, true);
  }
}

/**
 * Open a newly created worktree in a new window, either automatically or via notification button
 */
async function openNewWorktree(worktreePath: string | undefined, message: string): Promise<void> {
  if (!worktreePath) return;

  const autoOpen = vscode.workspace.getConfiguration('gw').get<boolean>('autoOpenWorktree', true);

  if (autoOpen) {
    const uri = vscode.Uri.file(worktreePath);
    vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: true });
    vscode.window.showInformationMessage(message);
  } else {
    const action = await vscode.window.showInformationMessage(message, 'Open in New Window');
    if (action === 'Open in New Window') {
      const uri = vscode.Uri.file(worktreePath);
      vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: true });
    }
  }
}

/**
 * Show the appropriate notification when a hook failure is detected.
 *
 * - Pre-checkout hook failure: worktree was NOT created → showErrorMessage (fatal).
 * - Post-checkout hook failure: worktree WAS created → showWarningMessage with
 *   "Show Output" and "Open Worktree" buttons (non-fatal).
 *
 * @param err The HookFailureError thrown by the progress-aware checkout functions
 * @param cwd Workspace path (for resolving the worktree path)
 * @param branchName Branch name (for resolving the worktree path on post-checkout failures)
 */
async function handleHookFailure(err: HookFailureError, cwd: string, branchName: string): Promise<void> {
  if (err.isPreCheckout) {
    // Worktree was NOT created — fatal error
    vscode.window.showErrorMessage(`Worktree creation cancelled: pre-checkout hook failed. ${stripAnsi(err.message)}`);
    return;
  }

  // Post-checkout: worktree WAS created — non-fatal warning with action buttons
  const worktreePath = err.worktreePath ?? (await getWorktreePath(cwd, branchName));

  const action = await vscode.window.showWarningMessage(
    `Worktree "${branchName}" created, but a post-checkout hook failed. ${stripAnsi(err.message)}`,
    'Show Output',
    'Open Worktree'
  );

  if (action === 'Open Worktree' && worktreePath) {
    const uri = vscode.Uri.file(worktreePath);
    vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: true });
  } else if (action === 'Show Output') {
    vscode.commands.executeCommand('gw.showOutput');
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspacePath) return;

  // Create output channel for logging
  const outputChannel = vscode.window.createOutputChannel('gw');
  context.subscriptions.push(outputChannel);
  const log = (message: string): void => {
    outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] ${message}`);
  };
  setLogger(log);

  // Initialize providers
  const worktreeProvider = new WorktreeProvider();
  const worktreeWatcher = new WorktreeWatcher();

  // Register tree views
  const worktreeView = vscode.window.createTreeView('gwWorktreeExplorer', {
    treeDataProvider: worktreeProvider,
    showCollapseAll: true,
    canSelectMany: true,
  });

  // Double-click detection via click command on tree items
  let lastClickedPath: string | undefined;
  let lastClickTime = 0;
  const DOUBLE_CLICK_THRESHOLD = 500; // ms

  context.subscriptions.push(
    vscode.commands.registerCommand('gw.worktreeClick', (item: WorktreeItem) => {
      const now = Date.now();
      if (lastClickedPath === item.worktree.path && now - lastClickTime < DOUBLE_CLICK_THRESHOLD) {
        // Double-click detected — open in new window
        vscode.commands.executeCommand('gw.openWorktree', item);
        lastClickedPath = undefined;
        lastClickTime = 0;
      } else {
        lastClickedPath = item.worktree.path;
        lastClickTime = now;
      }
    })
  );

  log('gw extension activated');

  // Wire up worktree watcher to refresh worktrees view
  worktreeWatcher.onWorktreeChanged(() => {
    log('Worktree change detected, refreshing');
    worktreeProvider.refresh();
  });

  // Show one-time migration prompt for users who had Agent Tasks in vscode-gw
  void showMigrationPromptOnce(context);

  // Shared reference for the active switch worktree quick pick (used by shift+enter keybinding)
  let activeSwitchQuickPick: vscode.QuickPick<vscode.QuickPickItem & { worktreePath?: string }> | undefined;

  // Register commands
  const commands = [
    vscode.commands.registerCommand('gw.refreshWorktrees', () => {
      worktreeProvider.refresh();
    }),

    vscode.commands.registerCommand('gw.switchWorktree', async () => {
      log('Command: switchWorktree');
      const [worktrees, branches, defaultBranch] = await Promise.all([
        listWorktrees(workspacePath),
        listBranches(workspacePath),
        getDefaultBranch(workspacePath),
      ]);
      const currentPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

      interface SwitchQuickPickItem extends vscode.QuickPickItem {
        worktreePath?: string;
        branch?: string;
        isCreateNew?: boolean;
        isRemote?: boolean;
        prUrl?: string;
      }

      const openInSameWindowButton: vscode.QuickInputButton = {
        iconPath: new vscode.ThemeIcon('window'),
        tooltip: 'Open in Same Window',
      };

      const worktreeItems: SwitchQuickPickItem[] = worktrees
        .filter((w) => !w.bare)
        .map((w) => {
          const isCurrent = w.path === currentPath;
          return {
            label: `${isCurrent ? '$(check) ' : '$(folder-opened) '}${w.branch}`,
            description: isCurrent ? 'current' : path.basename(w.path),
            detail: w.path,
            worktreePath: w.path,
            buttons: isCurrent ? [] : [openInSameWindowButton],
          };
        });

      // Prepare branch items (exclude branches that already have worktrees)
      const worktreeBranches = new Set(worktrees.map((w) => w.branch));
      const isDefaultBranch = (name: string): boolean => {
        const baseName = name.replace(/^origin\//, '');
        return baseName === defaultBranch;
      };
      const sortedBranches = branches
        .filter((b) => !b.isCurrent && !worktreeBranches.has(b.name))
        .sort((a, b) => {
          const aIsDefault = isDefaultBranch(a.name);
          const bIsDefault = isDefaultBranch(b.name);
          if (aIsDefault !== bIsDefault) return aIsDefault ? -1 : 1;
          if (a.isRemote !== b.isRemote) return a.isRemote ? 1 : -1;
          return a.name.localeCompare(b.name);
        });
      const branchItems: SwitchQuickPickItem[] = sortedBranches.map((b) => ({
        label: `$(git-branch) ${b.name}`,
        description: b.relativeDate || '',
        detail:
          b.authorName && b.commitHash && b.commitMessage
            ? `${b.authorName} • ${b.commitHash} • ${b.commitMessage}`
            : undefined,
        branch: b.name,
        isRemote: b.isRemote,
      }));
      const branchNames = new Set(sortedBranches.map((b) => b.name));

      // Build the full item list: worktrees first, then branches
      const allStaticItems: SwitchQuickPickItem[] = [
        { label: 'Worktrees', kind: vscode.QuickPickItemKind.Separator },
        ...worktreeItems,
        { label: 'Branches', kind: vscode.QuickPickItemKind.Separator },
        ...branchItems,
      ];

      const quickPick = vscode.window.createQuickPick<SwitchQuickPickItem>();
      quickPick.title = 'Switch Worktree';
      quickPick.placeholder = 'Search worktrees, branches, paste a GitHub PR URL, or type a new branch name';
      quickPick.matchOnDescription = true;
      quickPick.matchOnDetail = true;
      // Preserve our item order (worktrees first) instead of alphabetical sorting.
      // sortByLabel is a proposed API (not yet in stable @types/vscode):
      // https://github.com/microsoft/vscode/blob/main/src/vscode-dts/vscode.proposed.quickPickSortByLabel.d.ts
      (quickPick as unknown as { sortByLabel: boolean }).sortByLabel = false;
      quickPick.items = allStaticItems;

      // Detect GitHub PR URLs and show dynamic items
      const ghPrUrlPattern = /(?:https?:\/\/)?github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/;

      quickPick.onDidChangeValue((value) => {
        const typedRaw = value.trim();
        if (typedRaw.length === 0 || branchNames.has(typedRaw) || worktreeBranches.has(typedRaw)) {
          quickPick.items = allStaticItems;
          return;
        }

        // Check for GitHub PR URL
        const prMatch = typedRaw.match(ghPrUrlPattern);
        if (prMatch) {
          const [, owner, repo, prNumber] = prMatch;
          quickPick.items = [
            {
              label: `$(git-pull-request) Checkout PR #${prNumber}`,
              description: `${owner}/${repo}`,
              detail: `Fetch PR branch and create a worktree via gw pr`,
              alwaysShow: true,
              prUrl: typedRaw,
            },
          ];
          return;
        }

        // Append "Create new branch" when typed text doesn't match any existing branch
        quickPick.items = [
          ...allStaticItems,
          { label: '', kind: vscode.QuickPickItemKind.Separator },
          {
            label: `$(plus) Create new branch "${typedRaw}"`,
            description: 'New worktree from new branch',
            alwaysShow: true,
            branch: typedRaw,
            isCreateNew: true,
          },
        ];
      });

      quickPick.onDidAccept(async () => {
        const selected = quickPick.selectedItems[0];
        quickPick.hide();

        if (!selected) return;

        // GitHub PR URL — checkout PR via gw pr
        if (selected.prUrl) {
          const prMatch = selected.prUrl.match(ghPrUrlPattern);
          const prNumber = prMatch ? prMatch[3] : 'PR';
          log(`Checking out PR: ${selected.prUrl}`);

          try {
            await vscode.window.withProgress(
              {
                location: vscode.ProgressLocation.Notification,
                title: `Checking out PR #${prNumber}...`,
                cancellable: false,
              },
              async () => {
                await checkoutPr(workspacePath, selected.prUrl!);
              }
            );
            worktreeProvider.refresh();

            // Find the newly created worktree by refreshing the list
            const updatedWorktrees = await listWorktrees(workspacePath);
            const newWorktree = updatedWorktrees.find(
              (wt) => !wt.bare && wt.path !== currentPath && !worktrees.some((old) => old.path === wt.path)
            );
            if (newWorktree) {
              await openNewWorktree(newWorktree.path, `Checked out PR #${prNumber}`);
            } else {
              vscode.window.showInformationMessage(`Checked out PR #${prNumber}`);
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Failed to checkout PR: ${stripAnsi(msg)}`);
          }
          return;
        }

        // Existing worktree — open it
        if (selected.worktreePath) {
          if (selected.worktreePath !== currentPath) {
            log(`Opening worktree in new window: ${selected.worktreePath}`);
            const uri = vscode.Uri.file(selected.worktreePath);
            vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: true });
          }
          return;
        }

        // Branch or new branch — create worktree then open
        const rawBranchName = selected.branch;
        if (!rawBranchName) return;
        // Strip remote prefix (e.g. `origin/`) when checking out a remote-only branch
        const branchName = selected.isRemote ? stripRemotePrefix(rawBranchName) : rawBranchName;
        log(`Creating worktree for branch: ${branchName}`);

        try {
          await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: `Creating worktree: ${branchName}`,
              cancellable: false,
            },
            async (progress) => {
              await createWorktreeWithProgress(workspacePath, branchName, (msg) => progress.report({ message: msg }));
            }
          );
          worktreeProvider.refresh();

          const newWorktreePath = await getWorktreePath(workspacePath, branchName);
          await openNewWorktree(newWorktreePath, `Created worktree: ${branchName}`);
        } catch (err) {
          if (err instanceof HookFailureError) {
            await handleHookFailure(err, workspacePath, branchName);
          } else {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Failed to create worktree: ${stripAnsi(msg)}`);
          }
        }
      });

      quickPick.onDidTriggerItemButton((e) => {
        if (e.item.worktreePath) {
          const uri = vscode.Uri.file(e.item.worktreePath);
          vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: false });
        }
        quickPick.hide();
      });

      quickPick.onDidHide(() => {
        activeSwitchQuickPick = undefined;
        vscode.commands.executeCommand('setContext', 'gw.switchWorktreeActive', false);
        quickPick.dispose();
      });

      activeSwitchQuickPick = quickPick;
      vscode.commands.executeCommand('setContext', 'gw.switchWorktreeActive', true);
      quickPick.show();
    }),

    vscode.commands.registerCommand('gw.switchWorktreeAcceptSameWindow', () => {
      if (!activeSwitchQuickPick) return;
      const selected = activeSwitchQuickPick.activeItems[0];
      const current = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (selected?.worktreePath && selected.worktreePath !== current) {
        log(`Opening worktree in same window: ${selected.worktreePath}`);
        const uri = vscode.Uri.file(selected.worktreePath);
        vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: false });
      }
      activeSwitchQuickPick.hide();
    }),

    vscode.commands.registerCommand('gw.focus', () => {
      // Focus the gw sidebar (worktrees view by default)
      Promise.resolve(worktreeView.reveal(undefined as unknown as WorktreeItem, { focus: true, expand: true })).catch(
        () => {
          // If reveal fails (no items), just focus the view
          vscode.commands.executeCommand('gwWorktreeExplorer.focus');
        }
      );
    }),

    vscode.commands.registerCommand('gw.focusWorktrees', () => {
      vscode.commands.executeCommand('gwWorktreeExplorer.focus');
    }),

    vscode.commands.registerCommand('gw.openWorktree', async (item?: WorktreeItem) => {
      let worktreePath = item?.worktree?.path;

      if (!worktreePath) {
        // No item provided, show picker
        const worktrees = await listWorktrees(workspacePath);
        const picks = worktrees
          .filter((w) => !w.bare)
          .map((w) => ({ label: w.branch, description: w.path, path: w.path }));

        if (picks.length === 0) {
          vscode.window.showWarningMessage('No worktrees available.');
          return;
        }

        const picked = await vscode.window.showQuickPick(picks, {
          placeHolder: 'Select worktree to open in new window',
        });
        if (!picked) return;
        worktreePath = picked.path;
      }

      const uri = vscode.Uri.file(worktreePath);
      await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: true });
    }),

    vscode.commands.registerCommand('gw.openWorktreeInCurrentWindow', async (item?: WorktreeItem) => {
      let worktreePath = item?.worktree?.path;

      if (!worktreePath) {
        // No item provided, show picker
        const worktrees = await listWorktrees(workspacePath);
        const picks = worktrees
          .filter((w) => !w.bare)
          .map((w) => ({ label: w.branch, description: w.path, path: w.path }));

        if (picks.length === 0) {
          vscode.window.showWarningMessage('No worktrees available.');
          return;
        }

        const picked = await vscode.window.showQuickPick(picks, {
          placeHolder: 'Select worktree to open in current window',
        });
        if (!picked) return;
        worktreePath = picked.path;
      }

      const uri = vscode.Uri.file(worktreePath);
      await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: false });
    }),

    vscode.commands.registerCommand('gw.removeWorktree', async (item?: WorktreeItem) => {
      log(`Command: removeWorktree${item ? ` (${item.worktree.branch})` : ''}`);
      let branch = item?.worktree?.branch;
      let worktreePath = item?.worktree?.path;

      if (!branch || !worktreePath) {
        // No item provided, show picker
        const worktrees = await listWorktrees(workspacePath);
        const picks = worktrees
          .filter((w) => !w.bare)
          .map((w) => ({ label: w.branch, description: w.path, path: w.path }));

        if (picks.length === 0) {
          vscode.window.showWarningMessage('No removable worktrees available.');
          return;
        }

        const picked = await vscode.window.showQuickPick(picks, {
          placeHolder: 'Select worktree to remove',
        });
        if (!picked) return;
        branch = picked.label;
        worktreePath = picked.path;
      }

      // Check if worktree has uncommitted changes
      const hasDirtyChanges = await hasUncommittedChanges(worktreePath);

      let confirm: string | undefined;
      let forceRemove = false;

      if (hasDirtyChanges) {
        // Show warning with force option
        confirm = await vscode.window.showWarningMessage(
          `Remove worktree "${branch}"?\n\nThis worktree has uncommitted changes that will be lost.`,
          { modal: true },
          'Force Remove'
        );
        forceRemove = confirm === 'Force Remove';
      } else {
        // Standard confirmation
        confirm = await vscode.window.showWarningMessage(`Remove worktree "${branch}"?`, { modal: true }, 'Remove');
      }

      if (!confirm) return;

      try {
        await removeWorktree(workspacePath, worktreePath, forceRemove);
        worktreeProvider.refresh();
        vscode.window.showInformationMessage(`Removed worktree: ${branch}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to remove worktree: ${stripAnsi(msg)}`);
      }
    }),

    vscode.commands.registerCommand(
      'gw.removeSelectedWorktrees',
      async (_item?: WorktreeItem, selectedItems?: WorktreeItem[]) => {
        const items = selectedItems && selectedItems.length > 0 ? selectedItems : [];
        log(`Command: removeSelectedWorktrees (${items.length} items)`);

        if (items.length === 0) {
          vscode.window.showWarningMessage('No worktrees selected.');
          return;
        }

        // Filter out bare worktrees
        const removable = items.filter((i) => !i.worktree.bare);
        if (removable.length === 0) return;

        // Check for dirty changes across all selected worktrees
        const dirtyChecks = await Promise.all(
          removable.map(async (i) => ({
            item: i,
            dirty: await hasUncommittedChanges(i.worktree.path),
          }))
        );
        const hasDirty = dirtyChecks.some((c) => c.dirty);

        const branchNames = removable.map((i) => i.worktree.branch).join(', ');
        const count = removable.length;
        let confirm: string | undefined;
        let forceRemove = false;

        if (hasDirty) {
          const dirtyBranches = dirtyChecks
            .filter((c) => c.dirty)
            .map((c) => c.item.worktree.branch)
            .join(', ');
          confirm = await vscode.window.showWarningMessage(
            `Remove ${count} worktrees (${branchNames})?\n\nWorktrees with uncommitted changes: ${dirtyBranches}`,
            { modal: true },
            'Force Remove'
          );
          forceRemove = confirm === 'Force Remove';
        } else {
          confirm = await vscode.window.showWarningMessage(
            `Remove ${count} worktrees (${branchNames})?`,
            { modal: true },
            'Remove'
          );
        }

        if (!confirm) return;

        const results: { branch: string; success: boolean; error?: string }[] = [];

        for (const i of removable) {
          try {
            await removeWorktree(workspacePath, i.worktree.path, forceRemove);
            results.push({ branch: i.worktree.branch, success: true });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            results.push({ branch: i.worktree.branch, success: false, error: stripAnsi(msg) });
          }
        }

        worktreeProvider.refresh();

        const succeeded = results.filter((r) => r.success);
        const failed = results.filter((r) => !r.success);

        if (succeeded.length > 0) {
          vscode.window.showInformationMessage(
            `Removed ${succeeded.length} worktrees: ${succeeded.map((r) => r.branch).join(', ')}`
          );
        }
        if (failed.length > 0) {
          vscode.window.showErrorMessage(
            `Failed to remove ${failed.length} worktrees: ${failed.map((r) => `${r.branch} (${r.error})`).join('; ')}`
          );
        }
      }
    ),

    vscode.commands.registerCommand('gw.createWorktree', async () => {
      log('Command: createWorktree');
      const [branches, defaultBranch] = await Promise.all([
        listBranches(workspacePath),
        getDefaultBranch(workspacePath),
      ]);

      const isDefaultBranch = (name: string): boolean => {
        const baseName = name.replace(/^origin\//, '');
        return baseName === defaultBranch;
      };

      // Sort: default branch first, then local before remote, alphabetical
      const sortedBranches = branches
        .filter((b) => !b.isCurrent)
        .sort((a, b) => {
          const aIsDefault = isDefaultBranch(a.name);
          const bIsDefault = isDefaultBranch(b.name);
          if (aIsDefault !== bIsDefault) return aIsDefault ? -1 : 1;
          if (a.isRemote !== b.isRemote) return a.isRemote ? 1 : -1;
          return a.name.localeCompare(b.name);
        });

      interface BranchPickItem extends vscode.QuickPickItem {
        branch: string;
        isRemote?: boolean;
      }

      const branchPicks: BranchPickItem[] = sortedBranches.map((b) => ({
        label: `$(git-branch) ${b.name}`,
        description: b.relativeDate || '',
        detail:
          b.authorName && b.commitHash && b.commitMessage
            ? `${b.authorName} • ${b.commitHash} • ${b.commitMessage}`
            : undefined,
        branch: b.name,
        isRemote: b.isRemote,
      }));

      const branchNames = new Set(sortedBranches.map((b) => b.name));

      const branchName = await new Promise<string | undefined>((resolve) => {
        const qp = vscode.window.createQuickPick<BranchPickItem>();
        qp.title = 'Create Worktree';
        qp.placeholder = 'Select a branch or type a new branch name';
        qp.items = branchPicks;
        qp.matchOnDescription = true;
        qp.matchOnDetail = true;

        qp.onDidChangeValue((value) => {
          const typed = value.trim();
          // Filter existing branches that match, then prepend a "create new" item if typed name is novel
          const filtered = branchPicks.filter(
            (p) =>
              p.branch.toLowerCase().includes(typed.toLowerCase()) ||
              (p.description && p.description.toLowerCase().includes(typed.toLowerCase())) ||
              (p.detail && p.detail.toLowerCase().includes(typed.toLowerCase()))
          );
          if (typed.length > 0 && !branchNames.has(typed)) {
            const createItem: BranchPickItem = {
              label: `$(plus) Create new branch "${typed}"`,
              description: 'New worktree from new branch',
              alwaysShow: true,
              branch: typed,
            };
            qp.items = [createItem, ...filtered];
          } else {
            qp.items = filtered.length > 0 ? filtered : branchPicks;
          }
        });

        qp.onDidAccept(() => {
          const selected = qp.selectedItems[0];
          if (selected) {
            // Strip remote prefix (e.g. `origin/`) when checking out a remote-only branch
            const resolvedBranch = selected.isRemote ? stripRemotePrefix(selected.branch) : selected.branch;
            resolve(resolvedBranch);
          } else {
            const typed = qp.value.trim();
            if (typed.length > 0 && !typed.includes(' ')) {
              resolve(typed);
            } else {
              resolve(undefined);
            }
          }
          qp.dispose();
        });

        qp.onDidHide(() => {
          resolve(undefined);
          qp.dispose();
        });

        qp.show();
      });

      if (!branchName) return;

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Creating worktree: ${branchName}`,
            cancellable: false,
          },
          async (progress) => {
            await createWorktreeWithProgress(workspacePath, branchName, (msg) => progress.report({ message: msg }));
          }
        );
        worktreeProvider.refresh();

        // Get the worktree path and open or show notification
        const worktreePath = await getWorktreePath(workspacePath, branchName);
        await openNewWorktree(worktreePath, `Created worktree: ${branchName}`);
      } catch (err) {
        if (err instanceof HookFailureError) {
          await handleHookFailure(err, workspacePath, branchName);
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(`Failed to create worktree: ${stripAnsi(msg)}`);
        }
      }
    }),

    vscode.commands.registerCommand('gw.createWorktreeFromStaged', async () => {
      log('Command: createWorktreeFromStaged');
      // Check if there are staged files first
      const hasStaged = await hasStagedFiles(workspacePath);
      if (!hasStaged) {
        vscode.window.showWarningMessage(
          'No staged files found. Stage files with "git add" before using this command.'
        );
        return;
      }

      const branchName = await vscode.window.showInputBox({
        prompt: 'Enter branch name for new worktree (staged files will be copied)',
        placeHolder: 'feature/extracted-work',
        validateInput: (value) => {
          if (!value || value.trim().length === 0) return 'Branch name is required';
          if (value.includes(' ')) return 'Branch name cannot contain spaces';
          return null;
        },
      });

      if (!branchName) return;

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Creating worktree from staged files: ${branchName}`,
            cancellable: false,
          },
          async (progress) => {
            await createWorktreeFromStagedWithProgress(workspacePath, branchName, (msg) =>
              progress.report({ message: msg })
            );
          }
        );
        worktreeProvider.refresh();

        // Get the worktree path and open or show notification
        const worktreePath = await getWorktreePath(workspacePath, branchName);
        await openNewWorktree(worktreePath, `Created worktree with staged files: ${branchName}`);
      } catch (err) {
        if (err instanceof HookFailureError) {
          await handleHookFailure(err, workspacePath, branchName);
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(`Failed to create worktree from staged: ${stripAnsi(msg)}`);
        }
      }
    }),

    vscode.commands.registerCommand('gw.clean', async () => {
      log('Command: clean');
      const dryRunRaw = await cleanWorktrees(workspacePath, { dryRun: true });
      const dryRunOutput = stripAnsi(dryRunRaw);
      if (!dryRunOutput || dryRunOutput.includes('No worktrees to clean')) {
        vscode.window.showInformationMessage('No stale worktrees to clean.');
        return;
      }

      const choice = await vscode.window.showWarningMessage(
        'Clean stale worktrees?',
        { modal: true, detail: dryRunOutput },
        'Clean',
        'Force Clean'
      );
      if (!choice) return;

      try {
        await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: 'Cleaning worktrees...' },
          async () => {
            const result = await cleanWorktrees(workspacePath, { force: choice === 'Force Clean' });
            vscode.window.showInformationMessage(stripAnsi(result) || 'Worktrees cleaned.');
          }
        );
        worktreeProvider.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to clean worktrees: ${stripAnsi(msg)}`);
      }
    }),

    vscode.commands.registerCommand('gw.sync', async (item?: WorktreeItem) => {
      log(`Command: sync${item ? ` (${item.worktree.branch})` : ''}`);
      let target = item?.worktree.branch;

      if (!target) {
        // Show picker with available worktrees
        const worktrees = await listWorktrees(workspacePath);
        const picks = worktrees.filter((w) => !w.bare).map((w) => ({ label: w.branch, description: w.path }));

        if (picks.length === 0) {
          vscode.window.showWarningMessage('No worktrees available to sync.');
          return;
        }

        const picked = await vscode.window.showQuickPick(picks, {
          placeHolder: 'Select target worktree to sync files to',
        });
        if (!picked) return;
        target = picked.label;
      }

      try {
        await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: `Syncing to ${target}...` },
          async () => {
            const result = await syncWorktree(workspacePath, target);
            vscode.window.showInformationMessage(stripAnsi(result) || `Synced to ${target}`);
          }
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to sync: ${stripAnsi(msg)}`);
      }
    }),

    vscode.commands.registerCommand('gw.update', async () => {
      log('Command: update');
      const result = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Updating worktree...', cancellable: false },
        async () => {
          return await updateWorktree(workspacePath);
        }
      );

      if (result.success) {
        if (result.alreadyUpToDate) {
          vscode.window.showInformationMessage('Already up to date');
        } else {
          vscode.window.showInformationMessage('Worktree updated successfully');
        }
      } else if (result.conflicted) {
        const action = await vscode.window.showWarningMessage(
          'Merge conflict detected. Resolve conflicts in the editor, then commit.',
          'Open Source Control'
        );
        if (action === 'Open Source Control') {
          vscode.commands.executeCommand('workbench.view.scm');
        }
      } else {
        vscode.window.showErrorMessage(`Failed to update: ${result.message}`);
      }
    }),

    vscode.commands.registerCommand('gw.updateFrom', async () => {
      log('Command: updateFrom');
      const [branches, defaultBranch] = await Promise.all([
        listBranches(workspacePath),
        getDefaultBranch(workspacePath),
      ]);

      // Helper to check if branch is the default branch
      const isDefaultBranch = (name: string): boolean => {
        const baseName = name.replace(/^origin\//, '');
        return baseName === defaultBranch;
      };

      // Sort: default branch first, then local, then remote; exclude current branch
      const sortedBranches = branches
        .filter((b) => !b.isCurrent)
        .sort((a, b) => {
          // Default branch always first
          const aIsDefault = isDefaultBranch(a.name);
          const bIsDefault = isDefaultBranch(b.name);
          if (aIsDefault !== bIsDefault) return aIsDefault ? -1 : 1;

          // Then local before remote
          if (a.isRemote !== b.isRemote) return a.isRemote ? 1 : -1;
          return a.name.localeCompare(b.name);
        });

      if (sortedBranches.length === 0) {
        vscode.window.showWarningMessage('No branches available.');
        return;
      }

      const picks = sortedBranches.map((b) => ({
        label: `$(git-branch) ${b.name}`,
        description: b.relativeDate || '',
        detail:
          b.authorName && b.commitHash && b.commitMessage
            ? `${b.authorName} • ${b.commitHash} • ${b.commitMessage}`
            : undefined,
        branch: b.name,
      }));

      const picked = await vscode.window.showQuickPick(picks, {
        placeHolder: 'Select branch to update from',
        title: 'Update From Branch',
        matchOnDescription: true,
        matchOnDetail: true,
      });

      if (!picked) return;

      const result = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Updating from ${picked.branch}...`,
          cancellable: false,
        },
        async () => {
          return await updateWorktree(workspacePath, { from: picked.branch });
        }
      );

      if (result.success) {
        if (result.alreadyUpToDate) {
          vscode.window.showInformationMessage('Already up to date');
        } else {
          vscode.window.showInformationMessage(`Updated from ${picked.branch}`);
        }
      } else if (result.conflicted) {
        const action = await vscode.window.showWarningMessage(
          'Merge conflict detected. Resolve conflicts in the editor, then commit.',
          'Open Source Control'
        );
        if (action === 'Open Source Control') {
          vscode.commands.executeCommand('workbench.view.scm');
        }
      } else {
        vscode.window.showErrorMessage(`Failed to update: ${result.message}`);
      }
    }),

    vscode.commands.registerCommand('gw.showOutput', () => {
      outputChannel.show();
    }),

    vscode.commands.registerCommand('gw.syncFrom', async () => {
      log('Command: syncFrom');
      const [worktrees, defaultBranch] = await Promise.all([
        listWorktrees(workspacePath),
        getDefaultBranch(workspacePath),
      ]);
      const currentPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

      // Exclude current worktree and bare repos
      const otherWorktrees = worktrees.filter((w) => !w.bare && w.path !== currentPath);

      if (otherWorktrees.length === 0) {
        vscode.window.showWarningMessage('No other worktrees available to sync from.');
        return;
      }

      // Sort: default branch first, then alphabetically
      const sortedWorktrees = otherWorktrees.sort((a, b) => {
        const aIsDefault = a.branch === defaultBranch;
        const bIsDefault = b.branch === defaultBranch;
        if (aIsDefault !== bIsDefault) return aIsDefault ? -1 : 1;
        return a.branch.localeCompare(b.branch);
      });

      const picks = sortedWorktrees.map((w) => ({
        label: w.branch,
        description: path.basename(w.path),
        detail: w.path,
      }));

      const picked = await vscode.window.showQuickPick(picks, {
        placeHolder: 'Select worktree to sync files from',
        title: 'Sync From Worktree',
        matchOnDescription: true,
        matchOnDetail: true,
      });

      if (!picked) return;

      try {
        await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: `Syncing from ${picked.label}...` },
          async () => {
            const result = await syncWorktree(workspacePath, undefined, picked.label);
            vscode.window.showInformationMessage(stripAnsi(result) || `Synced from ${picked.label}`);
          }
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to sync: ${stripAnsi(msg)}`);
      }
    }),
  ];

  // Refresh worktrees when workspace changes
  const workspaceWatcher = vscode.workspace.onDidChangeWorkspaceFolders(() => {
    worktreeProvider.refresh();
  });

  // Push all disposables
  context.subscriptions.push(worktreeView, worktreeWatcher, workspaceWatcher, ...commands);
}

export function deactivate(): void {
  // cleanup handled by disposables
}
