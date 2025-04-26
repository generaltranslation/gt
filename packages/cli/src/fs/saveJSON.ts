import path from 'node:path';
import fs from 'node:fs';

export async function saveJSON(filepath: string, data: Record<string, any>) {
  // Ensure directory exists
  await fs.promises.mkdir(path.dirname(filepath), { recursive: true });

  await fs.promises.writeFile(filepath, JSON.stringify(data, null, 2));
}
