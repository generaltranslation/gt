import { createDiagnosticMessage } from 'generaltranslation/diagnostics';

/**
 * Environment variable read when the `experimentalPrecomputeJsx` option is not
 * set, so a build script can turn it on without changing the bundler config.
 */
export const PRECOMPUTE_JSX_ENV_VAR = 'GT_PRECOMPUTE_JSX';

const ENV_TRUE_VALUES = new Set(['true', '1']);
const ENV_FALSE_VALUES = new Set(['false', '0', '']);

const createInvalidPrecomputeJsxEnvError = (value: string) =>
  createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    severity: 'Error',
    whatHappened: `${PRECOMPUTE_JSX_ENV_VAR} is set to "${value}", which is not a boolean`,
    fix: `Set ${PRECOMPUTE_JSX_ENV_VAR} to true or false`,
  });

/**
 * Whether this build precomputes `<T>`: the `experimentalPrecomputeJsx`
 * option, else the `GT_PRECOMPUTE_JSX` environment variable.
 */
export function getPrecomputeJsx(option: boolean | undefined): boolean {
  if (option !== undefined) return option;
  const raw = process.env[PRECOMPUTE_JSX_ENV_VAR];
  if (raw === undefined) return false;
  const value = raw.trim().toLowerCase();
  if (ENV_TRUE_VALUES.has(value)) return true;
  if (ENV_FALSE_VALUES.has(value)) return false;
  throw new Error(createInvalidPrecomputeJsxEnvError(raw));
}

/**
 * Adds the setting to webpack's and rspack's persistent cache version, which
 * would otherwise reuse modules transformed for the other value.
 */
export function addPrecomputeJsxCacheVersion(options: {
  cache?: unknown;
  experiments?: { cache?: unknown };
}): void {
  for (const cache of [options.cache, options.experiments?.cache]) {
    if (cache == null || typeof cache !== 'object' || !('type' in cache)) {
      continue;
    }
    if (cache.type !== 'filesystem' && cache.type !== 'persistent') continue;
    const versioned = cache as { version?: string };
    versioned.version = `${versioned.version ?? ''}|gt-precompute-jsx`;
  }
}
