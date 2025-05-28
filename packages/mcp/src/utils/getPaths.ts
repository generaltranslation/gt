import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function fromPackageRoot(relative: string) {
  return path.resolve(__dirname, `../`, relative);
}

// console.log() writes to stdout which will interfere with MCP Stdio protocol
export const log = console.error;
