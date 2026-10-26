import MagicString from 'magic-string';
import {
  collectGTBindings,
  GT_SVELTE_PACKAGE,
  hasGTBindings,
  resolveComponent,
} from './imports.js';
import type { GTBindings } from './imports.js';
import { collectStringCalls } from './strings.js';
import {
  analyzeTranslation,
  RESERVED_PREFIX,
  type TranslationPlan,
} from './translation.js';
import type {
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
  };
  const parsed = parseSource(source, options);
  if (!parsed) return analysis;

  const { plans, errors } = planTranslations(source, parsed);
  analysis.errors.push(...errors);
  for (const plan of plans) {
    analysis.translations.push({
      source: plan.source,
      hash: plan.hash,
      metadata: plan.metadata,
      location: toLocation(parsed.lineStarts, plan.node.start),
    });
  }

  const { calls, problems } = collectStringCalls(parsed.root, parsed.bindings);
  calls.sort((a, b) => a.offset - b.offset);
  for (const call of calls) {
    analysis.strings.push({
      source: call.source,
      hash: call.hash,
      metadata: call.metadata,
      location: toLocation(parsed.lineStarts, call.offset),
    });
  }
  for (const problem of problems) {
    analysis.errors.push({
      whatHappened: problem.whatHappened,
      ...(problem.fix && { fix: problem.fix }),
      location: toLocation(parsed.lineStarts, problem.offset),
    });
  }
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

  const { plans, errors } = planTranslations(source, parsed);
  if (plans.length === 0 && errors.length === 0) return null;

  const magic = new MagicString(source);
  for (const plan of plans) {
    applyPlan(source, magic, plan, options.dev === true);
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
  source: string,
  { parse, filename }: AnalyzeSvelteSourceOptions
): ParsedSource | null {
  // Cheap pre-check: every supported usage imports from gt-svelte.
  if (!source.includes(GT_SVELTE_PACKAGE)) return null;
  const root = parse(source, {
    modern: true,
    ...(filename && { filename }),
  }) as SvelteRoot;
  const bindings = collectGTBindings(root);
  if (!hasGTBindings(bindings)) return null;
  return { root, bindings, lineStarts: getLineStarts(source) };
}

function planTranslations(
  source: string,
  { root, bindings, lineStarts }: ParsedSource
): { plans: TranslationPlan[]; errors: SvelteExtractionError[] } {
  const plans: TranslationPlan[] = [];
  const errors: SvelteExtractionError[] = [];
  const components = findTranslationComponents(root.fragment, bindings);
  if (components.length === 0) return { plans, errors };

  const reservedIndex = source.indexOf(RESERVED_PREFIX);
  if (reservedIndex !== -1) {
    errors.push({
      whatHappened: `Identifiers starting with "${RESERVED_PREFIX}" are reserved for the gt-svelte preprocessor`,
      fix: 'Rename the identifier',
      location: toLocation(lineStarts, reservedIndex),
    });
    return { plans, errors };
  }

  for (const node of components) {
    const analysis = analyzeTranslation(source, node, bindings);
    if (!analysis.ok) {
      for (const problem of analysis.problems) {
        errors.push({
          whatHappened: problem.whatHappened,
          ...(problem.fix && { fix: problem.fix }),
          location: toLocation(lineStarts, problem.offset),
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

function getLineStarts(source: string): number[] {
  const starts = [0];
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '\n') starts.push(i + 1);
  }
  return starts;
}

function toLocation(lineStarts: number[], offset: number): SourceLocation {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (lineStarts[mid] <= offset) low = mid;
    else high = mid - 1;
  }
  return { line: low + 1, column: offset - lineStarts[low], offset };
}
