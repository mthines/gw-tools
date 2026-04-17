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
  private fsWatchers: fs.FSWatcher[] = [];
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
    this.setupWatchers();
  }

  private scanExistingWalkthroughs(): void {
    const gwRoots = this.findGwRoots();
    for (const gwRoot of gwRoots) {
      this.scanWalkthroughsRecursive(gwRoot);
    }
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

  /**
   * Find ALL .gw directories walking up from the workspace root.
   * Watches all roots so artifacts are detected regardless of which
   * .gw/ directory the autonomous workflow created them in.
   */
  private findGwRoots(): string[] {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspacePath) return [];

    const roots: string[] = [];
    let dir = workspacePath;
    for (let i = 0; i < 5; i++) {
      const gwPath = path.join(dir, '.gw');
      if (fs.existsSync(gwPath) && fs.statSync(gwPath).isDirectory()) {
        roots.push(gwPath);
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    return roots;
  }

  private getWatchBases(): vscode.Uri[] {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspacePath) return [];

    const bases: vscode.Uri[] = [];
    let dir = workspacePath;
    for (let i = 0; i < 5; i++) {
      const gwPath = path.join(dir, '.gw');
      if (fs.existsSync(gwPath)) {
        bases.push(vscode.Uri.file(dir));
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    return bases.length > 0 ? bases : [vscode.Uri.file(workspacePath || '/')];
  }

  private setupWatchers(): void {
    const gwRoots = this.findGwRoots();
    if (gwRoots.length === 0) return;

    const platform = os.platform();
    if (platform === 'darwin' || platform === 'win32') {
      for (const gwRoot of gwRoots) {
        this.setupNativeWatcher(gwRoot);
      }
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
      const watcher = fs.watch(gwRoot, { recursive: true }, (eventType, filename) => {
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

      watcher.on('error', () => {
        // Silently ignore — watcher will stop but extension continues
      });

      this.fsWatchers.push(watcher);
    } catch {
      // If fs.watch fails for this root, fall back to VS Code watchers
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
    const watchBases = this.getWatchBases();

    for (const base of watchBases) {
      for (const pattern of patterns) {
        const watcher = vscode.workspace.createFileSystemWatcher(
          new vscode.RelativePattern(base, `.gw/${pattern}`)
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
        new vscode.RelativePattern(base, '.gw/**')
      );
      dirWatcher.onDidCreate(() => this._onArtifactChanged.fire('directory'));
      dirWatcher.onDidDelete(() => this._onArtifactChanged.fire('directory'));
      this.vscodeWatchers.push(dirWatcher);
    }
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
      const usePreview = vscode.workspace.getConfiguration('gw').get<boolean>('openMarkdownInPreview', true);
      if (usePreview) {
        await vscode.commands.executeCommand('markdown.showPreview', uri);
      } else {
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, {
          preview: false,
          viewColumn: vscode.ViewColumn.One,
        });
      }
      vscode.window.showInformationMessage(`Walkthrough generated: ${path.basename(path.dirname(uri.fsPath))}`);
    } catch {
      // ignore open errors
    }
  }

  dispose(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    for (const watcher of this.fsWatchers) {
      watcher.close();
    }
    for (const watcher of this.vscodeWatchers) {
      watcher.dispose();
    }
    this._onArtifactChanged.dispose();
  }
}
