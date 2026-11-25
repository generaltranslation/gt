import fs from 'node:fs';
import path from 'node:path';
import {
  moveSourceMapFile,
  trackReplacements,
} from '@generaltranslation/compiler/internal';

const SOURCE_MAPPING_URL = /^\/\/[#@] sourceMappingURL=(\S+)[ \t]*$/gm;
const INLINE_MAP = /^data:application\/json;(?:[\w=-]+;)*base64,/;

/** The map file a sourceMappingURL names, when it is a path in `distDir`. */
function findMapFile(
  distDir: string,
  file: string,
  url: string
): string | undefined {
  if (/^[a-z][\w+.-]*:/i.test(url)) return undefined;
  let decoded: string;
  try {
    decoded = decodeURIComponent(url);
  } catch {
    return undefined;
  }
  const mapFile = path.resolve(path.dirname(file), decoded);
  const inDistDir = path.relative(distDir, mapFile);
  return inDistDir.split(path.sep)[0] === '..' || path.isAbsolute(inDistDir)
    ? undefined
    : mapFile;
}

/**
 * Writes each `filled` over what its pattern finds in the compiled file
 * `file`, and moves the source map that the file's last sourceMappingURL
 * comment names, inline or in a file in `distDir`, or else `${file}.map`.
 */
export function fillCompiledFile(
  distDir: string,
  file: string,
  fills: [pattern: RegExp, filled: string][]
): void {
  const code = fs.readFileSync(file, 'utf8');
  const tracked = trackReplacements(code);
  let rewritten = fills.reduce(
    (replaced, [pattern, filled]) =>
      tracked.replace(replaced, pattern, () => filled),
    code
  );
  if (rewritten === code) return;
  const { replacements } = tracked;
  const comment = Array.from(rewritten.matchAll(SOURCE_MAPPING_URL)).pop();
  const url = comment?.[1];
  const inline = url?.match(INLINE_MAP)?.[0];
  if (replacements && comment && url && inline) {
    const map = moveSourceMapFile(
      Buffer.from(url.slice(inline.length), 'base64').toString('utf8'),
      code,
      replacements
    );
    // The comment comes after every placeholder, so rewriting it moves no mapped code
    if (map !== undefined) {
      rewritten =
        rewritten.slice(0, comment.index) +
        comment[0].replace(
          url,
          () => `${inline}${Buffer.from(map, 'utf8').toString('base64')}`
        ) +
        rewritten.slice(comment.index + comment[0].length);
    }
  }
  fs.writeFileSync(file, rewritten);
  if (!replacements || inline) return;
  const mapFile = url ? findMapFile(distDir, file, url) : `${file}.map`;
  if (!mapFile || !fs.existsSync(mapFile)) return;
  const map = moveSourceMapFile(
    fs.readFileSync(mapFile, 'utf8'),
    code,
    replacements
  );
  if (map !== undefined) fs.writeFileSync(mapFile, map);
}
