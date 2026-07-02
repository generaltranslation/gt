import fs from 'node:fs';
import type { GTAstroFileConfig } from '../types';

/**
 * Reads gt.config.json from disk. Returns an empty config when the file is
 * missing so apps can configure gt-astro entirely via integration options.
 */
export function loadGTConfig(gtConfigPath: string): {
  gtConfig: GTAstroFileConfig;
  exists: boolean;
} {
  if (!fs.existsSync(gtConfigPath)) {
    return { gtConfig: {}, exists: false };
  }
  const raw = fs.readFileSync(gtConfigPath, 'utf-8');
  return { gtConfig: JSON.parse(raw) as GTAstroFileConfig, exists: true };
}
