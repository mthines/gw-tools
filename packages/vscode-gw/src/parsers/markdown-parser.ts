/**
 * Parsers for the .gw artifact markdown files (task.md, plan.md, walkthrough.md)
 */

export interface TaskFrontmatter {
  created?: string;
  branch?: string;
  task?: string;
}

export interface TaskItem {
  label: string;
  completed: boolean;
  inProgress: boolean;
}

export interface TaskDecision {
  decision: string;
  rationale: string;
  phase: string;
}

export interface ParsedTask {
  frontmatter: TaskFrontmatter;
  phase?: string;
  phaseName?: string;
  lastUpdated?: string;
  completed: TaskItem[];
  current: TaskItem[];
  upcoming: TaskItem[];
  decisions: TaskDecision[];
  discoveries: string[];
  blockers: string[];
}

export interface PlanFrontmatter {
  created?: string;
  branch?: string;
  task?: string;
  approved?: boolean;
}

export interface ParsedPlan {
  frontmatter: PlanFrontmatter;
  summary?: string;
  goal?: string;
  filesToCreate: Array<{ file: string; purpose: string }>;
  filesToModify: Array<{ file: string; change: string }>;
  complexity?: string;
}

export interface WalkthroughFrontmatter {
  created?: string;
  branch?: string;
  task?: string;
  pr?: string;
}

export interface ParsedWalkthrough {
  frontmatter: WalkthroughFrontmatter;
  summary?: string;
  filesChanged: Array<{ file: string; change: string; purpose: string }>;
  branch?: string;
  pr?: string;
  worktreePath?: string;
}

function parseFrontmatter(content: string): { frontmatter: Record<string, string>; body: string } {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const frontmatter: Record<string, string> = {};
  const lines = match[1].split('\n');
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.substring(0, colonIdx).trim();
      const value = line.substring(colonIdx + 1).trim();
      frontmatter[key] = value;
    }
  }

  return { frontmatter, body: match[2] };
}

function extractSection(body: string, heading: string): string {
  const regex = new RegExp(`^## ${heading}\\s*\\n([\\s\\S]*?)(?=^## |$)`, 'm');
  const match = body.match(regex);
  return match ? match[1].trim() : '';
}

function parseCheckboxItems(section: string): TaskItem[] {
  const items: TaskItem[] = [];
  const lines = section.split('\n');
  for (const line of lines) {
    const match = line.match(/^[-*]\s+\[([ xX])\]\s+(.+)/);
    if (match) {
      const completed = match[1].toLowerCase() === 'x';
      let label = match[2].trim();
      const inProgress = label.includes('**IN PROGRESS**') || label.includes('<- **IN PROGRESS**');
      label = label.replace(/<-\s*\*\*IN PROGRESS\*\*/, '').replace(/\*\*IN PROGRESS\*\*/, '').trim();
      items.push({ label, completed, inProgress });
    }
  }
  return items;
}

function parseTableRows(section: string, columnCount: number): string[][] {
  const rows: string[][] = [];
  const lines = section.split('\n');
  let headerPassed = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;

    // Skip separator row
    if (trimmed.match(/^\|[\s-|]+\|$/)) {
      headerPassed = true;
      continue;
    }

    // Skip header row
    if (!headerPassed) {
      headerPassed = false;
      continue;
    }

    const cells = trimmed
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());

    if (cells.length >= columnCount && cells.some((c) => c.length > 0)) {
      rows.push(cells);
    }
  }
  return rows;
}

export function parseTaskMd(content: string): ParsedTask {
  const { frontmatter, body } = parseFrontmatter(content);

  const statusSection = extractSection(body, 'Status');
  let phase: string | undefined;
  let phaseName: string | undefined;
  let lastUpdated: string | undefined;

  const phaseMatch = statusSection.match(/\*\*Phase\*\*:\s*(\d+)\s*\(([^)]+)\)/);
  if (phaseMatch) {
    phase = phaseMatch[1];
    phaseName = phaseMatch[2];
  }

  const updatedMatch = statusSection.match(/\*\*Last Updated\*\*:\s*(.+)/);
  if (updatedMatch) {
    lastUpdated = updatedMatch[1].trim();
  }

  const completedSection = extractSection(body, 'Completed');
  const currentSection = extractSection(body, 'Current');
  const upcomingSection = extractSection(body, 'Upcoming');
  const decisionsSection = extractSection(body, 'Decisions Log');
  const discoveriesSection = extractSection(body, 'Discoveries');
  const blockersSection = extractSection(body, 'Blockers');

  const decisions: TaskDecision[] = [];
  const decisionRows = parseTableRows(decisionsSection, 3);
  for (const row of decisionRows) {
    decisions.push({
      decision: row[0],
      rationale: row[1],
      phase: row[2],
    });
  }

  const discoveries = discoveriesSection
    .split('\n')
    .filter((l) => l.trim().startsWith('-'))
    .map((l) => l.replace(/^[-*]\s+/, '').trim());

  const blockerLines = blockersSection
    .split('\n')
    .filter((l) => l.trim().length > 0 && !l.trim().startsWith('<!--'));
  const blockers =
    blockerLines.length === 1 && blockerLines[0].trim().toLowerCase() === 'none'
      ? []
      : blockerLines
          .filter((l) => l.trim().toLowerCase() !== 'none')
          .map((l) => l.replace(/^[-*]\s+/, '').trim());

  return {
    frontmatter: frontmatter as TaskFrontmatter,
    phase,
    phaseName,
    lastUpdated,
    completed: parseCheckboxItems(completedSection),
    current: parseCheckboxItems(currentSection),
    upcoming: parseCheckboxItems(upcomingSection),
    decisions,
    discoveries,
    blockers,
  };
}

export function parsePlanMd(content: string): ParsedPlan {
  const { frontmatter, body } = parseFrontmatter(content);

  const summary = extractSection(body, 'Summary')
    .split('\n')
    .filter((l) => !l.trim().startsWith('<!--'))
    .join('\n')
    .trim();

  const goal = extractSection(body, 'Goal')
    .split('\n')
    .filter((l) => !l.trim().startsWith('<!--'))
    .join('\n')
    .trim();

  const createSection = extractSection(body, 'Files to Create');
  const modifySection = extractSection(body, 'Files to Modify');
  const complexitySection = extractSection(body, 'Estimated Complexity');

  const filesToCreate = parseTableRows(createSection, 2).map((r) => ({
    file: r[0],
    purpose: r[1],
  }));

  const filesToModify = parseTableRows(modifySection, 2).map((r) => ({
    file: r[0],
    change: r[1],
  }));

  const complexity = complexitySection
    .split('\n')
    .filter((l) => !l.trim().startsWith('<!--'))
    .join(' ')
    .trim();

  return {
    frontmatter: frontmatter as PlanFrontmatter,
    summary: summary || undefined,
    goal: goal || undefined,
    filesToCreate,
    filesToModify,
    complexity: complexity || undefined,
  };
}

export function parseWalkthroughMd(content: string): ParsedWalkthrough {
  const { frontmatter, body } = parseFrontmatter(content);

  const summary = extractSection(body, 'Summary')
    .split('\n')
    .filter((l) => !l.trim().startsWith('<!--'))
    .join('\n')
    .trim();

  const refSection = extractSection(body, 'Quick Reference');
  let branch: string | undefined;
  let pr: string | undefined;
  let worktreePath: string | undefined;

  const branchMatch = refSection.match(/\*\*Branch\*\*:\s*`([^`]+)`/);
  if (branchMatch) branch = branchMatch[1];

  const prMatch = refSection.match(/\*\*PR\*\*:\s*#?(\S+)/);
  if (prMatch) pr = prMatch[1];

  const wtMatch = refSection.match(/\*\*Worktree\*\*:\s*`([^`]+)`/);
  if (wtMatch) worktreePath = wtMatch[1];

  const changedSection = extractSection(body, 'Files Changed');
  const filesChanged = parseTableRows(changedSection, 3).map((r) => ({
    file: r[0],
    change: r[1],
    purpose: r[2],
  }));

  return {
    frontmatter: frontmatter as WalkthroughFrontmatter,
    summary: summary || undefined,
    filesChanged,
    branch,
    pr,
    worktreePath,
  };
}
