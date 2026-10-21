/**
 * Point gw's global config dir (repo registry) at a throwaway temp dir.
 *
 * Imported for its side effect by every git-based test harness so that
 * commands run in tests (init, any registered command) never write to the
 * developer's real ~/.config/gw/repos.json.
 */

const isolatedConfigHome = Deno.makeTempDirSync({ prefix: 'gw-test-config-' });
Deno.env.set('XDG_CONFIG_HOME', isolatedConfigHome);

/** The temp XDG_CONFIG_HOME used for the current test process */
export const TEST_CONFIG_HOME = isolatedConfigHome;
