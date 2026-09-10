import fs from 'node:fs';
import path from 'node:path';
import { parseConfigFile } from '../fs/config/loadConfig.js';

export function resolveConfig(cwd: string): {
  path: string;
  config: Record<string, unknown>;
} | null {
  const candidates = [
    'gt.config.json',
    'src/gt.config.json',
    // Support config under .gt for parity with .locadex
    '.gt/gt.config.json',
    // Backward compatibility: support legacy .locadex directory
    '.locadex/gt.config.json',
  ];
  for (const candidate of candidates) {
    const filepath = path.join(cwd, candidate);
    if (fs.existsSync(filepath)) {
      return { path: filepath, config: parseConfigFile(filepath) };
    }
  }
  return null;
}
