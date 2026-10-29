import path from 'node:path';
import fs from 'node:fs';
import { stringifyJson } from './stringifyJson.js';

export async function saveJSON(
  filepath: string,
  data: Record<string, unknown>
) {
  // Ensure directory exists
  await fs.promises.mkdir(path.dirname(filepath), { recursive: true });

  await fs.promises.writeFile(filepath, stringifyJson(data));
}
