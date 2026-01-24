// Public API exports
export type {
  Config,
  CopyOptions,
  CopyResult,
  GlobalArgs,
} from './lib/types.ts';
export { loadConfig, saveConfig } from './lib/config.ts';
export { copyFiles } from './lib/file-ops.ts';
export {
  isDirectory,
  normalizePath,
  pathExists,
  resolveWorktreePath,
  validatePathExists,
} from './lib/path-resolver.ts';
