import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../fs/config/loadConfig.js';

export function resolveConfig(cwd: string): {
  path: string;
  config: Record<string, any>;
} | null {
  const configFilepath = 'gt.config.json';
  if (fs.existsSync(path.join(cwd, configFilepath))) {
    return {
      path: path.join(cwd, configFilepath),
      config: loadConfig(path.join(cwd, configFilepath)),
    };
  }
  if (fs.existsSync(path.join(cwd, 'src/gt.config.json'))) {
    return {
      path: path.join(cwd, 'src/gt.config.json'),
      config: loadConfig(path.join(cwd, 'src/gt.config.json')),
    };
  }
  return null;
}
