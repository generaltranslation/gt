import fs from 'node:fs';
import path from 'node:path';
import { extractFromVueSource } from '@generaltranslation/vue-extractor';
import { resolveVueCompilerOptions } from '@generaltranslation/vue-extractor/config';
import type { Updates } from '../../types/index.js';
import type { GTParsingFlags } from '../../types/parsing.js';
import { matchFiles } from '../../fs/matchFiles.js';
import { DEFAULT_VUE_SRC_PATTERNS } from '../../config/generateSettings.js';
import {
  calculateHashes,
  dedupeUpdates,
} from '../../extraction/postProcess.js';

const SCRIPT_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
]);

/**
 * Discovers Vue source files and adapts package-owned extraction results to
 * the CLI update pipeline.
 */
export async function createVueInlineUpdates(
  filePatterns: string[] | undefined,
  parsingFlags: GTParsingFlags
): Promise<{ updates: Updates; errors: string[]; warnings: string[] }> {
  const updates: Updates = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const projectRoot = process.cwd();
  const files = matchFiles(
    projectRoot,
    filePatterns ?? DEFAULT_VUE_SRC_PATTERNS
  );
  const hasVueFiles = files.some(
    (file) => path.extname(file).toLowerCase() === '.vue'
  );
  const compilerResolution = hasVueFiles
    ? resolveVueCompilerOptions(projectRoot, parsingFlags.vueCompilerOptions, {
        viteConfigPath: parsingFlags.viteConfigPath,
      })
    : { compilerOptions: {}, errors: [] };

  if (compilerResolution.errors.length > 0) {
    return { updates, errors: compilerResolution.errors, warnings };
  }

  for (const file of files) {
    const extension = path.extname(file).toLowerCase();
    if (extension !== '.vue' && !SCRIPT_EXTENSIONS.has(extension)) continue;

    const source = await fs.promises.readFile(file, 'utf8');
    const result = await extractFromVueSource(source, file, {
      compilerOptions: compilerResolution.compilerOptions,
      includeSourceCodeContext: parsingFlags.includeSourceCodeContext,
      projectRoot,
    });
    updates.push(...result.results);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }

  await calculateHashes(updates);
  dedupeUpdates(updates);
  return { updates, errors, warnings: [...new Set(warnings)] };
}
