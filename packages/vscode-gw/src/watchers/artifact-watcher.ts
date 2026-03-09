/**
 * File system watcher for .gw artifact files
 * Watches for changes to task.md, plan.md, and walkthrough.md
 * Auto-opens walkthrough.md when created, refreshes views on changes
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class ArtifactWatcher implements vscode.Disposable {
  private watchers: vscode.FileSystemWatcher[] = [];
  private disposables: vscode.Disposable[] = [];
  private knownWalkthroughs = new Set<string>();

  private _onArtifactChanged = new vscode.EventEmitter<string>();
  readonly onArtifactChanged = this._onArtifactChanged.event;

  constructor() {
    this.scanExistingWalkthroughs();
    this.setupWatchers();
  }

  private scanExistingWalkthroughs(): void {
    const gwRoot = this.findGwRoot();
    if (!gwRoot) return;

    try {
      const entries = fs.readdirSync(gwRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const wtPath = path.join(gwRoot, entry.name, 'walkthrough.md');
        if (fs.existsSync(wtPath)) {
          this.knownWalkthroughs.add(wtPath);
        }
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

  private setupWatchers(): void {
    // Watch for .gw/**/task.md, plan.md, walkthrough.md
    const patterns = ['**/task.md', '**/plan.md', '**/walkthrough.md'];

    for (const pattern of patterns) {
      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(this.getWatchBase(), `.gw/${pattern}`)
      );

      watcher.onDidChange((uri) => this.onFileChanged(uri));
      watcher.onDidCreate((uri) => this.onFileCreated(uri));
      watcher.onDidDelete((uri) => this.onFileDeleted(uri));

      this.watchers.push(watcher);
    }

    // Also watch for new branch directories
    const dirWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(this.getWatchBase(), '.gw/*')
    );
    dirWatcher.onDidCreate(() => this._onArtifactChanged.fire('directory'));
    dirWatcher.onDidDelete(() => this._onArtifactChanged.fire('directory'));
    this.watchers.push(dirWatcher);
  }

  private getWatchBase(): vscode.Uri {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspacePath) return vscode.Uri.file('/');

    // Walk up to find the actual root (where .gw lives)
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

  private onFileChanged(uri: vscode.Uri): void {
    const filename = path.basename(uri.fsPath);
    this._onArtifactChanged.fire(filename);
  }

  private onFileCreated(uri: vscode.Uri): void {
    const filename = path.basename(uri.fsPath);
    this._onArtifactChanged.fire(filename);

    // Auto-open walkthrough when created
    if (filename === 'walkthrough.md' && !this.knownWalkthroughs.has(uri.fsPath)) {
      this.knownWalkthroughs.add(uri.fsPath);
      const autoOpen = vscode.workspace.getConfiguration('gw').get<boolean>('autoOpenWalkthrough', true);
      if (autoOpen) {
        this.openWalkthrough(uri);
      }
    }
  }

  private onFileDeleted(uri: vscode.Uri): void {
    const filename = path.basename(uri.fsPath);
    this.knownWalkthroughs.delete(uri.fsPath);
    this._onArtifactChanged.fire(filename);
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
    for (const watcher of this.watchers) {
      watcher.dispose();
    }
    for (const d of this.disposables) {
      d.dispose();
    }
    this._onArtifactChanged.dispose();
  }
}
