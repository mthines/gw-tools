/**
 * TreeDataProvider for displaying git worktrees in the sidebar
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { listWorktrees, WorktreeInfo } from '../parsers/git-worktree';

export class WorktreeItem extends vscode.TreeItem {
  constructor(
    public readonly worktree: WorktreeInfo,
    public readonly isCurrentWorktree: boolean
  ) {
    super(worktree.branch || path.basename(worktree.path), vscode.TreeItemCollapsibleState.None);

    this.contextValue = worktree.bare ? 'bareWorktree' : 'worktree';
    this.description = this.getDescription();
    this.tooltip = this.getTooltip();
    this.iconPath = this.getIcon();

    if (!worktree.bare) {
      this.command = {
        command: 'gw.openWorktreeInCurrentWindow',
        title: 'Open Worktree',
        arguments: [this],
      };
    }
  }

  private getDescription(): string {
    const parts: string[] = [];
    if (this.isCurrentWorktree) {
      parts.push('current');
    }
    if (this.worktree.bare) {
      parts.push('bare');
    }
    const shortPath = this.worktree.path.replace(/^.*\//, '');
    if (shortPath !== this.worktree.branch) {
      parts.push(shortPath);
    }
    return parts.join(' · ');
  }

  private getTooltip(): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**Branch:** \`${this.worktree.branch}\`\n\n`);
    md.appendMarkdown(`**Path:** \`${this.worktree.path}\`\n\n`);
    md.appendMarkdown(`**HEAD:** \`${this.worktree.head.substring(0, 8)}\`\n\n`);
    if (this.isCurrentWorktree) {
      md.appendMarkdown('*$(check) Current worktree*');
    }
    return md;
  }

  private getIcon(): vscode.ThemeIcon {
    if (this.worktree.bare) {
      return new vscode.ThemeIcon('repo');
    }
    if (this.isCurrentWorktree) {
      return new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'));
    }
    return new vscode.ThemeIcon('git-branch');
  }
}

export class WorktreeProvider implements vscode.TreeDataProvider<WorktreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<WorktreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private worktrees: WorktreeInfo[] = [];
  private currentWorkspacePath: string | undefined;

  constructor() {
    this.currentWorkspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: WorktreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<WorktreeItem[]> {
    const cwd = this.currentWorkspacePath;
    if (!cwd) {
      return [];
    }

    try {
      this.worktrees = await listWorktrees(cwd);
    } catch {
      return [];
    }

    const showBare = vscode.workspace.getConfiguration('gw').get<boolean>('showBareWorktree', false);

    return this.worktrees
      .filter((wt) => showBare || !wt.bare)
      .map((wt) => {
        const isCurrent = wt.path === this.currentWorkspacePath;
        return new WorktreeItem(wt, isCurrent);
      });
  }
}
