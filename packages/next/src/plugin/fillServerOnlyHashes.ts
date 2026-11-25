import fs from 'node:fs';
import path from 'node:path';
import {
  findHashTokens,
  findJsxHashes,
  moveSourceMapFile,
  trackReplacements,
} from '@generaltranslation/compiler/internal';
import { SERVER_ONLY_HASHES_PLACEHOLDER } from '../provider/serverOnlyHashesPlaceholder';

const [PLACEHOLDER_NAME] = SERVER_ONLY_HASHES_PLACEHOLDER.split('[');

// A bundler can leave a chunk of an earlier build in place, so an already
// filled placeholder is filled again.
const PLACEHOLDER = new RegExp(`${PLACEHOLDER_NAME}\\[[0-9a-f,]*\\]`, 'g');

function findJsFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return findJsFiles(file);
    return /\.[cm]?js$/.test(entry.name) ? [file] : [];
  });
}

/**
 * Writes the <T> hashes in server output that no browser output holds into
 * the placeholders of the compiled server files.
 */
export function fillServerOnlyHashes(distDir: string): void {
  const clientFiles = findJsFiles(path.join(distDir, 'static'));
  const clientHashes = new Set(
    clientFiles.flatMap((file) => findHashTokens(fs.readFileSync(file, 'utf8')))
  );
  const serverOnlyHashes = new Set<string>();
  const placeholderFiles: string[] = [];
  for (const file of findJsFiles(path.join(distDir, 'server'))) {
    const code = fs.readFileSync(file, 'utf8');
    // A msg() made in server code carries its $_hash to a client m(), so only
    // <T> hashes are listed.
    for (const hash of findJsxHashes(code)) {
      if (!clientHashes.has(hash)) serverOnlyHashes.add(hash);
    }
    if (code.includes(PLACEHOLDER_NAME)) placeholderFiles.push(file);
  }

  const hashes = clientFiles.length ? Array.from(serverOnlyHashes).sort() : [];
  const filled = `${PLACEHOLDER_NAME}[${hashes.join(',')}]`;
  for (const file of placeholderFiles) {
    const code = fs.readFileSync(file, 'utf8');
    const tracked = trackReplacements(code);
    const rewritten = tracked.replace(code, PLACEHOLDER, () => filled);
    if (rewritten === code) continue;
    fs.writeFileSync(file, rewritten);
    const mapFile = `${file}.map`;
    const { replacements } = tracked;
    if (!replacements || !fs.existsSync(mapFile)) continue;
    const map = moveSourceMapFile(
      fs.readFileSync(mapFile, 'utf8'),
      code,
      replacements
    );
    if (map !== undefined) fs.writeFileSync(mapFile, map);
  }
}
