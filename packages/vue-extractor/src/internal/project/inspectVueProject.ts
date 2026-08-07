import fs from 'node:fs';
import path from 'node:path';
import { parse as parseLegacyModule } from '@babel/parser';
import fg from 'fast-glob';
import type { VueProjectInspection } from '../../types.js';
import {
  discoverVueProject,
  findVueSourceScope,
  resolveProjectDirectory,
  type VueProjectDiscovery,
} from './scopes.js';
import { readJavaScriptPackageManifest } from './manifest.js';
import {
  createWorkspaceDiscoveryCache,
  readDeclaredWorkspacePackagesAsync,
} from './workspaces.js';

const discoveryByInspection = new WeakMap<
  VueProjectInspection,
  VueProjectDiscovery
>();

/** Discovers Vue workspace ownership once and returns a reusable opaque plan. */
export function inspectVueProject(
  cwd: string = process.cwd()
): VueProjectInspection {
  return createVueProjectInspection(discoverVueProject(cwd));
}

/**
 * Discovers Vue ownership while reading declared workspace manifests with
 * bounded asynchronous I/O.
 *
 * The asynchronous traversal pre-populates the same per-inspection cache used
 * by `discoverVueProject`, preserving its ownership semantics while allowing a
 * host framework to continue its existing extraction concurrently.
 */
export async function inspectVueProjectAsync(
  cwd: string = process.cwd()
): Promise<VueProjectInspection> {
  const projectRoot = resolveProjectDirectory(cwd);
  const rootManifest = readJavaScriptPackageManifest(
    path.join(projectRoot, 'package.json')
  );
  const cache = createWorkspaceDiscoveryCache();
  if (rootManifest) {
    await readDeclaredWorkspacePackagesAsync(projectRoot, rootManifest, cache);
  }
  return createVueProjectInspection(discoverVueProject(projectRoot, cache));
}

function createVueProjectInspection(
  discovery: VueProjectDiscovery
): VueProjectInspection {
  const inspection = Object.freeze({
    projectRoot: discovery.projectRoot,
    rootOwnsVue: discovery.rootOwnsVue,
    hasVueScopes: discovery.scopes.length > 0,
  });
  discoveryByInspection.set(inspection, discovery);
  return inspection;
}

/**
 * Returns exact negative globs for real Vue SFCs selected by explicit input.
 *
 * A `.vue` suffix alone is insufficient because the historical React parser
 * accepts arbitrary JSX modules with that extension. Only files inside a
 * discovered Vue scope whose source is classified as an SFC are partitioned.
 */
export function readVueSfcExclusionPatterns(
  inspection: VueProjectInspection,
  filePatterns: readonly string[]
): string[] {
  return partitionVueSourcePatterns(inspection, filePatterns)
    .primaryExclusionPatterns;
}

/**
 * Partitions explicitly selected `.vue` files between a historical parser and
 * the companion Vue extractor.
 *
 * A lone `<template>`, `<script>`, or `<style>` expression is valid both as a
 * Vue block and as a Babel JSX module. Those ambiguous files stay with the
 * historical parser so adding Vue support cannot remove existing messages,
 * while the companion Vue pass skips them to avoid duplicate or invalid SFC
 * diagnostics. Vue-primary and default Vue discovery do not use this explicit
 * mixed-framework partition and continue to accept template-only SFCs.
 */
export function partitionVueSourcePatterns(
  inspection: VueProjectInspection,
  filePatterns: readonly string[]
): {
  primaryExclusionPatterns: string[];
  vueExclusionPatterns: string[];
} {
  const discovery = readVueProjectInspection(
    inspection,
    inspection.projectRoot
  );
  if (!discovery) {
    return { primaryExclusionPatterns: [], vueExclusionPatterns: [] };
  }

  let matches: string[];
  try {
    matches = fg.sync([...filePatterns], {
      absolute: true,
      cwd: discovery.projectRoot,
      followSymbolicLinks: false,
      ignore: ['**/node_modules/**'],
      onlyFiles: true,
      unique: true,
    });
  } catch {
    return { primaryExclusionPatterns: [], vueExclusionPatterns: [] };
  }

  const primaryExclusionPatterns: string[] = [];
  const vueExclusionPatterns: string[] = [];
  for (const file of matches) {
    let realFile: string;
    try {
      realFile = fs.realpathSync(file);
    } catch {
      continue;
    }
    if (
      path.extname(realFile).toLowerCase() !== '.vue' ||
      !findVueSourceScope(realFile, discovery.scopes)
    ) {
      continue;
    }
    let source: string;
    try {
      source = fs.readFileSync(realFile, 'utf8');
    } catch {
      continue;
    }
    const classification = classifyVueSource(source);
    const exclusion = `!${fg.escapePath(toPosixPath(path.resolve(file)))}`;
    if (classification === 'definitive-sfc') {
      primaryExclusionPatterns.push(exclusion);
    } else if (classification === 'ambiguous-standard-tag-jsx') {
      vueExclusionPatterns.push(exclusion);
    }
  }
  return {
    primaryExclusionPatterns: [...new Set(primaryExclusionPatterns)],
    vueExclusionPatterns: [...new Set(vueExclusionPatterns)],
  };
}

/** Returns the package-private discovery carried by a valid inspection. */
export function readVueProjectInspection(
  inspection: VueProjectInspection | undefined,
  projectRoot: string
): VueProjectDiscovery | undefined {
  if (
    !inspection ||
    resolveProjectDirectory(inspection.projectRoot) !==
      resolveProjectDirectory(projectRoot)
  ) {
    return undefined;
  }
  return discoveryByInspection.get(inspection);
}

/**
 * Distinguishes a conventional SFC from a script module named with `.vue`.
 *
 * Vue tolerates arbitrary text before its first block, but treating every such
 * file as an SFC would hide Babel-valid legacy modules from the existing
 * parser. A complete JavaScript module wins even when its first JSX expression
 * uses a standard SFC tag; lone standard-tag expressions remain Vue blocks.
 */
export function isVueSfcSource(source: string): boolean {
  return classifyVueSource(source) !== 'non-sfc';
}

type VueSourceClassification =
  | 'definitive-sfc'
  | 'ambiguous-standard-tag-jsx'
  | 'non-sfc';

/** Classifies standard-tag JSX separately from unambiguous Vue SFC source. */
function classifyVueSource(source: string): VueSourceClassification {
  let remainder = source.replace(/^\uFEFF/, '').trimStart();
  let javascriptClassification: JavaScriptModuleClassification | undefined;
  const readJavaScriptClassification = () => {
    javascriptClassification ??= classifyJavaScriptModule(source);
    return javascriptClassification;
  };
  while (remainder) {
    const afterPrelude = stripLeadingSfcPrelude(remainder);
    if (afterPrelude === undefined) return 'non-sfc';
    remainder = afterPrelude;
    if (!remainder) return 'non-sfc';

    const openingTag = readLeadingBlockTag(remainder);
    if (!openingTag) {
      if (readJavaScriptClassification() === 'module') return 'non-sfc';
      const nextBlock = findNextBlockStart(remainder);
      if (nextBlock < 0) return 'non-sfc';
      remainder = remainder.slice(nextBlock);
      continue;
    }
    if (STANDARD_SFC_BLOCKS.has(openingTag.name.toLowerCase())) {
      const classification = readJavaScriptClassification();
      if (classification === 'module') return 'non-sfc';
      return classification === 'ambiguous-standard-tag-jsx'
        ? 'ambiguous-standard-tag-jsx'
        : 'definitive-sfc';
    }

    if (openingTag.selfClosing) {
      remainder = remainder.slice(openingTag.end).trimStart();
      continue;
    }
    const closingTag = new RegExp(
      `</${escapeRegularExpression(openingTag.name)}\\s*>`,
      'i'
    ).exec(remainder.slice(openingTag.end));
    if (!closingTag) return 'non-sfc';
    remainder = remainder
      .slice(openingTag.end + closingTag.index + closingTag[0].length)
      .trimStart();
  }
  return 'non-sfc';
}

const STANDARD_SFC_BLOCKS = new Set(['template', 'script', 'style']);

/** Removes common top-level prelude forms accepted by Vue's SFC compiler. */
function stripLeadingSfcPrelude(source: string): string | undefined {
  let remainder = source.trimStart();
  while (remainder) {
    if (remainder.startsWith('<!--')) {
      const end = remainder.indexOf('-->');
      if (end < 0) return undefined;
      remainder = remainder.slice(end + 3).trimStart();
      continue;
    }
    if (remainder.startsWith('/*')) {
      const end = remainder.indexOf('*/', 2);
      if (end < 0) return undefined;
      remainder = remainder.slice(end + 2).trimStart();
      continue;
    }
    if (remainder.startsWith('//')) {
      const end = remainder.search(/[\r\n]/);
      remainder = end < 0 ? '' : remainder.slice(end + 1).trimStart();
      continue;
    }
    if (remainder.startsWith('#!')) {
      const end = remainder.search(/[\r\n]/);
      remainder = end < 0 ? '' : remainder.slice(end + 1).trimStart();
      continue;
    }
    const doctype = /^<!doctype(?:\s[^>]*)?>/i.exec(remainder);
    if (doctype) {
      remainder = remainder.slice(doctype[0].length).trimStart();
      continue;
    }
    break;
  }
  return remainder;
}

type JavaScriptModuleClassification =
  | 'ambiguous-standard-tag-jsx'
  | 'invalid'
  | 'module';

/** Distinguishes complete modules from lone standard-tag JSX expressions. */
function classifyJavaScriptModule(
  source: string
): JavaScriptModuleClassification {
  try {
    const ast = parseLegacyModule(source, {
      plugins: ['jsx', 'typescript'],
      sourceType: 'module',
    });
    if (ast.program.directives.length > 0) return 'module';

    let foundStandardBlock = false;
    for (const statement of ast.program.body) {
      if (statement.type === 'EmptyStatement') continue;
      if (
        statement.type === 'ExpressionStatement' &&
        statement.expression.type === 'JSXElement' &&
        statement.expression.extra?.parenthesized !== true &&
        statement.expression.openingElement.name.type === 'JSXIdentifier' &&
        STANDARD_SFC_BLOCKS.has(
          statement.expression.openingElement.name.name.toLowerCase()
        )
      ) {
        foundStandardBlock = true;
        continue;
      }
      return 'module';
    }
    return foundStandardBlock ? 'ambiguous-standard-tag-jsx' : 'module';
  } catch {
    return 'invalid';
  }
}

/** Finds the next possible top-level block after compiler-tolerated text. */
function findNextBlockStart(source: string): number {
  return source.search(/<[A-Za-z][A-Za-z0-9._-]*(?=[\s/>])/);
}

/** Reads one complete opening block tag while respecting quoted attributes. */
function readLeadingBlockTag(
  source: string
): { end: number; name: string; selfClosing: boolean } | undefined {
  const nameMatch = /^<([A-Za-z][A-Za-z0-9._-]*)(?=[\s/>])/.exec(source);
  if (!nameMatch) return undefined;

  let quote: '"' | "'" | undefined;
  for (let index = nameMatch[0].length; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === quote) quote = undefined;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character !== '>') continue;
    return {
      end: index + 1,
      name: nameMatch[1]!,
      selfClosing: source.slice(0, index).trimEnd().endsWith('/'),
    };
  }
  return undefined;
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join(path.posix.sep);
}
