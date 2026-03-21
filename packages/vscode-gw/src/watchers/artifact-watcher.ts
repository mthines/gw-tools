/**
 * File system watcher for .gw artifact files
 * Watches for changes to task.md, plan.md, and walkthrough.md
 * Auto-opens walkthrough.md when created, refreshes views on changes
 *
 * Uses Node.js fs.watch instead of vscode.workspace.createFileSystemWatcher
 * because .gw/ lives in the bare repo root which is outside the VS Code
 * workspace folder. VS Code file watchers are unreliable for paths outside
 * the workspace boundary.
 *
 * On Linux (where fs.watch recursive is unsupported), falls back to
 * VS Code file watchers as a best-effort approach.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const ARTIFACT_FILES = new Set(['task.md', 'plan.md', 'walkthrough.md']);

export class ArtifactWatcher implements vscode.Disposable {
  private fsWatcher: fs.FSWatcher | undefined;
  private vscodeWatchers: vscode.FileSystemWatcher[] = [];
  private knownWalkthroughs = new Set<string>();
  /** Per-file debounce timers so simultaneous changes to different files fire independently */
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** Small debounce to coalesce rapid writes to the same file (e.g. editor save) */
  private static DEBOUNCE_MS = 150;

  private _onArtifactChanged = new vscode.EventEmitter<string>();
  readonly onArtifactChanged = this._onArtifactChanged.event;

  constructor() {
    this.scanExistingWalkthroughs();
    this.setupWatcher();
  }

  private scanExistingWalkthroughs(): void {
    const gwRoot = this.findGwRoot();
    if (!gwRoot) return;
    this.scanWalkthroughsRecursive(gwRoot);
  }

  private scanWalkthroughsRecursive(dir: string): void {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          if (entry.name === 'walkthrough.md') {
            this.knownWalkthroughs.add(path.join(dir, entry.name));
          }
          continue;
        }
        if (entry.name === '.git') continue;
        this.scanWalkthroughsRecursive(path.join(dir, entry.name));
      }
    } catch {
      // ignore
    }
  }

  private findGwRoot(): string | undefined {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspacePath) return undefined;

    let dir = workspacePath;
    for (let i = 0; i < 5; i++) {
      const gwPath = path.join(dir, '.gw');
      if (fs.existsSync(gwPath) && fs.statSync(gwPath).isDirectory()) {
        return gwPath;
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    return undefined;
  }

  private getWatchBase(): vscode.Uri {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspacePath) return vscode.Uri.file('/');

    let dir = workspacePath;
    for (let i = 0; i < 5; i++) {
      const gwPath = path.join(dir, '.gw');
      if (fs.existsSync(gwPath)) {
        return vscode.Uri.file(dir);
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }

    return vscode.Uri.file(workspacePath);
  }

  private setupWatcher(): void {
    const gwRoot = this.findGwRoot();
    if (!gwRoot) return;

    // fs.watch with recursive: true works reliably on macOS and Windows
    // but is not supported on Linux. Fall back to VS Code watchers there.
    const platform = os.platform();
    if (platform === 'darwin' || platform === 'win32') {
      this.setupNativeWatcher(gwRoot);
    } else {
      this.setupVscodeWatchers();
    }
  }

  /**
   * Native fs.watch — watches .gw/ directly, bypassing VS Code's
   * workspace-boundary limitation for file system watchers.
   */
  private setupNativeWatcher(gwRoot: string): void {
    try {
      this.fsWatcher = fs.watch(gwRoot, { recursive: true }, (eventType, filename) => {
        if (!filename) return;

        const basename = path.basename(filename);

        if (ARTIFACT_FILES.has(basename)) {
          const fullPath = path.join(gwRoot, filename);
          this.emitDebounced(fullPath, basename, eventType);
        } else {
          // Directory or non-artifact file change — could be a new branch dir
          this._onArtifactChanged.fire('directory');
        }
      });

      this.fsWatcher.on('error', () => {
        // Silently ignore — watcher will stop but extension continues
      });
    } catch {
      // If fs.watch fails, fall back to VS Code watchers
      this.setupVscodeWatchers();
    }
  }

  /**
   * VS Code file watchers — fallback for Linux where fs.watch recursive
   * is unsupported. Less reliable for paths outside the workspace but
   * better than no watching at all.
   */
  private setupVscodeWatchers(): void {
    const patterns = ['**/task.md', '**/plan.md', '**/walkthrough.md'];

    for (const pattern of patterns) {
      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(this.getWatchBase(), `.gw/${pattern}`)
      );

      watcher.onDidChange((uri) => {
        const basename = path.basename(uri.fsPath);
        this.emitDebounced(uri.fsPath, basename, 'change');
      });
      watcher.onDidCreate((uri) => {
        const basename = path.basename(uri.fsPath);
        this.emitDebounced(uri.fsPath, basename, 'rename');
      });
      watcher.onDidDelete((uri) => {
        const basename = path.basename(uri.fsPath);
        this.onFileDeleted(uri.fsPath, basename);
      });

      this.vscodeWatchers.push(watcher);
    }

    // Watch for new branch directories
    const dirWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(this.getWatchBase(), '.gw/**')
    );
    dirWatcher.onDidCreate(() => this._onArtifactChanged.fire('directory'));
    dirWatcher.onDidDelete(() => this._onArtifactChanged.fire('directory'));
    this.vscodeWatchers.push(dirWatcher);
  }

  /**
   * Per-file debounce — coalesces rapid writes to the same file while
   * letting changes to different files fire independently.
   */
  private emitDebounced(fullPath: string, basename: string, eventType: string): void {
    const existing = this.debounceTimers.get(fullPath);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(fullPath);

      if (eventType === 'rename') {
        // 'rename' means create or delete
        if (fs.existsSync(fullPath)) {
          this.onFileCreated(fullPath, basename);
        } else {
          this.onFileDeleted(fullPath, basename);
        }
      } else {
        // 'change' — file content modified
        this._onArtifactChanged.fire(basename);
      }
    }, ArtifactWatcher.DEBOUNCE_MS);

    this.debounceTimers.set(fullPath, timer);
  }

  private onFileCreated(fullPath: string, basename: string): void {
    this._onArtifactChanged.fire(basename);

    // Auto-open walkthrough when created
    if (basename === 'walkthrough.md' && !this.knownWalkthroughs.has(fullPath)) {
      this.knownWalkthroughs.add(fullPath);
      const autoOpen = vscode.workspace.getConfiguration('gw').get<boolean>('autoOpenWalkthrough', true);
      if (autoOpen) {
        this.openWalkthrough(vscode.Uri.file(fullPath));
      }
    }
  }

  private onFileDeleted(fullPath: string, basename: string): void {
    this.knownWalkthroughs.delete(fullPath);
    this._onArtifactChanged.fire(basename);
  }

  private async openWalkthrough(uri: vscode.Uri): Promise<void> {
    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc, {
        preview: false,
        viewColumn: vscode.ViewColumn.One,
      });
      vscode.window.showInformationMessage(`Walkthrough generated: ${path.basename(path.dirname(uri.fsPath))}`);
    } catch {
      // ignore open errors
    }
  }

  dispose(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    if (this.fsWatcher) {
      this.fsWatcher.close();
    }
    for (const watcher of this.vscodeWatchers) {
      watcher.dispose();
    }
    this._onArtifactChanged.dispose();
  }
}
