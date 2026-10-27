import MagicString from 'magic-string';
import {
  collectGTBindings,
  GT_SVELTE_PACKAGE,
  hasGTBindings,
  resolveComponent,
} from './imports.js';
import type { GTBindings } from './imports.js';
import { collectStringCalls, type StringProblem } from './strings.js';
import { findSvelteTags } from './tags.js';
import {
  analyzeTranslation,
  RESERVED_PREFIX,
  type TranslationPlan,
} from './translation.js';
import { planVariables, type VariablePlan } from './variables.js';
import type {
  SourceCodeContext,
  SourceLocation,
  SvelteAnalysis,
  SvelteElementNode,
  SvelteExtractionError,
  SvelteNode,
  SvelteParse,
  SvelteRoot,
} from './types.js';

export type AnalyzeSvelteSourceOptions = {
  /** `parse` from the project's `svelte/compiler`. */
  parse: SvelteParse;
  filename?: string;
  /**
   * Include this many source lines before and after each site as its
   * `sourceCode`. Omit to leave out source code context.
   */
  surroundingLineCount?: number;
};

export type TransformSvelteSourceOptions = AnalyzeSvelteSourceOptions & {
  /**
   * Emit each `<T>`'s source children as `_source` so development builds can
   * request missing translations at runtime.
   */
  dev?: boolean;
};

export type TransformSvelteSourceResult = {
  code: string;
  map: ReturnType<MagicString['generateMap']>;
  /** Problems that prevented some `<T>` components from being transformed. */
  errors: SvelteExtractionError[];
};

type ParsedSource = {
  /** The source without a leading byte order mark, which AST offsets index. */
  source: string;
  /** Length of the stripped byte order mark: AST offset -> input offset. */
  bomLength: number;
  root: SvelteRoot;
  bindings: GTBindings;
  lineStarts: number[];
};

/**
 * Extracts every translatable `<T>` and string call from a Svelte component.
 * `<T>` components with problems are reported in `errors` and skipped.
 */
export function analyzeSvelteSource(
  source: string,
  options: AnalyzeSvelteSourceOptions
): SvelteAnalysis {
  const analysis: SvelteAnalysis = {
    translations: [],
    strings: [],
    errors: [],
    warnings: [],
  };
  const { surroundingLineCount } = options;
  const parsed = parseSource(source, options);
  if (!parsed) return analysis;

  const variables = planVariables(
    parsed.source,
    parsed.root.fragment,
    parsed.bindings
  );
  const { plans, errors } = planTranslations(parsed, variables);
  analysis.errors.push(...errors);
  for (const plan of plans) {
    analysis.translations.push({
      source: plan.source,
      hash: plan.hash,
      metadata: plan.metadata,
      location: toLocation(parsed, plan.node.start),
      ...(surroundingLineCount !== undefined && {
        sourceCode: getSourceCode(
          parsed,
          plan.node.start,
          plan.node.end,
          surroundingLineCount
        ),
      }),
    });
  }

  const { calls, problems, warnings } = collectStringCalls(
    parsed.root,
    parsed.bindings
  );
  calls.sort((a, b) => a.offset - b.offset);
  for (const call of calls) {
    analysis.strings.push({
      source: call.source,
      hash: call.hash,
      dataFormat: call.dataFormat,
      metadata: call.metadata,
      location: toLocation(parsed, call.offset),
      ...(surroundingLineCount !== undefined && {
        sourceCode: getSourceCode(
          parsed,
          call.offset,
          call.end,
          surroundingLineCount
        ),
      }),
    });
  }
  const toError = (problem: StringProblem): SvelteExtractionError => ({
    whatHappened: problem.whatHappened,
    ...(problem.fix && { fix: problem.fix }),
    location: toLocation(parsed, problem.offset),
  });
  analysis.errors.push(...problems.map(toError));
  analysis.warnings.push(...warnings.map(toError));
  return analysis;
}

/**
 * Rewrites every `<T>` in a Svelte component so it can render translations
 * without seeing its children at runtime. Returns `null` when the component
 * does not use gt-svelte's `<T>`.
 */
export function transformSvelteSource(
  source: string,
  options: TransformSvelteSourceOptions
): TransformSvelteSourceResult | null {
  const parsed = parseSource(source, options);
  if (!parsed) return null;

  const variables = planVariables(
    parsed.source,
    parsed.root.fragment,
    parsed.bindings
  );
  const { plans, errors } = planTranslations(parsed, variables);
  if (
    plans.length === 0 &&
    errors.length === 0 &&
    variables.edits.length === 0
  ) {
    return null;
  }

  // Edits use AST offsets, which do not count the byte order mark.
  const magic = new MagicString(source, { offset: parsed.bomLength });
  for (const edit of variables.edits) {
    magic.overwrite(edit.start, edit.end, edit.text);
  }
  for (const plan of plans) {
    applyPlan(parsed.source, magic, plan, options.dev === true);
  }

  return {
    code: magic.toString(),
    map: magic.generateMap({
      hires: true,
      includeContent: true,
      ...(options.filename && { source: options.filename }),
    }),
    errors,
  };
}

function parseSource(
  input: string,
  { parse, filename }: AnalyzeSvelteSourceOptions
): ParsedSource | null {
  // Cheap pre-check: every supported usage imports from gt-svelte.
  if (!input.includes(GT_SVELTE_PACKAGE)) return null;
  // parse() strips a leading byte order mark, so strip it here too and
  // keep AST offsets and source indexes aligned.
  const bomLength = input.charCodeAt(0) === 0xfeff ? 1 : 0;
  const source = input.slice(bomLength);
  const root = parseWithoutStyles(source, parse, filename);
  const bindings = collectGTBindings(root);
  if (!hasGTBindings(bindings)) return null;
  return {
    source,
    bomLength,
    root,
    bindings,
    lineStarts: getLineStarts(source),
  };
}

type Range = { start: number; end: number };

/**
 * Parses a component with its top-level `<style>` contents blanked out.
 *
 * Extraction never reads styles, and the CLI (or a preprocessor running
 * before Sass or PostCSS) sees styles that Svelte's CSS parser rejects, such
 * as SCSS comments and variables. Blanking keeps every offset and line break,
 * so AST positions still index the original source.
 */
function parseWithoutStyles(
  source: string,
  parse: SvelteParse,
  filename: string | undefined
): SvelteRoot {
  const options = { modern: true as const, ...(filename && { filename }) };
  const styles: Range[] = [];
  for (const { content } of findSvelteTags(source, ['style'])) {
    if (content) styles.push(content);
  }
  if (styles.length === 0) return parse(source, options) as SvelteRoot;

  const root = parse(blankRanges(source, styles), options) as SvelteRoot;
  // A <style> inside an element is markup text, so keep it as written.
  const css = root.css;
  const topLevel = styles.filter(
    (style) => css && style.start >= css.start && style.end <= css.end
  );
  if (topLevel.length === styles.length) return root;
  return parse(blankRanges(source, topLevel), options) as SvelteRoot;
}

/** Replaces every character in `ranges` except line breaks with a space. */
function blankRanges(source: string, ranges: Range[]): string {
  let result = '';
  let cursor = 0;
  for (const { start, end } of ranges) {
    result +=
      source.slice(cursor, start) +
      source.slice(start, end).replace(/[^\r\n]/g, ' ');
    cursor = end;
  }
  return result + source.slice(cursor);
}

function planTranslations(
  parsed: ParsedSource,
  variables: VariablePlan
): {
  plans: TranslationPlan[];
  errors: SvelteExtractionError[];
} {
  const { source, root, bindings } = parsed;
  const plans: TranslationPlan[] = [];
  const errors: SvelteExtractionError[] = variables.problems.map((problem) => ({
    whatHappened: problem.whatHappened,
    ...(problem.fix && { fix: problem.fix }),
    location: toLocation(parsed, problem.offset),
  }));
  const components = findTranslationComponents(root.fragment, bindings);
  if (components.length === 0) return { plans, errors };

  const reservedIndex = source.indexOf(RESERVED_PREFIX);
  if (reservedIndex !== -1) {
    errors.push({
      whatHappened: `Identifiers starting with "${RESERVED_PREFIX}" are reserved for the gt-svelte preprocessor`,
      fix: 'Rename the identifier',
      location: toLocation(parsed, reservedIndex),
    });
    return { plans, errors };
  }

  for (const node of components) {
    const analysis = analyzeTranslation(
      source,
      node,
      bindings,
      variables.edits
    );
    if (!analysis.ok) {
      for (const problem of analysis.problems) {
        errors.push({
          whatHappened: problem.whatHappened,
          ...(problem.fix && { fix: problem.fix }),
          location: toLocation(parsed, problem.offset),
        });
      }
      continue;
    }
    if (analysis.plan) plans.push(analysis.plan);
  }
  return { plans, errors };
}

/** Finds `<T>` components, without descending into them. */
function findTranslationComponents(
  value: unknown,
  bindings: GTBindings,
  found: SvelteElementNode[] = []
): SvelteElementNode[] {
  if (!value || typeof value !== 'object') return found;
  if (Array.isArray(value)) {
    for (const item of value) findTranslationComponents(item, bindings, found);
    return found;
  }
  const node = value as SvelteNode;
  if (
    node.type === 'Component' &&
    resolveComponent(bindings, node.name as string) === 'T'
  ) {
    found.push(node as SvelteElementNode);
    return found;
  }
  for (const key in node) {
    if (key === 'metadata' || key === 'loc' || key === 'name_loc') continue;
    const child = node[key];
    if (child && typeof child === 'object') {
      findTranslationComponents(child, bindings, found);
    }
  }
  return found;
}

function applyPlan(
  source: string,
  magic: MagicString,
  plan: TranslationPlan,
  dev: boolean
): void {
  const { node } = plan;
  const nameEnd = node.start + 1 + node.name.length;
  let props = ` _hash=${JSON.stringify(plan.hash)}`;
  if (plan.runtimeMetadata.v || plan.runtimeMetadata.b) {
    props += ` _gtm={${JSON.stringify(plan.runtimeMetadata)}}`;
  }
  if (dev) {
    props += ` _source={${JSON.stringify(plan.source)}}`;
  }
  magic.appendLeft(nameEnd, props);

  for (const edit of plan.edits) {
    if (edit.text) {
      magic.overwrite(edit.start, edit.end, edit.text);
    } else {
      magic.remove(edit.start, edit.end);
    }
  }

  const closeStart = source.lastIndexOf('</', node.end - 1);
  magic.appendRight(closeStart, plan.snippets.join(''));
}

/** Offsets where lines start, after `\r\n`, `\n`, or a lone `\r`. */
function getLineStarts(source: string): number[] {
  const starts = [0];
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '\n' || (char === '\r' && source[i + 1] !== '\n')) {
      starts.push(i + 1);
    }
  }
  return starts;
}

/** Returns the lines spanning `start`..`end` and the lines around them. */
function getSourceCode(
  parsed: ParsedSource,
  start: number,
  end: number,
  surroundingLineCount: number
): SourceCodeContext {
  const { source, lineStarts } = parsed;
  const lines = (from: number, to: number) => {
    const result: string[] = [];
    for (
      let line = Math.max(0, from);
      line < Math.min(to, lineStarts.length);
      line++
    ) {
      const text = source.slice(lineStarts[line], lineStarts[line + 1]);
      result.push(text.replace(/(?:\r\n?|\n)$/, ''));
    }
    return result.join('\n');
  };
  const first = toLocation(parsed, start).line - 1;
  const last = toLocation(parsed, end).line - 1;
  return {
    before: lines(first - surroundingLineCount, first),
    target: lines(first, last + 1),
    after: lines(last + 1, last + 1 + surroundingLineCount),
  };
}

/** Locates an AST offset; `offset` in the result indexes the input string. */
function toLocation(
  { lineStarts, bomLength }: ParsedSource,
  offset: number
): SourceLocation {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (lineStarts[mid] <= offset) low = mid;
    else high = mid - 1;
  }
  return {
    line: low + 1,
    column: offset - lineStarts[low],
    offset: offset + bomLength,
  };
}
