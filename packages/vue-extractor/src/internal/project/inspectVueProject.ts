import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import fg from 'fast-glob';
import type { VueProjectInspection } from '../../types.js';
import {
  discoverVueProject,
  findVueSourceScope,
  resolveProjectDirectory,
  type VueProjectDiscovery,
} from './scopes.js';

const discoveryByInspection = new WeakMap<
  VueProjectInspection,
  VueProjectDiscovery
>();
const requireFromInspection = createRequire(import.meta.url);
let parseLegacyModule: typeof import('@babel/parser').parse | undefined;

/** Discovers Vue workspace ownership once and returns a reusable opaque plan. */
export function inspectVueProject(
  cwd: string = process.cwd()
): VueProjectInspection {
  const discovery = discoverVueProject(cwd);
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
  const discovery = readVueProjectInspection(
    inspection,
    inspection.projectRoot
  );
  if (!discovery) return [];

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
    return [];
  }

  const exclusions = matches.flatMap((file) => {
    let realFile: string;
    try {
      realFile = fs.realpathSync(file);
    } catch {
      return [];
    }
    if (
      path.extname(realFile).toLowerCase() !== '.vue' ||
      !findVueSourceScope(realFile, discovery.scopes)
    ) {
      return [];
    }
    let source: string;
    try {
      source = fs.readFileSync(realFile, 'utf8');
    } catch {
      return [];
    }
    if (!isVueSfcSource(source)) return [];
    return [`!${fg.escapePath(toPosixPath(path.resolve(file)))}`];
  });
  return [...new Set(exclusions)];
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
 * parser. Common SFC forms stay on the lightweight path. Only an ambiguous
 * text prefix lazily invokes the parser already used by source extraction.
 */
export function isVueSfcSource(source: string): boolean {
  let remainder = source.replace(/^\uFEFF/, '').trimStart();
  let checkedLegacyModule = false;
  while (remainder) {
    const afterPrelude = stripLeadingSfcPrelude(remainder);
    if (afterPrelude === undefined) return false;
    remainder = afterPrelude;
    if (!remainder) return false;

    const openingTag = readLeadingBlockTag(remainder);
    if (!openingTag) {
      if (!checkedLegacyModule) {
        checkedLegacyModule = true;
        if (isLegacyJavaScriptModule(source)) return false;
      }
      const nextBlock = findNextBlockStart(remainder);
      if (nextBlock < 0) return false;
      remainder = remainder.slice(nextBlock);
      continue;
    }
    if (STANDARD_SFC_BLOCKS.has(openingTag.name.toLowerCase())) return true;

    if (openingTag.selfClosing) {
      remainder = remainder.slice(openingTag.end).trimStart();
      continue;
    }
    const closingTag = new RegExp(
      `</${escapeRegularExpression(openingTag.name)}\\s*>`,
      'i'
    ).exec(remainder.slice(openingTag.end));
    if (!closingTag) return false;
    remainder = remainder
      .slice(openingTag.end + closingTag.index + closingTag[0].length)
      .trimStart();
  }
  return false;
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

/** Uses the historical parser only for ambiguous text-prefixed `.vue` files. */
function isLegacyJavaScriptModule(source: string): boolean {
  try {
    parseLegacyModule ??= (
      requireFromInspection('@babel/parser') as typeof import('@babel/parser')
    ).parse;
    const ast = parseLegacyModule(source, {
      plugins: ['jsx', 'typescript'],
      sourceType: 'module',
    });
    if (ast.program.directives.length > 0) return true;

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
      return true;
    }
    return !foundStandardBlock;
  } catch {
    return false;
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
