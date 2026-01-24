// Public API exports
export type {
  Config,
  CopyOptions,
  CopyResult,
  GlobalArgs,
  RepoConfig,
} from './lib/types.ts';
export { getRepoConfig, loadConfig, saveConfig } from './lib/config.ts';
export { copyFiles } from './lib/file-ops.ts';
export {
  isDirectory,
  normalizePath,
  pathExists,
  resolveWorktreePath,
  validatePathExists,
} from './lib/path-resolver.ts';
