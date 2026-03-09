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

    vscode.commands.registerCommand('gw.openWorktree', async (item: WorktreeItem) => {
      const uri = vscode.Uri.file(item.worktree.path);
      await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: true });
    }),

    vscode.commands.registerCommand('gw.openWorktreeInCurrentWindow', async (item: WorktreeItem) => {
      const uri = vscode.Uri.file(item.worktree.path);
      await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: false });
    }),

    vscode.commands.registerCommand('gw.removeWorktree', async (item: WorktreeItem) => {
      const branch = item.worktree.branch;
      const confirm = await vscode.window.showWarningMessage(`Remove worktree "${branch}"?`, { modal: true }, 'Remove');
      if (confirm !== 'Remove') return;

      try {
        await removeWorktree(workspacePath, item.worktree.path);
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

    vscode.commands.registerCommand('gw.openPlan', (item: AgentBranchItem) => {
      const planPath = path.join(item.gwDir, 'plan.md');
      if (fs.existsSync(planPath)) {
        vscode.commands.executeCommand('vscode.open', vscode.Uri.file(planPath));
      } else {
        vscode.window.showWarningMessage(`No plan.md found for ${item.branchName}`);
      }
    }),

    vscode.commands.registerCommand('gw.openTask', (item: AgentBranchItem) => {
      const taskPath = path.join(item.gwDir, 'task.md');
      if (fs.existsSync(taskPath)) {
        vscode.commands.executeCommand('vscode.open', vscode.Uri.file(taskPath));
      } else {
        vscode.window.showWarningMessage(`No task.md found for ${item.branchName}`);
      }
    }),

    vscode.commands.registerCommand('gw.openWalkthrough', (item: AgentBranchItem) => {
      const wtPath = path.join(item.gwDir, 'walkthrough.md');
      if (fs.existsSync(wtPath)) {
        vscode.commands.executeCommand('vscode.open', vscode.Uri.file(wtPath));
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

    vscode.commands.registerCommand('gw.sync', async (item?: WorktreeItem) => {
      let target = item?.worktree.branch;

      if (!target) {
        // Show picker with available worktrees
        const worktrees = await listWorktrees(workspacePath);
        const picks = worktrees
          .filter((w) => !w.bare)
          .map((w) => ({ label: w.branch, description: w.path }));

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
