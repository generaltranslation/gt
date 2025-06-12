import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function fromPackageRoot(relative: string) {
  return path.resolve(__dirname, `../../`, relative);
}
