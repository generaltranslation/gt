import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../console/logger.js';
import chalk from 'chalk';
import micromatch from 'micromatch';

export type RefMapEntry = {
  sourceFile: string;
  refPath: string;
  containingDir: string;
  originalContent: unknown;
};

export type RefMap = Map<string, RefMapEntry>;

export type ResolvedRefs = {
  resolved: unknown;
  refMap: RefMap;
};

/**
 * Resolve all Mintlify $ref references in a parsed JSON object.
 *
 * Returns the fully-expanded JSON and a refMap that tracks which subtrees
 * came from which files (used later to split translated output back into
 * the same file topology).
 */
export function resolveMintlifyRefs(
  json: unknown,
  filePath: string
): ResolvedRefs {
  const refMap: RefMap = new Map();
  const resolved = resolveNode(
    json,
    path.dirname(path.resolve(filePath)),
    '',
    new Set<string>(),
    refMap
  );
  return { resolved, refMap };
}

function resolveNode(
  node: unknown,
  baseDir: string,
  pointer: string,
  visiting: Set<string>,
  refMap: RefMap
): unknown {
  if (node === null || typeof node !== 'object') return node;

  if (Array.isArray(node)) {
    return node.map((item, i) =>
      resolveNode(item, baseDir, `${pointer}/${i}`, visiting, refMap)
    );
  }

  const obj = node as Record<string, unknown>;

  if (typeof obj['$ref'] === 'string') {
    return resolveRef(obj, baseDir, pointer, visiting, refMap);
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = resolveNode(
      value,
      baseDir,
      `${pointer}/${key}`,
      visiting,
      refMap
    );
  }
  return result;
}

function resolveRef(
  obj: Record<string, unknown>,
  baseDir: string,
  pointer: string,
  visiting: Set<string>,
  refMap: RefMap
): unknown {
  const refPath = obj['$ref'] as string;

  if (!isRelativePath(refPath)) {
    logger.warn(
      chalk.yellow(
        `Skipping non-relative $ref at ${pointer || '/'}: ${refPath}`
      )
    );
    const { $ref: _, ...rest } = obj;
    return rest;
  }

  const resolvedFilePath = path.resolve(baseDir, refPath);

  if (visiting.has(resolvedFilePath)) {
    logger.warn(
      chalk.yellow(`Circular $ref detected at ${pointer || '/'}: ${refPath}`)
    );
    const { $ref: _, ...rest } = obj;
    return rest;
  }

  if (!fs.existsSync(resolvedFilePath)) {
    logger.warn(
      chalk.yellow(
        `$ref file not found at ${pointer || '/'}: ${refPath} (resolved to ${resolvedFilePath})`
      )
    );
    const { $ref: _, ...rest } = obj;
    return rest;
  }

  let fileContent: string;
  try {
    fileContent = fs.readFileSync(resolvedFilePath, 'utf-8');
  } catch {
    logger.warn(chalk.yellow(`Failed to read $ref file: ${resolvedFilePath}`));
    const { $ref: _, ...rest } = obj;
    return rest;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fileContent);
  } catch {
    logger.warn(
      chalk.yellow(`$ref file is not valid JSON: ${resolvedFilePath}`)
    );
    const { $ref: _, ...rest } = obj;
    return rest;
  }

  // Record provenance before recursive resolution
  refMap.set(pointer, {
    sourceFile: resolvedFilePath,
    refPath,
    containingDir: baseDir,
    originalContent: parsed,
  });

  // Recursively resolve nested $ref in the referenced file
  const refFileDir = path.dirname(resolvedFilePath);
  const nextVisiting = new Set(visiting);
  nextVisiting.add(resolvedFilePath);

  const resolvedContent = resolveNode(
    parsed,
    refFileDir,
    pointer,
    nextVisiting,
    refMap
  );

  // Apply Mintlify merge rules
  const { $ref: _, ...siblings } = obj;

  if (
    resolvedContent !== null &&
    typeof resolvedContent === 'object' &&
    !Array.isArray(resolvedContent)
  ) {
    // Object: merge siblings on top (siblings take precedence)
    return { ...(resolvedContent as Record<string, unknown>), ...siblings };
  }

  // Non-object (array, string, number, etc.): replace entirely, drop siblings
  return resolvedContent;
}

/**
 * Check if a file should have $ref resolution applied based on the settings.
 * Returns true if the file matches a jsonSchema entry with resolveRefs: true.
 */
export function shouldResolveRefs(
  filePath: string,
  options?: { jsonSchema?: Record<string, any> }
): boolean {
  if (!options?.jsonSchema) return false;

  const relative = path.relative(process.cwd(), filePath);
  for (const [glob, schema] of Object.entries(options.jsonSchema)) {
    if (schema?.resolveRefs && micromatch.isMatch(relative, glob)) {
      return true;
    }
  }
  return false;
}

function isRelativePath(refPath: string): boolean {
  if (path.isAbsolute(refPath)) return false;
  if (/^[a-z]+:\/\//i.test(refPath)) return false;
  return true;
}
