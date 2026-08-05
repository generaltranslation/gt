import fs from 'node:fs';
import path from 'node:path';
import { extractFromVueSource } from '@generaltranslation/vue-extractor';
import { resolveVueCompilerOptions } from '@generaltranslation/vue-extractor/config';
import type { VueCompilerOptions } from '@generaltranslation/vue-extractor/types';
import { createDiagnosticMessage } from 'generaltranslation/internal';
import type { Updates } from '../../types/index.js';
import type { GTParsingFlags } from '../../types/parsing.js';
import { matchFiles } from '../../fs/matchFiles.js';
import {
  findInlineSourceScope,
  readDefaultInlineSourcePatterns,
  readInlineSourceScopes,
  type InlineSourceScope,
} from '../../extraction/inlineSourceScopes.js';
import {
  calculateHashes,
  dedupeUpdates,
} from '../../extraction/postProcess.js';
import { Libraries } from '../../types/libraries.js';

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
  const scopes = readInlineSourceScopes(projectRoot, Libraries.GT_VUE);
  const files = matchFiles(
    projectRoot,
    filePatterns ??
      readDefaultInlineSourcePatterns(projectRoot, Libraries.GT_VUE),
    { followSymbolicLinks: false, stayWithinCwd: true }
  );
  const fileScopes = new Map(
    files.map((file) => [file, findInlineSourceScope(file, scopes)])
  );
  const compilerOptionsByScope = resolveCompilerOptionsByScope(
    projectRoot,
    files,
    fileScopes,
    scopes,
    parsingFlags,
    errors
  );

  if (errors.length > 0) {
    return { updates, errors, warnings };
  }

  for (const file of files) {
    const extension = path.extname(file).toLowerCase();
    if (extension !== '.vue' && !SCRIPT_EXTENSIONS.has(extension)) continue;

    const source = await fs.promises.readFile(file, 'utf8');
    const result = await extractFromVueSource(source, file, {
      compilerOptions:
        compilerOptionsByScope.get(fileScopes.get(file)?.directory ?? '') ?? {},
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

/** Resolves hash-affecting compiler settings within each owning Vue package. */
function resolveCompilerOptionsByScope(
  projectRoot: string,
  files: readonly string[],
  fileScopes: ReadonlyMap<string, InlineSourceScope>,
  scopes: readonly InlineSourceScope[],
  parsingFlags: GTParsingFlags,
  errors: string[]
): Map<string, VueCompilerOptions> {
  const optionsByScope = new Map<string, VueCompilerOptions>();
  const vueScopes = new Map<string, InlineSourceScope>();
  for (const file of files) {
    if (path.extname(file).toLowerCase() !== '.vue') continue;
    const scope = fileScopes.get(file);
    if (scope) vueScopes.set(scope.directory, scope);
  }
  if (vueScopes.size === 0) return optionsByScope;

  // An explicit path is documented relative to the command's project root,
  // but it belongs only to the package scope containing that config. Other
  // workspaces still need their own compiler behavior to preserve hash parity.
  if (parsingFlags.viteConfigPath !== undefined) {
    const explicitConfig = path.resolve(
      projectRoot,
      parsingFlags.viteConfigPath
    );
    const explicitResolution = resolveVueCompilerOptions(
      projectRoot,
      parsingFlags.vueCompilerOptions,
      { viteConfigPath: parsingFlags.viteConfigPath }
    );
    errors.push(...explicitResolution.errors);
    if (explicitResolution.errors.length > 0) return optionsByScope;

    const explicitScope =
      vueScopes.size === 1
        ? [...vueScopes.values()][0]!
        : findInlineSourceScope(explicitConfig, scopes);
    if (!vueScopes.has(explicitScope.directory)) {
      errors.push(
        createDiagnosticMessage({
          source: 'gt',
          severity: 'Error',
          whatHappened:
            'The configured Vite config does not own any matched Vue files',
          fix: 'Run extraction from that application root, include its Vue files in src, or remove files.gt.parsingFlags.viteConfigPath',
          details: parsingFlags.viteConfigPath,
        })
      );
      return optionsByScope;
    }
    for (const scope of vueScopes.values()) {
      const resolution =
        scope.directory === explicitScope.directory
          ? explicitResolution
          : resolveVueCompilerOptions(
              scope.directory,
              parsingFlags.vueCompilerOptions
            );
      errors.push(...resolution.errors);
      optionsByScope.set(scope.directory, resolution.compilerOptions);
    }
    return optionsByScope;
  }

  for (const scope of vueScopes.values()) {
    const resolution = resolveVueCompilerOptions(
      scope.directory,
      parsingFlags.vueCompilerOptions
    );
    errors.push(...resolution.errors);
    optionsByScope.set(scope.directory, resolution.compilerOptions);
  }

  return optionsByScope;
}
