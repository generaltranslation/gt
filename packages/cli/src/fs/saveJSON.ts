import path from 'path';
import fs from 'fs';

export function saveJSON(filepath: string, data: Record<string, any>) {
  // Ensure directory exists
  fs.mkdirSync(path.dirname(filepath), { recursive: true });

  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}
