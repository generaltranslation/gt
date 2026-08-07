import { parseScriptAst } from '../script/parser.js';

/** Classification shared by source partitioning and lightweight ownership. */
export type VueSourceClassification =
  | 'definitive-sfc'
  | 'ambiguous-standard-tag-jsx'
  | 'non-sfc';

const STANDARD_SFC_BLOCKS = new Set(['template', 'script', 'style']);

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

/** Classifies standard-tag JSX separately from unambiguous Vue SFC source. */
export function classifyVueSource(source: string): VueSourceClassification {
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
  for (const language of ['tsx', 'flow']) {
    let ast: ReturnType<typeof parseScriptAst>;
    try {
      ast = parseScriptAst(source, language);
    } catch {
      continue;
    }
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
  }
  return 'invalid';
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
