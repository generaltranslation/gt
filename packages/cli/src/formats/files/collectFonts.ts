import { readFile } from 'node:fs/promises';
import path from 'node:path';

import fg from 'fast-glob';

import type { Settings } from '../../types/index.js';
import { toPosixGlob } from '../../utils/paths.js';

// One font to upload to /v2/project/assets. Structurally matches the SDK's
// AssetUpload; content is base64 (fonts are binary).
export type FontUpload = {
  assetType: 'FONT';
  fileName: string;
  content: string;
};

// Resolve the config's `fonts` globs to base64-encoded font uploads. Fonts are
// locale-invariant, so there's no [locale] placeholder — just match the files
// and read them as binary.
export async function collectFonts(settings: Settings): Promise<FontUpload[]> {
  const fonts = settings.fonts;
  if (!fonts?.include?.length) return [];

  // `files.include` globs resolve from the cwd generateSettings ran in, and
  // configDirectory is always `<cwd>/.gt` — so its parent is that same project
  // root. Globbing from configDirectory itself would search under `.gt/`.
  const cwd = settings.configDirectory
    ? path.dirname(settings.configDirectory)
    : process.cwd();
  const matches = await fg(fonts.include.map(toPosixGlob), {
    cwd,
    ignore: fonts.exclude?.map(toPosixGlob) ?? [],
    absolute: true,
    onlyFiles: true,
    unique: true,
  });

  const uploads: FontUpload[] = [];
  for (const absolutePath of matches) {
    const bytes = await readFile(absolutePath);
    uploads.push({
      assetType: 'FONT',
      fileName: path.basename(absolutePath),
      content: bytes.toString('base64'),
    });
  }
  return uploads;
}
