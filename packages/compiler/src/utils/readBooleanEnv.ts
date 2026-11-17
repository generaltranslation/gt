import { createDiagnosticMessage } from 'generaltranslation/diagnostics';

const ENV_TRUE_VALUES = new Set(['true', '1']);
const ENV_FALSE_VALUES = new Set(['false', '0', '']);

const createInvalidBooleanEnvError = (name: string, value: string) =>
  createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    severity: 'Error',
    whatHappened: `${name} is set to "${value}", which is not a boolean`,
    fix: `Set ${name} to true or false`,
  });

/**
 * A boolean environment variable that build scripts set next to a compiler
 * option: `true`/`1` or `false`/`0`, or undefined when it is not set.
 *
 * @throws {Error} When the value is neither.
 */
export function readBooleanEnv(name: string): boolean | undefined {
  const raw = process.env[name];
  if (raw === undefined) return undefined;
  const value = raw.trim().toLowerCase();
  if (ENV_TRUE_VALUES.has(value)) return true;
  if (ENV_FALSE_VALUES.has(value)) return false;
  throw new Error(createInvalidBooleanEnvError(name, raw));
}
