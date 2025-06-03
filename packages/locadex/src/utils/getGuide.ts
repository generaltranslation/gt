import { readFile } from 'fs/promises';
import { join } from 'path';

export default async function getGuide(
  path: string
): Promise<{ content?: string; error?: string }> {
  try {
    const filePath = join(process.cwd(), path);
    const content = await readFile(filePath, 'utf-8');
    return { content };
  } catch (error) {
    console.error(`Error reading guide ${path}:`, error);
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
