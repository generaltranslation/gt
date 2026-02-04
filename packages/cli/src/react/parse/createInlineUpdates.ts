import fs from 'node:fs';
import { Updates } from '../../types/index.js';

import { parse } from '@babel/parser';
import { hashSource, hashString } from 'generaltranslation/id';
import { parseTranslationComponent } from '../jsx/utils/jsxParsing/parseJsx.js';
import { parseStrings } from '../jsx/utils/parseStringFunction.js';
import { logger } from '../../console/logger.js';
import { matchFiles } from '../../fs/matchFiles.js';
import { DEFAULT_SRC_PATTERNS } from '../../config/generateSettings.js';
import type { ParsingConfigOptions } from '../../types/parsing.js';
import { getPathsAndAliases } from '../jsx/utils/getPathsAndAliases.js';
import { GTLibrary, GT_LIBRARIES_UPSTREAM } from '../jsx/utils/constants.js';

export async function createInlineUpdates(
  pkg: GTLibrary,
  validate: boolean,
  filePatterns: string[] | undefined,
  parsingOptions: ParsingConfigOptions
): Promise<{ updates: Updates; errors: string[]; warnings: string[] }> {
  const updates: Updates = [];

  const errors: string[] = [];
  const warnings: Set<string> = new Set();

  const pkgs = getUpstreamPackages(pkg);

  // Use the provided app directory or default to the current directory
  const files = matchFiles(process.cwd(), filePatterns || DEFAULT_SRC_PATTERNS);

  for (const file of files) {
    const code = await fs.promises.readFile(file, 'utf8');
    let ast;
    try {
      ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });
    } catch (error) {
      logger.error(`Error parsing file ${file}: ${error}`);
      continue;
    }

    // First pass: collect imports and process translation functions
    const { importAliases, inlineTranslationPaths, translationComponentPaths } =
      getPathsAndAliases(ast, pkgs);

    // Process translation functions asynchronously
    for (const {
      localName: name,
      originalName,
      path,
    } of inlineTranslationPaths) {
      parseStrings(
        name,
        originalName,
        path,
        {
          parsingOptions,
          file,
          ignoreAdditionalData: false,
          ignoreDynamicContent: false,
          ignoreInvalidIcu: false,
        },
        { updates, errors, warnings }
      );
    }

    // Parse <T> components
    for (const { localName, path } of translationComponentPaths) {
      parseTranslationComponent({
        originalName: localName,
        localName,
        path,
        updates,
        config: {
          importAliases,
          parsingOptions,
          pkgs,
          file,
        },
        output: {
          errors,
          warnings,
          unwrappedExpressions: [],
        },
      });
    }
  }

  // Post processing steps:
  await calculateHashes(updates);
  dedupeUpdates(updates);
  linkStaticUpdates(updates);

  return { updates, errors, warnings: [...warnings] };
}

/**
 * Given a package name, return the upstream packages that it depends on
 * @param pkg
 */
function getUpstreamPackages(pkg: GTLibrary): GTLibrary[] {
  return GT_LIBRARIES_UPSTREAM[pkg];
}

/**
 * Calculate hashes
 */
async function calculateHashes(updates: Updates): Promise<void> {
  // parallel calculation of hashes
  await Promise.all(
    updates.map(async (update) => {
      const hash = hashSource({
        source: update.source,
        ...(update.metadata.context && { context: update.metadata.context }),
        ...(update.metadata.id && { id: update.metadata.id }),
        ...(update.metadata.maxChars != null && {
          maxChars: update.metadata.maxChars,
        }),
        dataFormat: update.dataFormat,
      });
      update.metadata.hash = hash;
    })
  );
}

/**
 * Dedupe entries
 */
function dedupeUpdates(updates: Updates): void {
  const mergedByHash = new Map<string, (typeof updates)[number]>();
  const noHashUpdates: (typeof updates)[number][] = [];

  for (const update of updates) {
    const hash = update.metadata.hash;
    if (!hash) {
      noHashUpdates.push(update);
      continue;
    }

    const existing = mergedByHash.get(hash);
    if (!existing) {
      mergedByHash.set(hash, update);
      continue;
    }

    const existingPaths = Array.isArray(existing.metadata.filePaths)
      ? existing.metadata.filePaths.slice()
      : [];
    const newPaths = Array.isArray(update.metadata.filePaths)
      ? update.metadata.filePaths
      : [];

    for (const p of newPaths) {
      if (!existingPaths.includes(p)) {
        existingPaths.push(p);
      }
    }

    if (existingPaths.length) {
      existing.metadata.filePaths = existingPaths;
    }
  }

  const mergedUpdates = [...mergedByHash.values(), ...noHashUpdates];
  updates.splice(0, updates.length, ...mergedUpdates);
}

/**
 * Mark static updates as the related by attaching a shared id to static content
 * Id is calculated as the hash of the static children's combined hashes
 */
function linkStaticUpdates(updates: Updates): void {
  // construct map of temporary static ids to updates
  const temporaryStaticIdToUpdates = updates.reduce(
    (acc: Record<string, Updates[number][]>, update: Updates[number]) => {
      if (update.metadata.staticId) {
        if (!acc[update.metadata.staticId]) {
          acc[update.metadata.staticId] = [];
        }
        acc[update.metadata.staticId].push(update);
      }
      return acc;
    },
    {} as Record<string, Updates[number][]>
  );

  // Calculate shared static ids
  Object.values(temporaryStaticIdToUpdates).forEach((staticUpdates) => {
    const hashes = staticUpdates
      .map((update) => update.metadata.hash)
      .sort()
      .join('-');
    const sharedStaticId = hashString(hashes);
    staticUpdates.forEach((update) => {
      update.metadata.staticId = sharedStaticId;
    });
  });
}

export { dedupeUpdates as _test_dedupeUpdates };
