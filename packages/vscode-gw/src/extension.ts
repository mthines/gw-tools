/**
 * GW Worktrees - VS Code Extension
 *
 * Provides sidebar views for:
 * - Git worktree management (list, open, create, remove)
 * - Agent task visualization (task.md, plan.md progress tracking)
 * - Auto-opens walkthrough.md when agent completes work
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { WorktreeProvider, WorktreeItem } from './providers/worktree-provider';
import { AgentTasksProvider, AgentBranchItem } from './providers/agent-tasks-provider';
import { ArtifactWatcher } from './watchers/artifact-watcher';
import { removeWorktree, createWorktree, cleanWorktrees, syncWorktree, listWorktrees } from './parsers/git-worktree';

/**
 * Open a markdown file, respecting the preview setting
 */
async function openMarkdownFile(filePath: string): Promise<void> {
  const usePreview = vscode.workspace.getConfiguration('gw').get<boolean>('openMarkdownInPreview', false);
  const uri = vscode.Uri.file(filePath);

  if (usePreview) {
    await vscode.commands.executeCommand('markdown.showPreview', uri);
  } else {
    await vscode.commands.executeCommand('vscode.open', uri);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspacePath) return;

  // Initialize providers
  const worktreeProvider = new WorktreeProvider();
  const agentTasksProvider = new AgentTasksProvider();
  const artifactWatcher = new ArtifactWatcher();

  // Register tree views
  const worktreeView = vscode.window.createTreeView('gwWorktreeExplorer', {
    treeDataProvider: worktreeProvider,
    showCollapseAll: true,
  });

  const agentTasksView = vscode.window.createTreeView('gwAgentTasks', {
    treeDataProvider: agentTasksProvider,
    showCollapseAll: true,
  });

  // Wire up artifact watcher to refresh agent tasks
  artifactWatcher.onArtifactChanged(() => {
    agentTasksProvider.refresh();
  });

  // Register commands
  const commands = [
    vscode.commands.registerCommand('gw.refreshWorktrees', () => {
      worktreeProvider.refresh();
    }),

    vscode.commands.registerCommand('gw.refreshAgentTasks', () => {
      agentTasksProvider.refresh();
    }),

    vscode.commands.registerCommand('gw.switchWorktree', async () => {
      const worktrees = await listWorktrees(workspacePath);
      const currentPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

      interface WorktreeQuickPickItem extends vscode.QuickPickItem {
        worktreePath: string;
      }

      const openInNewWindowButton: vscode.QuickInputButton = {
        iconPath: new vscode.ThemeIcon('empty-window'),
        tooltip: 'Open in New Window',
      };

      const items: WorktreeQuickPickItem[] = worktrees
        .filter((w) => !w.bare)
        .map((w) => {
          const isCurrent = w.path === currentPath;
          return {
            label: `${isCurrent ? '$(check) ' : ''}${w.branch}`,
            description: isCurrent ? 'current' : path.basename(w.path),
            detail: w.path,
            worktreePath: w.path,
            buttons: isCurrent ? [] : [openInNewWindowButton],
          };
        });

      if (items.length === 0) {
        vscode.window.showWarningMessage('No worktrees available.');
        return;
      }

      const quickPick = vscode.window.createQuickPick<WorktreeQuickPickItem>();
      quickPick.items = items;
      quickPick.placeholder = 'Select worktree to switch to (click button for new window)';
      quickPick.title = 'Switch Worktree';
      quickPick.matchOnDescription = true;
      quickPick.matchOnDetail = true;

      quickPick.onDidAccept(() => {
        const selected = quickPick.selectedItems[0];
        if (selected && selected.worktreePath !== currentPath) {
          const uri = vscode.Uri.file(selected.worktreePath);
          vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: false });
        }
        quickPick.hide();
      });

      quickPick.onDidTriggerItemButton((e) => {
        const uri = vscode.Uri.file(e.item.worktreePath);
        vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: true });
        quickPick.hide();
      });

      quickPick.onDidHide(() => quickPick.dispose());
      quickPick.show();
    }),

    vscode.commands.registerCommand('gw.focus', () => {
      // Focus the gw sidebar (worktrees view by default)
      worktreeView.reveal(undefined as unknown as WorktreeItem, { focus: true, expand: true }).catch(() => {
        // If reveal fails (no items), just focus the view
        vscode.commands.executeCommand('gwWorktreeExplorer.focus');
      });
    }),

    vscode.commands.registerCommand('gw.focusWorktrees', () => {
      vscode.commands.executeCommand('gwWorktreeExplorer.focus');
    }),

    vscode.commands.registerCommand('gw.focusAgentTasks', () => {
      vscode.commands.executeCommand('gwAgentTasks.focus');
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

      const confirm = await vscode.window.showWarningMessage(`Remove worktree "${branch}"?`, { modal: true }, 'Remove');
      if (confirm !== 'Remove') return;

      try {
        await removeWorktree(workspacePath, worktreePath);
        worktreeProvider.refresh();
        vscode.window.showInformationMessage(`Removed worktree: ${branch}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to remove worktree: ${msg}`);
      }
    }),

    vscode.commands.registerCommand('gw.createWorktree', async () => {
      const branchName = await vscode.window.showInputBox({
        prompt: 'Enter branch name for new worktree',
        placeHolder: 'feature/my-feature',
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
            title: `Creating worktree: ${branchName}`,
            cancellable: false,
          },
          async () => {
            await createWorktree(workspacePath, branchName);
          }
        );
        worktreeProvider.refresh();
        vscode.window.showInformationMessage(`Created worktree: ${branchName}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to create worktree: ${msg}`);
      }
    }),

    vscode.commands.registerCommand('gw.openMarkdown', async (filePath: string) => {
      if (filePath && fs.existsSync(filePath)) {
        await openMarkdownFile(filePath);
      }
    }),

    vscode.commands.registerCommand('gw.openPlan', async (item?: AgentBranchItem) => {
      if (!item?.gwDir) {
        vscode.window.showWarningMessage('Please select an agent task branch first.');
        return;
      }
      const planPath = path.join(item.gwDir, 'plan.md');
      if (fs.existsSync(planPath)) {
        await openMarkdownFile(planPath);
      } else {
        vscode.window.showWarningMessage(`No plan.md found for ${item.branchName}`);
      }
    }),

    vscode.commands.registerCommand('gw.openTask', async (item?: AgentBranchItem) => {
      if (!item?.gwDir) {
        vscode.window.showWarningMessage('Please select an agent task branch first.');
        return;
      }
      const taskPath = path.join(item.gwDir, 'task.md');
      if (fs.existsSync(taskPath)) {
        await openMarkdownFile(taskPath);
      } else {
        vscode.window.showWarningMessage(`No task.md found for ${item.branchName}`);
      }
    }),

    vscode.commands.registerCommand('gw.openWalkthrough', async (item?: AgentBranchItem) => {
      if (!item?.gwDir) {
        vscode.window.showWarningMessage('Please select an agent task branch first.');
        return;
      }
      const wtPath = path.join(item.gwDir, 'walkthrough.md');
      if (fs.existsSync(wtPath)) {
        await openMarkdownFile(wtPath);
      } else {
        vscode.window.showWarningMessage(`No walkthrough.md found for ${item.branchName}`);
      }
    }),

    vscode.commands.registerCommand('gw.clean', async () => {
      const dryRunFirst = await cleanWorktrees(workspacePath, { dryRun: true });
      if (!dryRunFirst || dryRunFirst.includes('No worktrees to clean')) {
        vscode.window.showInformationMessage('No stale worktrees to clean.');
        return;
      }

      const choice = await vscode.window.showWarningMessage(
        'Clean stale worktrees?',
        { modal: true, detail: dryRunFirst },
        'Clean',
        'Force Clean'
      );
      if (!choice) return;

      try {
        await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: 'Cleaning worktrees...' },
          async () => {
            const result = await cleanWorktrees(workspacePath, { force: choice === 'Force Clean' });
            vscode.window.showInformationMessage(result || 'Worktrees cleaned.');
          }
        );
        worktreeProvider.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to clean worktrees: ${msg}`);
      }
    }),

    vscode.commands.registerCommand('gw.sortAgentTasks', async () => {
      const config = vscode.workspace.getConfiguration('gw');
      const currentSortBy = config.get<string>('agentTasksSortBy', 'date');
      const currentSortOrder = config.get<string>('agentTasksSortOrder', 'desc');

      interface SortOption {
        label: string;
        description: string;
        sortBy: 'date' | 'name' | 'status';
        sortOrder: 'asc' | 'desc';
      }

      const options: SortOption[] = [
        {
          label: '$(calendar) Date (newest first)',
          description: 'Most recently modified at top',
          sortBy: 'date',
          sortOrder: 'desc',
        },
        {
          label: '$(calendar) Date (oldest first)',
          description: 'Oldest modified at top',
          sortBy: 'date',
          sortOrder: 'asc',
        },
        {
          label: '$(case-sensitive) Name (A-Z)',
          description: 'Alphabetical ascending',
          sortBy: 'name',
          sortOrder: 'asc',
        },
        {
          label: '$(case-sensitive) Name (Z-A)',
          description: 'Alphabetical descending',
          sortBy: 'name',
          sortOrder: 'desc',
        },
        {
          label: '$(pulse) Status (in-progress first)',
          description: 'Active tasks at top',
          sortBy: 'status',
          sortOrder: 'desc',
        },
        {
          label: '$(pass-filled) Status (completed first)',
          description: 'Completed tasks at top',
          sortBy: 'status',
          sortOrder: 'asc',
        },
      ];

      // Mark current selection
      const currentKey = `${currentSortBy}-${currentSortOrder}`;
      const picks = options.map((opt) => ({
        ...opt,
        picked: `${opt.sortBy}-${opt.sortOrder}` === currentKey,
      }));

      const selected = await vscode.window.showQuickPick(picks, {
        placeHolder: 'Select sort order for Agent Tasks',
        title: 'Sort Agent Tasks',
      });

      if (!selected) return;

      await config.update('agentTasksSortBy', selected.sortBy, vscode.ConfigurationTarget.Workspace);
      await config.update('agentTasksSortOrder', selected.sortOrder, vscode.ConfigurationTarget.Workspace);
      agentTasksProvider.refresh();
    }),

    vscode.commands.registerCommand('gw.sync', async (item?: WorktreeItem) => {
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
            vscode.window.showInformationMessage(result || `Synced to ${target}`);
          }
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to sync: ${msg}`);
      }
    }),
  ];

  // Refresh worktrees when workspace changes
  const workspaceWatcher = vscode.workspace.onDidChangeWorkspaceFolders(() => {
    worktreeProvider.refresh();
    agentTasksProvider.refresh();
  });

  // Push all disposables
  context.subscriptions.push(worktreeView, agentTasksView, artifactWatcher, workspaceWatcher, ...commands);
}

export function deactivate(): void {
  // cleanup handled by disposables
}
