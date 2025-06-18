import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function fromPackageRoot(relative: string) {
  return path.resolve(__dirname, `../../`, relative);
}

export function getLocadexVersion(): string {
  const packageJsonPath = fromPackageRoot('package.json');

  if (!fs.existsSync(packageJsonPath)) {
    return 'unknown';
  }
  try {
    return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')).version;
  } catch (error) {
    return 'unknown';
  }
}
