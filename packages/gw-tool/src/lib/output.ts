/**
 * Output formatting utilities for consistent CLI messages
 */

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',

  // Foreground colors
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',

  // Background colors
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgCyan: '\x1b[46m',
};

/**
 * Format text with color
 */
function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`;
}

/**
 * Create a colored badge (like NX's style)
 */
function badge(text: string, bgColor: keyof typeof colors, fgColor: keyof typeof colors = 'white'): string {
  return `${colors[bgColor]}${colors[fgColor]}${colors.bold} ${text} ${colors.reset}`;
}

/**
 * Display an error message with red badge
 */
export function error(message: string): void {
  const errorBadge = badge('ERROR', 'bgRed', 'white');
  console.error(`\n${errorBadge} ${colorize(message, 'red')}\n`);
}

/**
 * Display a success message with green badge
 */
export function success(message: string): void {
  const successBadge = badge('SUCCESS', 'bgGreen', 'white');
  console.log(`\n${successBadge} ${colorize(message, 'green')}\n`);
}

/**
 * Display a warning message with yellow badge
 */
export function warning(message: string): void {
  const warningBadge = badge('WARNING', 'bgYellow', 'white');
  console.log(`\n${warningBadge} ${colorize(message, 'yellow')}\n`);
}

/**
 * Display an info message with blue badge
 */
export function info(message: string): void {
  const infoBadge = badge('INFO', 'bgBlue', 'white');
  console.log(`\n${infoBadge} ${colorize(message, 'cyan')}\n`);
}

/**
 * Display a generic message with a custom badge
 */
export function custom(badgeText: string, message: string, bgColor: keyof typeof colors = 'bgCyan'): void {
  const customBadge = badge(badgeText, bgColor, 'white');
  console.log(`${customBadge} ${message}`);
}

/**
 * Format success checkmark
 */
export function checkmark(): string {
  return colorize('✓', 'green');
}

/**
 * Format warning symbol
 */
export function warningSymbol(): string {
  return colorize('⚠', 'yellow');
}

/**
 * Format error cross
 */
export function errorSymbol(): string {
  return colorize('✗', 'red');
}

/**
 * Format a path in cyan (for file paths)
 */
export function path(filePath: string): string {
  return colorize(filePath, 'cyan');
}

/**
 * Format bold text
 */
export function bold(text: string): string {
  return `${colors.bold}${text}${colors.reset}`;
}

/**
 * Format dim/gray text
 */
export function dim(text: string): string {
  return `${colors.dim}${text}${colors.reset}`;
}

/**
 * Colorize git diff stats (green for +, red for -)
 */
export function colorizeFileStat(fileStat: string): string {
  // Git merge output format: " path/to/file.ts | 10 ++++++++++""
  // We want to colorize the + and - characters
  let result = fileStat;

  // Replace + with green +
  result = result.replace(/\+/g, colorize('+', 'green'));

  // Replace - with red -
  result = result.replace(/-/g, colorize('-', 'red'));

  return result;
}
