import fs from 'node:fs';
import path from 'node:path';
import { gtConfigFilePaths } from 'generaltranslation/config-schema';
import { type GTConfigFile, loadConfig } from '../fs/config/loadConfig.js';

export function resolveConfig(cwd: string): {
  path: string;
  config: GTConfigFile;
} | null {
  for (const configFilepath of gtConfigFilePaths) {
    const resolvedPath = path.join(cwd, configFilepath);
    if (fs.existsSync(resolvedPath)) {
      return { path: resolvedPath, config: loadConfig(resolvedPath) };
    }
  }
  return null;
}
