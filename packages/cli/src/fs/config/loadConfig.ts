import fs from 'node:fs';

export function loadConfig(filepath: string): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf-8')) as Record<
      string,
      unknown
    >;
  } catch {
    return {};
  }
}

/**
 * Parse a JSON config file (e.g. gt.config.json). Unlike {@link loadConfig},
 * a file that exists but contains invalid JSON throws instead of being
 * silently treated as empty config — otherwise a typo in gt.config.json
 * drops every setting with no feedback. A missing file still returns `{}`.
 */
export function parseConfigFile(filepath: string): Record<string, unknown> {
  let raw: string;
  try {
    raw = fs.readFileSync(filepath, 'utf-8');
  } catch (error) {
    // Only a missing file is benign; other read errors (permissions, EISDIR,
    // transient IO) must surface rather than masquerade as empty config.
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    throw new Error(
      `Failed to read config file "${filepath}": ${(error as Error).message}`
    );
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      `Failed to parse config file "${filepath}": ${(error as Error).message}`
    );
  }
}
