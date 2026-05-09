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
