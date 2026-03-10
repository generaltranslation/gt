import fs from 'node:fs';
import { Updates } from '../../types/index.js';
import { extractFromPythonSource } from '@generaltranslation/python-extractor';
import { mapExtractionResultsToUpdates } from '../../extraction/mapToUpdates.js';
import {
  calculateHashes,
  dedupeUpdates,
  linkStaticUpdates,
} from '../../extraction/postProcess.js';
import { matchFiles } from '../../fs/matchFiles.js';
import {
  DEFAULT_PYTHON_SRC_PATTERNS,
  DEFAULT_PYTHON_SRC_EXCLUDES,
} from '../../config/generateSettings.js';

export async function createPythonInlineUpdates(
  filePatterns: string[] | undefined
): Promise<{ updates: Updates; errors: string[]; warnings: string[] }> {
  const updates: Updates = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  // Match Python source files, excluding common non-source directories
  const patterns = filePatterns || DEFAULT_PYTHON_SRC_PATTERNS;
  const files = matchFiles(process.cwd(), [
    ...patterns,
    ...DEFAULT_PYTHON_SRC_EXCLUDES.map((p) => `!${p}`),
  ]);

  for (const file of files) {
    const code = await fs.promises.readFile(file, 'utf8');
    try {
      const {
        results,
        errors: fileErrors,
        warnings: fileWarnings,
      } = await extractFromPythonSource(code, file);

      updates.push(...mapExtractionResultsToUpdates(results));
      errors.push(...fileErrors);
      warnings.push(...fileWarnings);
    } catch (error) {
      errors.push(`Error extracting from ${file}: ${String(error)}`);
    }
  }

  // Post processing steps
  await calculateHashes(updates);
  dedupeUpdates(updates);
  linkStaticUpdates(updates);

  return { updates, errors, warnings };
}
