import fs from 'node:fs';
import path from 'node:path';
import { loadGTConfig } from '../fs/config/loadGTConfig.js';

export function resolveConfig(cwd: string): {
  path: string;
  config: Record<string, unknown>;
} | null {
  const configFilepath = 'gt.config.json';
  if (fs.existsSync(path.join(cwd, configFilepath))) {
    return {
      path: path.join(cwd, configFilepath),
      config: loadGTConfig(path.join(cwd, configFilepath)),
    };
  }
  if (fs.existsSync(path.join(cwd, 'src/gt.config.json'))) {
    return {
      path: path.join(cwd, 'src/gt.config.json'),
      config: loadGTConfig(path.join(cwd, 'src/gt.config.json')),
    };
  }
  // Support config under .gt for parity with .locadex
  if (fs.existsSync(path.join(cwd, '.gt/gt.config.json'))) {
    return {
      path: path.join(cwd, '.gt/gt.config.json'),
      config: loadGTConfig(path.join(cwd, '.gt/gt.config.json')),
    };
  }
  // Backward compatibility: support legacy .locadex directory
  if (fs.existsSync(path.join(cwd, '.locadex/gt.config.json'))) {
    return {
      path: path.join(cwd, '.locadex/gt.config.json'),
      config: loadGTConfig(path.join(cwd, '.locadex/gt.config.json')),
    };
  }
  return null;
}
