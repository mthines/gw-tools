/**
 * Reusable interactive multi-select prompt for terminal UIs
 * Zero dependencies - uses Deno raw terminal APIs and ANSI escape codes
 */

import * as output from './output.ts';

// ── Types ───────────────────────────────────────────────────

/** A single selectable item in the multi-select list */
export interface SelectItem {
  /** Display label */
  label: string;
  /** Value returned when selected */
  value: string;
  /** Whether this item is pre-selected */
  selected?: boolean;
  /** If true, item cannot be selected (grayed out, cursor skips) */
  disabled?: boolean;
  /** Reason shown when disabled (e.g., "default branch") */
  disabledReason?: string;
  /** If true, item is selectable but shows a warning label */
  protected?: boolean;
  /** Extra hint text shown after the label */
  hint?: string;
}

/** A group of items with a section header */
export interface SelectSection {
  /** Section title displayed as a header */
  title: string;
  /** Items in this section */
  items: SelectItem[];
}

/** Configuration for the multi-select prompt */
export interface MultiSelectOptions {
  /** Prompt message shown at the top */
  message: string;
  /** Grouped sections of items */
  sections: SelectSection[];
  /** Warning banner shown below the message */
  warningBanner?: string;
}

/** Result returned by the multi-select prompt */
export interface MultiSelectResult {
  /** Values of all selected items */
  selected: string[];
  /** True if the user cancelled with Ctrl+C or Escape */
  cancelled: boolean;
}

// ── Internal row types for the flattened render list ────────

type RowType = 'section-header' | 'item' | 'separator';

interface Row {
  type: RowType;
  /** Index of the section this row belongs to */
  sectionIndex: number;
  /** For item rows, the index into the section's items array */
  itemIndex?: number;
  /** Whether this row can receive the cursor */
  focusable: boolean;
}

// ── ANSI escape sequences ──────────────────────────────────

const ESC = '\x1b';
const HIDE_CURSOR = `${ESC}[?25l`;
const SHOW_CURSOR = `${ESC}[?25h`;
const CLEAR_LINE = `${ESC}[2K`;
const COL0 = `${ESC}[0G`;
const ENTER_ALT_SCREEN = `${ESC}[?1049h`;
const EXIT_ALT_SCREEN = `${ESC}[?1049l`;
const CURSOR_HOME = `${ESC}[H`;

// ── Keypress parsing ───────────────────────────────────────

const KEY_CTRL_C = 0x03;
const KEY_ESC = 0x1b;
const KEY_ENTER = 0x0d;
const KEY_SPACE = 0x20;

/** Injectable I/O interface for testing */
export interface TerminalIO {
  read(buf: Uint8Array): Promise<number | null>;
  write(data: Uint8Array): void;
  setRaw(raw: boolean): void;
  isTerminal(): boolean;
  /** Terminal height in rows. Defaults to 24 if unavailable. */
  getRows?(): number;
}

function defaultTerminalIO(): TerminalIO {
  return {
    read: (buf) => Deno.stdin.read(buf),
    write: (data) => Deno.stdout.writeSync(data),
    setRaw: (raw) => Deno.stdin.setRaw(raw),
    isTerminal: () => Deno.stdin.isTerminal(),
    getRows: () => {
      try {
        return Deno.consoleSize().rows;
      } catch {
        return 24;
      }
    },
  };
}

function parseKey(buf: Uint8Array, n: number): string {
  if (n === 1) {
    switch (buf[0]) {
      case KEY_CTRL_C:
        return 'ctrl-c';
      case KEY_ESC:
        return 'escape';
      case KEY_ENTER:
        return 'enter';
      case KEY_SPACE:
        return 'space';
      default: {
        const ch = String.fromCharCode(buf[0]);
        if (ch === 'a' || ch === 'A') return 'a';
        return ch;
      }
    }
  }
  // Arrow keys: ESC [ A/B/C/D
  if (n >= 3 && buf[0] === KEY_ESC && buf[1] === 0x5b) {
    switch (buf[2]) {
      case 0x41:
        return 'up';
      case 0x42:
        return 'down';
      case 0x43:
        return 'right';
      case 0x44:
        return 'left';
    }
  }
  return 'unknown';
}

// ── Core logic ─────────────────────────────────────────────

function buildRows(sections: SelectSection[]): Row[] {
  const rows: Row[] = [];
  for (let si = 0; si < sections.length; si++) {
    if (si > 0) {
      rows.push({
        type: 'separator',
        sectionIndex: si,
        focusable: false,
      });
    }
    rows.push({
      type: 'section-header',
      sectionIndex: si,
      focusable: true,
    });
    for (let ii = 0; ii < sections[si].items.length; ii++) {
      const item = sections[si].items[ii];
      rows.push({
        type: 'item',
        sectionIndex: si,
        itemIndex: ii,
        focusable: !item.disabled,
      });
    }
  }
  return rows;
}

function findNextFocusable(rows: Row[], current: number, direction: 1 | -1): number {
  let idx = current + direction;
  while (idx >= 0 && idx < rows.length) {
    if (rows[idx].focusable) return idx;
    idx += direction;
  }
  return current; // stay put if nothing found
}

function findFirstFocusable(rows: Row[]): number {
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].focusable) return i;
  }
  return 0;
}

function getSectionSelectionState(section: SelectSection): 'all' | 'some' | 'none' {
  const selectable = section.items.filter((i) => !i.disabled);
  if (selectable.length === 0) return 'none';
  const selectedCount = selectable.filter((i) => i.selected).length;
  if (selectedCount === selectable.length) return 'all';
  if (selectedCount > 0) return 'some';
  return 'none';
}

function toggleSectionAll(section: SelectSection): void {
  const selectable = section.items.filter((i) => !i.disabled);
  const state = getSectionSelectionState(section);
  const newValue = state !== 'all';
  for (const item of selectable) {
    item.selected = newValue;
  }
}

function countSelected(sections: SelectSection[]): number {
  let count = 0;
  for (const section of sections) {
    for (const item of section.items) {
      if (item.selected && !item.disabled) count++;
    }
  }
  return count;
}

function countTotal(sections: SelectSection[]): number {
  let count = 0;
  for (const section of sections) {
    for (const item of section.items) {
      if (!item.disabled) count++;
    }
  }
  return count;
}

function getSelected(sections: SelectSection[]): string[] {
  const selected: string[] = [];
  for (const section of sections) {
    for (const item of section.items) {
      if (item.selected && !item.disabled) {
        selected.push(item.value);
      }
    }
  }
  return selected;
}

// ── Rendering ──────────────────────────────────────────────

/** Number of fixed lines: header + warning banner + blank + footer blank + footer */
const HEADER_LINES = 3; // header, warning, blank
const FOOTER_LINES = 2; // blank, controls

function renderRowLine(
  row: Row,
  isCursor: boolean,
  sections: SelectSection[],
): string {
  const section = sections[row.sectionIndex];

  if (row.type === 'separator') {
    return '';
  }

  if (row.type === 'section-header') {
    const state = getSectionSelectionState(section);
    let checkbox: string;
    if (state === 'all') {
      checkbox = output.checkmark();
    } else if (state === 'some') {
      checkbox = output.warningSymbol();
    } else {
      checkbox = ' ';
    }
    const selectable = section.items.filter((i) => !i.disabled);
    const selectedInSection = selectable.filter((i) => i.selected).length;
    const title = output.bold(section.title);
    const count = output.dim(` (${selectedInSection}/${selectable.length})`);
    return isCursor
      ? `${output.bold('>')} [${checkbox}] ${title}${count}`
      : `  [${checkbox}] ${title}${count}`;
  }

  // Item row
  const item = section.items[row.itemIndex!];

  if (item.disabled) {
    const reason = item.disabledReason ? ` (${item.disabledReason})` : '';
    return `      ${output.dim(item.label)}${output.dim(reason)}`;
  }

  const checkbox = item.selected ? `[${output.checkmark()}]` : '[ ]';
  const protectedBadge = item.protected ? ` ${output.warningSymbol()} ${output.dim('(protected)')}` : '';
  const hint = item.hint ? ` ${output.dim(item.hint)}` : '';
  return isCursor
    ? `  ${output.bold('>')} ${checkbox} ${item.label}${protectedBadge}${hint}`
    : `    ${checkbox} ${item.label}${protectedBadge}${hint}`;
}

function render(
  io: TerminalIO,
  options: MultiSelectOptions,
  rows: Row[],
  cursor: number,
  viewportOffset: number,
  termRows: number,
): number {
  const encoder = new TextEncoder();
  const sel = countSelected(options.sections);
  const tot = countTotal(options.sections);

  // Calculate viewport size for the scrollable area
  const hasWarning = options.warningBanner ? 1 : 0;
  const fixedLines = HEADER_LINES - (hasWarning ? 0 : 1) + FOOTER_LINES;
  const viewportHeight = Math.max(5, termRows - fixedLines);

  // Adjust viewport offset to keep cursor visible
  if (cursor < viewportOffset) {
    viewportOffset = cursor;
  } else if (cursor >= viewportOffset + viewportHeight) {
    viewportOffset = cursor - viewportHeight + 1;
  }
  // Clamp viewport offset
  viewportOffset = Math.max(0, Math.min(viewportOffset, rows.length - viewportHeight));
  if (viewportOffset < 0) viewportOffset = 0;

  // Build all output lines
  const lines: string[] = [];

  // Header
  lines.push(`${output.bold(options.message)} ${output.dim(`(${sel}/${tot} selected)`)}`);
  if (options.warningBanner) {
    lines.push(`${output.warningSymbol()} ${options.warningBanner}`);
  }
  lines.push('');

  // Scrollable rows (viewport slice)
  const visibleEnd = Math.min(viewportOffset + viewportHeight, rows.length);
  const showUpArrow = viewportOffset > 0;
  const showDownArrow = visibleEnd < rows.length;

  if (showUpArrow) {
    lines.push(output.dim(`  \u2191 ${viewportOffset} more above`));
  }

  for (let ri = viewportOffset; ri < visibleEnd; ri++) {
    lines.push(renderRowLine(rows[ri], ri === cursor, options.sections));
  }

  if (showDownArrow) {
    lines.push(output.dim(`  \u2193 ${rows.length - visibleEnd} more below`));
  }

  // Footer
  lines.push('');
  lines.push(output.dim('  \u2191\u2193 navigate  \u2423 toggle  a select all  \u23CE confirm  ^C cancel'));

  // Render: move cursor home and overwrite
  io.write(encoder.encode(CURSOR_HOME));
  const rendered = lines.map((l) => `${COL0}${CLEAR_LINE}${l}`).join('\n');
  io.write(encoder.encode(rendered + '\n'));

  // Clear any leftover lines below the current render
  const totalWritten = lines.length;
  for (let i = totalWritten; i < termRows; i++) {
    io.write(encoder.encode(`${COL0}${CLEAR_LINE}\n`));
  }

  return viewportOffset;
}

// ── Public API ─────────────────────────────────────────────

/**
 * Display an interactive multi-select prompt with grouped sections.
 *
 * Navigation: Arrow keys up/down, Space to toggle, Enter to confirm,
 * Ctrl+C/Escape to cancel, 'a' to toggle all in current section.
 *
 * Uses the alternate screen buffer so the main scrollback is preserved.
 *
 * @param options Configuration for the prompt
 * @param io Optional terminal I/O for testing
 * @returns Selected values and cancellation status
 */
export async function multiSelect(options: MultiSelectOptions, io?: TerminalIO): Promise<MultiSelectResult> {
  const terminal = io ?? defaultTerminalIO();

  // Guard: non-TTY environment
  if (!terminal.isTerminal()) {
    throw new Error('Interactive mode requires a terminal (TTY). ' + 'Use non-interactive mode instead.');
  }

  const rows = buildRows(options.sections);

  if (rows.length === 0) {
    return { selected: [], cancelled: false };
  }

  const encoder = new TextEncoder();
  let cursor = findFirstFocusable(rows);
  let viewportOffset = 0;
  const termRows = terminal.getRows?.() ?? 24;

  // Enter alternate screen buffer + raw mode
  terminal.setRaw(true);
  terminal.write(encoder.encode(ENTER_ALT_SCREEN + HIDE_CURSOR));

  try {
    // Initial render
    viewportOffset = render(terminal, options, rows, cursor, viewportOffset, termRows);

    // Input loop
    const buf = new Uint8Array(16);
    while (true) {
      const n = await terminal.read(buf);
      if (n === null) break;

      const key = parseKey(buf, n);

      switch (key) {
        case 'up':
          cursor = findNextFocusable(rows, cursor, -1);
          break;

        case 'down':
          cursor = findNextFocusable(rows, cursor, 1);
          break;

        case 'space': {
          const row = rows[cursor];
          if (row.type === 'section-header') {
            toggleSectionAll(options.sections[row.sectionIndex]);
          } else if (row.type === 'item' && row.itemIndex !== undefined) {
            const item = options.sections[row.sectionIndex].items[row.itemIndex];
            if (!item.disabled) {
              item.selected = !item.selected;
            }
          }
          break;
        }

        case 'a': {
          const row = rows[cursor];
          toggleSectionAll(options.sections[row.sectionIndex]);
          break;
        }

        case 'enter':
          return { selected: getSelected(options.sections), cancelled: false };

        case 'ctrl-c':
        case 'escape':
          return { selected: [], cancelled: true };
      }

      viewportOffset = render(terminal, options, rows, cursor, viewportOffset, termRows);
    }
  } finally {
    // Always restore terminal state
    terminal.setRaw(false);
    terminal.write(encoder.encode(SHOW_CURSOR + EXIT_ALT_SCREEN));
  }

  return { selected: [], cancelled: true };
}
