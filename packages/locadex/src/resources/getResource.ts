import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fromPackageRoot } from '../utils/getPaths.js';
import { logger } from '../logging/logger.js';

export function getResource(path: string): {
  content?: string;
  error?: string;
} {
  try {
    const filePath = fromPackageRoot(join('resources', path));
    const content = readFileSync(filePath, 'utf-8');
    return { content };
  } catch (error) {
    logger.log(`Error reading resource ${path}: ${error}`);
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
