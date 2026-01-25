/**
 * Version information for the gw CLI tool
 * Automatically reads from npm/package.json at compile time
 */
import packageJson from '../../npm/package.json' with { type: 'json' };

export const VERSION = packageJson.version;
