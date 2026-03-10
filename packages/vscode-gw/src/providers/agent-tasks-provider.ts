/**
 * TreeDataProvider for displaying agent task progress from .gw/{branch}/ artifacts
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { parseTaskMd, parsePlanMd, ParsedTask, ParsedPlan } from '../parsers/markdown-parser';

// -- Tree Item Types --

export class AgentBranchItem extends vscode.TreeItem {
  constructor(
    public readonly branchName: string,
    public readonly gwDir: string,
    public readonly task: ParsedTask | undefined,
    public readonly plan: ParsedPlan | undefined,
    public readonly hasWalkthrough: boolean
  ) {
    super(branchName, vscode.TreeItemCollapsibleState.Expanded);

    this.contextValue = hasWalkthrough ? 'agentBranchCompleted' : 'agentBranch';
    this.description = this.getDescription();
    this.tooltip = this.getTooltip();
    this.iconPath = this.getIcon();

    // Click to open task.md (or walkthrough.md if completed)
    const targetFile = hasWalkthrough ? 'walkthrough.md' : 'task.md';
    const filePath = path.join(gwDir, targetFile);
    if (fs.existsSync(filePath)) {
      this.command = {
        command: 'vscode.open',
        title: `Open ${targetFile}`,
        arguments: [vscode.Uri.file(filePath)],
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
      return new vscode.ThemeIcon('pass-filled', new vscode.ThemeColor('charts.green'));
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
        command: 'vscode.open',
        title: 'Open Task',
        arguments: [vscode.Uri.file(taskFilePath)],
      };
    }
  }
}

export class TaskCheckboxItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly completed: boolean,
    public readonly inProgress: boolean,
    public readonly taskFilePath?: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);

    if (inProgress) {
      this.iconPath = new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('charts.blue'));
      this.description = 'in progress';
    } else if (completed) {
      this.iconPath = new vscode.ThemeIcon('pass', new vscode.ThemeColor('charts.green'));
    } else {
      this.iconPath = new vscode.ThemeIcon('circle-large-outline');
    }

    if (taskFilePath) {
      this.command = {
        command: 'vscode.open',
        title: 'Open Task',
        arguments: [vscode.Uri.file(taskFilePath)],
      };
    }
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
      command: 'vscode.open',
      title: 'Open Plan',
      arguments: [vscode.Uri.file(planFilePath)],
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
        command: 'vscode.open',
        title: 'Open Task',
        arguments: [vscode.Uri.file(taskFilePath)],
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
        command: 'vscode.open',
        title: 'Open Task',
        arguments: [vscode.Uri.file(taskFilePath)],
      };
    }
  }
}

type AgentTaskTreeItem =
  | AgentBranchItem
  | TaskGroupItem
  | TaskCheckboxItem
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

    // Group level: show individual task items
    if (element instanceof TaskGroupItem) {
      return element.items;
    }

    // Plan level: show file lists
    if (element instanceof PlanSummaryItem) {
      return this.getPlanChildren(element.plan);
    }

    return [];
  }

  private getBranchItems(): AgentBranchItem[] {
    if (!this.gwRoot) return [];

    const items: AgentBranchItem[] = [];

    try {
      const entries = fs.readdirSync(this.gwRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name === '.git' || entry.name === 'config.json') continue;

        const branchDir = path.join(this.gwRoot, entry.name);
        const taskPath = path.join(branchDir, 'task.md');
        const planPath = path.join(branchDir, 'plan.md');
        const walkthroughPath = path.join(branchDir, 'walkthrough.md');

        let task: ParsedTask | undefined;
        let plan: ParsedPlan | undefined;

        if (fs.existsSync(taskPath)) {
          try {
            task = parseTaskMd(fs.readFileSync(taskPath, 'utf-8'));
          } catch {
            // ignore parse errors
          }
        }

        if (fs.existsSync(planPath)) {
          try {
            plan = parsePlanMd(fs.readFileSync(planPath, 'utf-8'));
          } catch {
            // ignore parse errors
          }
        }

        const hasWalkthrough = fs.existsSync(walkthroughPath);

        items.push(new AgentBranchItem(entry.name, branchDir, task, plan, hasWalkthrough));
      }
    } catch {
      // .gw directory unreadable
    }

    return items;
  }

  private getBranchChildren(branch: AgentBranchItem): AgentTaskTreeItem[] {
    const children: AgentTaskTreeItem[] = [];
    const task = branch.task;
    const taskFilePath = path.join(branch.gwDir, 'task.md');

    if (task) {
      // Current (expanded by default to show what's happening now)
      if (task.current.length > 0) {
        const currentItems = task.current.map(
          (t) => new TaskCheckboxItem(t.label, t.completed, t.inProgress, taskFilePath)
        );
        children.push(
          new TaskGroupItem('Current', 'play', currentItems, vscode.TreeItemCollapsibleState.Expanded, taskFilePath)
        );
      }

      // Completed
      if (task.completed.length > 0) {
        const completedItems = task.completed.map(
          (t) => new TaskCheckboxItem(t.label, t.completed, false, taskFilePath)
        );
        children.push(
          new TaskGroupItem(
            'Completed',
            'pass',
            completedItems,
            vscode.TreeItemCollapsibleState.Collapsed,
            taskFilePath
          )
        );
      }

      // Upcoming
      if (task.upcoming.length > 0) {
        const upcomingItems = task.upcoming.map((t) => new TaskCheckboxItem(t.label, t.completed, false, taskFilePath));
        children.push(
          new TaskGroupItem(
            'Upcoming',
            'circle-large-outline',
            upcomingItems,
            vscode.TreeItemCollapsibleState.Collapsed,
            taskFilePath
          )
        );
      }

      // Blockers
      if (task.blockers.length > 0) {
        const blockerItems = task.blockers.map((b) => new BlockerItem(b, taskFilePath));
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
