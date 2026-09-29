import fs from 'node:fs';

/** `--config` accepts a path with or without its `.json` extension. */
export function withJsonExtension(configPath: string): string {
  return configPath.endsWith('.json') ? configPath : `${configPath}.json`;
}

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
