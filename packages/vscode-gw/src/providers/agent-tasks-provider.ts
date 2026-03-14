/**
 * TreeDataProvider for displaying agent task progress from .gw/{branch}/ artifacts
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { parseTaskMd, parsePlanMd, ParsedTask, ParsedPlan, TaskItem } from '../parsers/markdown-parser';

// -- Tree Item Types --

export class AgentBranchItem extends vscode.TreeItem {
  constructor(
    public readonly branchName: string,
    public readonly gwDir: string,
    public readonly task: ParsedTask | undefined,
    public readonly plan: ParsedPlan | undefined,
    public readonly hasWalkthrough: boolean
  ) {
    super(branchName, vscode.TreeItemCollapsibleState.Collapsed);

    this.contextValue = hasWalkthrough ? 'agentBranchCompleted' : 'agentBranch';
    this.description = this.getDescription();
    this.tooltip = this.getTooltip();
    this.iconPath = this.getIcon();

    // Click to open task.md (or walkthrough.md if completed)
    const targetFile = hasWalkthrough ? 'walkthrough.md' : 'task.md';
    const filePath = path.join(gwDir, targetFile);
    if (fs.existsSync(filePath)) {
      this.command = {
        command: 'gw.openMarkdown',
        title: `Open ${targetFile}`,
        arguments: [filePath],
      };
    }
  }

  private getDescription(): string {
    if (this.hasWalkthrough) return 'completed';
    if (this.task?.phase && this.task.phaseName) {
      return `Phase ${this.task.phase} · ${this.task.phaseName}`;
    }
    return '';
  }

  private getTooltip(): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**Branch:** \`${this.branchName}\`\n\n`);
    if (this.task?.frontmatter.task) {
      md.appendMarkdown(`**Task:** ${this.task.frontmatter.task}\n\n`);
    }
    if (this.plan?.summary) {
      md.appendMarkdown(`**Plan:** ${this.plan.summary}\n\n`);
    }
    if (this.hasWalkthrough) {
      md.appendMarkdown('$(check) **Completed** - walkthrough available');
    }
    return md;
  }

  private getIcon(): vscode.ThemeIcon {
    if (this.hasWalkthrough) {
      // Completed branches use dimmer icon (no color = default gray)
      return new vscode.ThemeIcon('pass-filled');
    }
    if (this.task?.blockers && this.task.blockers.length > 0) {
      return new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow'));
    }
    return new vscode.ThemeIcon('rocket', new vscode.ThemeColor('charts.blue'));
  }
}

export class TaskGroupItem extends vscode.TreeItem {
  constructor(
    public readonly groupLabel: string,
    public readonly groupIcon: string,
    public readonly items: TaskCheckboxItem[],
    collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.Collapsed,
    public readonly taskFilePath?: string
  ) {
    super(groupLabel, collapsibleState);
    this.iconPath = new vscode.ThemeIcon(groupIcon);
    this.description = `${items.length}`;

    if (taskFilePath) {
      this.command = {
        command: 'gw.openMarkdown',
        title: 'Open Task',
        arguments: [taskFilePath],
      };
    }
  }
}

export class TaskCheckboxItem extends vscode.TreeItem {
  public readonly childItems: TaskCheckboxItem[];

  constructor(
    label: string,
    public readonly completed: boolean,
    public readonly inProgress: boolean,
    public readonly taskFilePath?: string,
    children: TaskCheckboxItem[] = []
  ) {
    super(label, children.length > 0 ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None);
    this.childItems = children;

    if (inProgress) {
      this.iconPath = new vscode.ThemeIcon('pulse', new vscode.ThemeColor('charts.blue'));
      this.description = 'in progress';
    } else if (completed) {
      this.iconPath = new vscode.ThemeIcon('pass', new vscode.ThemeColor('charts.green'));
    } else {
      this.iconPath = new vscode.ThemeIcon('circle-large-outline');
    }

    if (taskFilePath) {
      this.command = {
        command: 'gw.openMarkdown',
        title: 'Open Task',
        arguments: [taskFilePath],
      };
    }
  }
}

export class TasksSummaryItem extends vscode.TreeItem {
  constructor(
    public readonly currentItems: TaskCheckboxItem[],
    public readonly completedItems: TaskCheckboxItem[],
    public readonly upcomingItems: TaskCheckboxItem[],
    public readonly blockerItems: BlockerItem[],
    public readonly taskFilePath: string
  ) {
    super('Tasks', vscode.TreeItemCollapsibleState.Expanded);
    this.iconPath = new vscode.ThemeIcon('tasklist');

    // Bubble up current task status
    const inProgressTask = currentItems.find((t) => t.inProgress);
    if (inProgressTask) {
      this.description = inProgressTask.label as string;
    } else if (currentItems.length > 0) {
      this.description = `${currentItems.length} current`;
    } else if (upcomingItems.length > 0) {
      this.description = `${upcomingItems.length} upcoming`;
    } else {
      this.description = `${completedItems.length} completed`;
    }

    this.command = {
      command: 'gw.openMarkdown',
      title: 'Open Task',
      arguments: [taskFilePath],
    };
  }
}

export class PlanSummaryItem extends vscode.TreeItem {
  constructor(
    public readonly plan: ParsedPlan,
    public readonly planFilePath: string
  ) {
    super('Plan', vscode.TreeItemCollapsibleState.Collapsed);
    this.iconPath = new vscode.ThemeIcon('notebook');
    this.description = plan.complexity || '';
    this.command = {
      command: 'gw.openMarkdown',
      title: 'Open Plan',
      arguments: [planFilePath],
    };
  }
}

export class DecisionItem extends vscode.TreeItem {
  constructor(decision: string, rationale: string, phase: string, taskFilePath?: string) {
    super(decision, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon('lightbulb');
    this.description = `Phase ${phase}`;
    this.tooltip = new vscode.MarkdownString(`**${decision}**\n\n${rationale}\n\n*Phase ${phase}*`);

    if (taskFilePath) {
      this.command = {
        command: 'gw.openMarkdown',
        title: 'Open Task',
        arguments: [taskFilePath],
      };
    }
  }
}

export class BlockerItem extends vscode.TreeItem {
  constructor(blocker: string, taskFilePath?: string) {
    super(blocker, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));

    if (taskFilePath) {
      this.command = {
        command: 'gw.openMarkdown',
        title: 'Open Task',
        arguments: [taskFilePath],
      };
    }
  }
}

type AgentTaskTreeItem =
  | AgentBranchItem
  | TaskGroupItem
  | TaskCheckboxItem
  | TasksSummaryItem
  | PlanSummaryItem
  | DecisionItem
  | BlockerItem;

// -- Provider --

export class AgentTasksProvider implements vscode.TreeDataProvider<AgentTaskTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<AgentTaskTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private gwRoot: string | undefined;

  constructor() {
    this.gwRoot = this.findGwRoot();
  }

  refresh(): void {
    this.gwRoot = this.findGwRoot();
    this._onDidChangeTreeData.fire();
  }

  private findGwRoot(): string | undefined {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspacePath) return undefined;

    // Walk up to find .gw directory (might be in parent for worktrees)
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

  getTreeItem(element: AgentTaskTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: AgentTaskTreeItem): Promise<AgentTaskTreeItem[]> {
    if (!this.gwRoot) {
      return [];
    }

    // Root level: list branch directories
    if (!element) {
      return this.getBranchItems();
    }

    // Branch level: show task groups, plan, decisions, blockers
    if (element instanceof AgentBranchItem) {
      return this.getBranchChildren(element);
    }

    // Tasks summary level: show task groups (Current, Completed, Upcoming)
    if (element instanceof TasksSummaryItem) {
      return this.getTasksSummaryChildren(element);
    }

    // Group level: show individual task items
    if (element instanceof TaskGroupItem) {
      return element.items;
    }

    // Checkbox level: show children if any
    if (element instanceof TaskCheckboxItem) {
      return element.childItems;
    }

    // Plan level: show file lists
    if (element instanceof PlanSummaryItem) {
      return this.getPlanChildren(element.plan);
    }

    return [];
  }

  /**
   * Recursively find directories containing task.md, plan.md, or walkthrough.md.
   * Returns paths relative to gwRoot for each leaf directory with artifacts.
   */
  private findBranchDirs(dir: string, relativePath = ''): string[] {
    const results: string[] = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      // Check if this directory itself has artifacts
      const hasArtifact = entries.some(
        (e) => !e.isDirectory() && (e.name === 'task.md' || e.name === 'plan.md' || e.name === 'walkthrough.md')
      );
      if (hasArtifact && relativePath) {
        results.push(relativePath);
      }

      // Recurse into subdirectories
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name === '.git' || entry.name === 'config.json') continue;
        const childRelative = relativePath ? `${relativePath}/${entry.name}` : entry.name;
        results.push(...this.findBranchDirs(path.join(dir, entry.name), childRelative));
      }
    } catch {
      // directory unreadable
    }
    return results;
  }

  private getBranchItems(): AgentBranchItem[] {
    if (!this.gwRoot) return [];

    interface BranchItemWithMeta {
      item: AgentBranchItem;
      mtime: number;
      name: string;
      hasWalkthrough: boolean;
      hasInProgress: boolean;
    }

    const items: BranchItemWithMeta[] = [];
    const branchRelPaths = this.findBranchDirs(this.gwRoot);

    for (const relPath of branchRelPaths) {
      const branchDir = path.join(this.gwRoot, relPath);
      const taskPath = path.join(branchDir, 'task.md');
      const planPath = path.join(branchDir, 'plan.md');
      const walkthroughPath = path.join(branchDir, 'walkthrough.md');

      const hasTaskFile = fs.existsSync(taskPath);
      const hasPlanFile = fs.existsSync(planPath);
      if (!hasTaskFile && !hasPlanFile) {
        continue;
      }

      let task: ParsedTask | undefined;
      let plan: ParsedPlan | undefined;
      let latestMtime = 0;

      if (hasTaskFile) {
        try {
          task = parseTaskMd(fs.readFileSync(taskPath, 'utf-8'));
          const stat = fs.statSync(taskPath);
          latestMtime = Math.max(latestMtime, stat.mtimeMs);
        } catch {
          // ignore parse errors
        }
      }

      if (hasPlanFile) {
        try {
          plan = parsePlanMd(fs.readFileSync(planPath, 'utf-8'));
          const stat = fs.statSync(planPath);
          latestMtime = Math.max(latestMtime, stat.mtimeMs);
        } catch {
          // ignore parse errors
        }
      }

      const hasWalkthrough = fs.existsSync(walkthroughPath);
      if (hasWalkthrough) {
        try {
          const stat = fs.statSync(walkthroughPath);
          latestMtime = Math.max(latestMtime, stat.mtimeMs);
        } catch {
          // ignore stat errors
        }
      }

      // Check if any task is in progress
      const hasInProgress = task?.current.some((t) => t.inProgress) ?? false;

      items.push({
        item: new AgentBranchItem(relPath, branchDir, task, plan, hasWalkthrough),
        mtime: latestMtime,
        name: relPath.toLowerCase(),
        hasWalkthrough,
        hasInProgress,
      });
    }

    // Get sort settings from configuration
    const config = vscode.workspace.getConfiguration('gw');
    const sortBy = config.get<string>('agentTasksSortBy', 'date');
    const sortOrder = config.get<string>('agentTasksSortOrder', 'desc');
    const isAsc = sortOrder === 'asc';

    // Sort based on settings
    items.sort((a, b) => {
      let result = 0;

      switch (sortBy) {
        case 'name':
          result = a.name.localeCompare(b.name);
          break;
        case 'status': {
          // Status priority: in-progress > active (not completed) > completed
          const statusA = a.hasInProgress ? 2 : a.hasWalkthrough ? 0 : 1;
          const statusB = b.hasInProgress ? 2 : b.hasWalkthrough ? 0 : 1;
          result = statusB - statusA; // Higher priority first by default (desc)
          break;
        }
        case 'date':
        default:
          result = b.mtime - a.mtime; // Newer first by default (desc)
          break;
      }

      return isAsc ? -result : result;
    });

    return items.map((i) => i.item);
  }

  private taskItemToCheckbox(t: TaskItem, taskFilePath: string): TaskCheckboxItem {
    const children = t.children.map((c) => this.taskItemToCheckbox(c, taskFilePath));
    return new TaskCheckboxItem(t.label, t.completed, t.inProgress, taskFilePath, children);
  }

  private getBranchChildren(branch: AgentBranchItem): AgentTaskTreeItem[] {
    const children: AgentTaskTreeItem[] = [];
    const task = branch.task;
    const taskFilePath = path.join(branch.gwDir, 'task.md');

    if (task) {
      // Build task items for the summary (preserving hierarchy)
      const currentItems = task.current.map((t) => this.taskItemToCheckbox(t, taskFilePath));
      const completedItems = task.completed.map((t) => this.taskItemToCheckbox(t, taskFilePath));
      const upcomingItems = task.upcoming.map((t) => this.taskItemToCheckbox(t, taskFilePath));
      const blockerItems = task.blockers.map((b) => new BlockerItem(b, taskFilePath));

      // Add Tasks summary (groups Current/Completed/Upcoming inside)
      children.push(new TasksSummaryItem(currentItems, completedItems, upcomingItems, blockerItems, taskFilePath));

      // Blockers shown at branch level for visibility
      if (task.blockers.length > 0) {
        children.push(
          new TaskGroupItem(
            'Blockers',
            'error',
            blockerItems as unknown as TaskCheckboxItem[],
            vscode.TreeItemCollapsibleState.Expanded,
            taskFilePath
          )
        );
      }

      // Decisions
      if (task.decisions.length > 0) {
        const decisionItems = task.decisions.map(
          (d) => new DecisionItem(d.decision, d.rationale, d.phase, taskFilePath)
        );
        children.push(
          new TaskGroupItem(
            'Decisions',
            'lightbulb',
            decisionItems as unknown as TaskCheckboxItem[],
            vscode.TreeItemCollapsibleState.Collapsed,
            taskFilePath
          )
        );
      }
    }

    // Plan
    if (branch.plan) {
      const planPath = path.join(branch.gwDir, 'plan.md');
      children.push(new PlanSummaryItem(branch.plan, planPath));
    }

    return children;
  }

  private getTasksSummaryChildren(summary: TasksSummaryItem): AgentTaskTreeItem[] {
    const children: AgentTaskTreeItem[] = [];

    // Current (expanded by default)
    if (summary.currentItems.length > 0) {
      children.push(
        new TaskGroupItem(
          'Current',
          'play',
          summary.currentItems,
          vscode.TreeItemCollapsibleState.Expanded,
          summary.taskFilePath
        )
      );
    }

    // Completed
    if (summary.completedItems.length > 0) {
      children.push(
        new TaskGroupItem(
          'Completed',
          'pass',
          summary.completedItems,
          vscode.TreeItemCollapsibleState.Collapsed,
          summary.taskFilePath
        )
      );
    }

    // Upcoming
    if (summary.upcomingItems.length > 0) {
      children.push(
        new TaskGroupItem(
          'Upcoming',
          'circle-large-outline',
          summary.upcomingItems,
          vscode.TreeItemCollapsibleState.Collapsed,
          summary.taskFilePath
        )
      );
    }

    return children;
  }

  private getPlanChildren(plan: ParsedPlan): AgentTaskTreeItem[] {
    const children: AgentTaskTreeItem[] = [];

    if (plan.goal) {
      const goalItem = new vscode.TreeItem(plan.goal, vscode.TreeItemCollapsibleState.None);
      goalItem.iconPath = new vscode.ThemeIcon('target');
      children.push(goalItem as AgentTaskTreeItem);
    }

    for (const file of plan.filesToCreate) {
      const item = new vscode.TreeItem(file.file, vscode.TreeItemCollapsibleState.None);
      item.description = file.purpose;
      item.iconPath = new vscode.ThemeIcon('new-file', new vscode.ThemeColor('charts.green'));
      children.push(item as AgentTaskTreeItem);
    }

    for (const file of plan.filesToModify) {
      const item = new vscode.TreeItem(file.file, vscode.TreeItemCollapsibleState.None);
      item.description = file.change;
      item.iconPath = new vscode.ThemeIcon('edit', new vscode.ThemeColor('charts.yellow'));
      children.push(item as AgentTaskTreeItem);
    }

    return children;
  }
}
