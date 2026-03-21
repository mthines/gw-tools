/**
 * File system watcher for git worktree changes
 * Watches git internal files to detect worktree additions, removals,
 * and branch changes, triggering sidebar refresh in near real-time.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class WorktreeWatcher implements vscode.Disposable {
  private watchers: vscode.FileSystemWatcher[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  /** Timestamp until which new events are ignored (prevents feedback loops) */
  private cooldownUntil = 0;
  private static COOLDOWN_MS = 3000;

  private _onWorktreeChanged = new vscode.EventEmitter<void>();
  readonly onWorktreeChanged = this._onWorktreeChanged.event;

  constructor() {
    this.setupWatchers();
  }

  private setupWatchers(): void {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspacePath) return;

    const gitCommonDir = this.getGitCommonDir(workspacePath);
    if (!gitCommonDir) return;

    const gitCommonUri = vscode.Uri.file(gitCommonDir);

    // Watch worktrees/ directory for worktree add/remove
    // Only listen for create/delete — NOT change. Internal worktree file changes
    // (HEAD, index, COMMIT_EDITMSG, etc.) happen constantly during agent work
    // but don't affect the worktree list (branch names, paths).
    const worktreesDir = path.join(gitCommonDir, 'worktrees');
    if (fs.existsSync(worktreesDir)) {
      const wtWatcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(gitCommonUri, 'worktrees/**')
      );
      wtWatcher.onDidCreate(() => this.emitDebounced());
      wtWatcher.onDidDelete(() => this.emitDebounced());
      this.watchers.push(wtWatcher);
    }

    // Watch refs/heads/ for branch creation/deletion
    const refsWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(gitCommonUri, 'refs/heads/**')
    );
    refsWatcher.onDidCreate(() => this.emitDebounced());
    refsWatcher.onDidDelete(() => this.emitDebounced());
    this.watchers.push(refsWatcher);

    // Watch HEAD for current branch changes
    const headWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(gitCommonUri, 'HEAD'));
    headWatcher.onDidChange(() => this.emitDebounced());
    this.watchers.push(headWatcher);

    // Watch .gw/config.json for config changes (e.g. default branch)
    const gwRoot = this.findGwRoot(workspacePath);
    if (gwRoot) {
      const configWatcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(vscode.Uri.file(gwRoot), '.gw/config.json')
      );
      configWatcher.onDidChange(() => this.emitDebounced());
      this.watchers.push(configWatcher);
    }
  }

  private emitDebounced(): void {
    // During cooldown, drop events entirely. This prevents feedback loops
    // where the refresh commands (git worktree list, gw clean --json) touch
    // .git/worktrees/ files, which would re-trigger the watcher.
    if (Date.now() < this.cooldownUntil) {
      return;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      // Start cooldown before firing so events from the refresh are ignored
      this.cooldownUntil = Date.now() + WorktreeWatcher.COOLDOWN_MS;
      this._onWorktreeChanged.fire();
    }, 1000);
  }

  private getGitCommonDir(workspacePath: string): string | undefined {
    try {
      // Check if .git is a file (worktree) or directory (main repo)
      const gitPath = path.join(workspacePath, '.git');
      if (!fs.existsSync(gitPath)) {
        // Could be a bare repo - check if it looks like a git dir
        if (fs.existsSync(path.join(workspacePath, 'HEAD'))) {
          return workspacePath;
        }
        return undefined;
      }

      const stat = fs.statSync(gitPath);
      if (stat.isDirectory()) {
        // Regular repo - .git is the git dir, check for commondir
        const commonDirFile = path.join(gitPath, 'commondir');
        if (fs.existsSync(commonDirFile)) {
          const relative = fs.readFileSync(commonDirFile, 'utf-8').trim();
          return path.resolve(gitPath, relative);
        }
        return gitPath;
      }

      // .git is a file (worktree link) - read the gitdir path
      const content = fs.readFileSync(gitPath, 'utf-8').trim();
      const match = content.match(/^gitdir:\s*(.+)$/);
      if (!match) return undefined;

      const gitDir = path.resolve(workspacePath, match[1]);
      // The gitdir points to .git/worktrees/<name>, go up to common dir
      const commonDirFile = path.join(gitDir, 'commondir');
      if (fs.existsSync(commonDirFile)) {
        const relative = fs.readFileSync(commonDirFile, 'utf-8').trim();
        return path.resolve(gitDir, relative);
      }
      return gitDir;
    } catch {
      return undefined;
    }
  }

  private findGwRoot(workspacePath: string): string | undefined {
    let dir = workspacePath;
    for (let i = 0; i < 5; i++) {
      if (fs.existsSync(path.join(dir, '.gw'))) {
        return dir;
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    return undefined;
  }

  dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    for (const watcher of this.watchers) {
      watcher.dispose();
    }
    this._onWorktreeChanged.dispose();
  }
}
