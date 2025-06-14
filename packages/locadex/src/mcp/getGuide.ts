import { readFile } from 'node:fs/promises';
import { fromPackageRoot } from '../utils/getPaths.js';
import { logger } from '../logging/logger.js';

export default async function getGuide(
  path: string
): Promise<{ content?: string; error?: string }> {
  try {
    const filePath = fromPackageRoot(path);
    const content = await readFile(filePath, 'utf-8');
    return { content };
  } catch (error) {
    logger.log(`Error reading guide ${path}: ${error}`);
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
