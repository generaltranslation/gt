/**
 * Converts i18next message catalogs to ICU, producing the merged per-locale
 * dictionary that gt-next's generated loadDictionary consumes. This is the core
 * react-i18next deliverable: every i18next-specific construct (suffix plurals,
 * ordinals, context selectors, `{{var}}` interpolation, `$t()` nesting) is
 * either mapped to its ICU equivalent or left literal and reported.
 *
 * Everything here is pure: inputs are raw JSON trees plus call-site evidence,
 * outputs are ICU trees plus a flat list of report entries. No filesystem, no
 * AST. That keeps it exhaustively unit-testable against the CLDR category sets
 * and @formatjs round-trips.
 */

const CATEGORY_ORDER = ['zero', 'one', 'two', 'few', 'many', 'other'] as const;
type PluralCategory = (typeof CATEGORY_ORDER)[number];
const ALL_CATEGORIES = new Set<string>(CATEGORY_ORDER);

/** i18next's builtin interpolation formatters we can represent in ICU. */
const MECHANICAL_FORMATTERS = new Set(['number', 'currency']);

export type Separators = {
  /** '.' by default; `false` means flat keys (dots are literal) — unsupported. */
  keySeparator: string | false;
  /** ':' by default; separates namespace from key in a `t('ns:key')` call. */
  nsSeparator: string | false;
  /** '_' by default; separates the base key from a context value. */
  contextSeparator: string;
  /** '_' by default; separates the base key from a plural category. */
  pluralSeparator: string;
};

export const DEFAULT_SEPARATORS: Separators = {
  keySeparator: '.',
  nsSeparator: ':',
  contextSeparator: '_',
  pluralSeparator: '_',
};

export type ConversionReport = {
  /** `{locale}/{ns}:{keypath}` — the exact catalog location that was reported. */
  key: string;
  reason: string;
};

export type ConvertInput = {
  defaultLocale: string;
  locales: string[];
  /** i18next default namespace (usually `translation`); merged at dict root. */
  defaultNS: string;
  /** locale -> namespace -> raw i18next JSON tree. */
  raw: Record<string, Record<string, Record<string, unknown>>>;
  separators?: Separators;
  /** `{ns}:{keypath}` base keys a scanned `t()` call passed `{ count }`. */
  countKeys?: Set<string>;
  /** `{ns}:{keypath}` base keys a scanned `t()` call passed `{ context }`. */
  contextKeys?: Set<string>;
  /** literal defaultValues from call sites, to synthesize missing entries. */
  defaults?: { ns: string; key: string; value: string }[];
  /** i18next-icu is installed: catalogs are already ICU (merge + escape only). */
  isIcu?: boolean;
};

export type ConvertResult = {
  /** merged ICU dictionary per locale (defaultNS at root, others nested). */
  byLocale: Record<string, Record<string, unknown>>;
  reports: ConversionReport[];
};

/** Raised when the catalog cannot be converted at all (caller refuses the run). */
export class CatalogConversionError extends Error {}

type LocalePlurals = {
  cardinal: Set<string>;
  ordinal: Set<string>;
};

function pluralCategoriesFor(locale: string): LocalePlurals {
  // i18next folder-backend projects use directory names as locale tags, so a
  // `pt_BR` dir arrives with an underscore. BCP-47 / Intl want hyphens; without
  // this every `_one`/`_few`/… would be reported "outside the CLDR set" and
  // left literal under a misleading reason.
  const tag = locale.replace(/_/g, '-');
  try {
    return {
      cardinal: new Set(
        new Intl.PluralRules(tag).resolvedOptions().pluralCategories
      ),
      ordinal: new Set(
        new Intl.PluralRules(tag, {
          type: 'ordinal',
        }).resolvedOptions().pluralCategories
      ),
    };
  } catch {
    // Unknown/invalid locale tag: fall back to the minimal set so we never
    // group on a category the runtime cannot resolve.
    return { cardinal: new Set(['other']), ordinal: new Set(['other']) };
  }
}

function orderCategories(cats: Iterable<string>): PluralCategory[] {
  const present = new Set(cats);
  return CATEGORY_ORDER.filter((c) => present.has(c));
}

// ---- ICU literal escaping --------------------------------------------------

/**
 * ICU-quotes the special characters `{`, `}`, and `'` in literal (non-argument)
 * text so @formatjs parses the message back to the original text. Each special
 * character is quoted independently: `{` -> `'{'`, `}` -> `'}'`, `'` -> `''`.
 * Verified by round-trip against the parser in the tests.
 */
export function escapeIcuText(text: string): string {
  let out = '';
  for (const ch of text) {
    if (ch === "'") out += "''";
    else if (ch === '{') out += "'{'";
    else if (ch === '}') out += "'}'";
    else out += ch;
  }
  return out;
}

// ---- interpolation + formatters (leaf level) -------------------------------

type LeafContext = {
  /** resolves a `$t(ns:key)` reference to its already-converted ICU value. */
  resolveNested: (ref: string, stack: string[]) => string | null;
  separators: Separators;
  isIcu?: boolean;
  /** for cycle detection across $t() inlining. */
  stack: string[];
  addReport: (reason: string) => void;
};

/**
 * Builds the ICU fraction-digit skeleton part (`.00#`) from an option bag's
 * min/max. Returns '' when neither is set and null when a value is not a valid
 * digit count. `maxWhenMinOnly` supplies the max when only min is given — Intl's
 * decimal default is 3 (`.00#`), so a min-only option must not cap the max at
 * the min (that forced `.00` and dropped real precision — the m6 finding).
 */
function fractionSkeleton(
  options: Record<string, string>,
  maxWhenMinOnly: (min: number) => number
): string | null {
  const min = options['minimumFractionDigits'];
  const max = options['maximumFractionDigits'];
  if (min === undefined && max === undefined) return '';
  const lo = min !== undefined ? Number(min) : undefined;
  const hi = max !== undefined ? Number(max) : undefined;
  const valid = (n: number | undefined) =>
    n === undefined || (Number.isInteger(n) && n >= 0 && n <= 20);
  if (!valid(lo) || !valid(hi)) return null;
  const minN = lo ?? 0;
  const maxN = hi ?? maxWhenMinOnly(minN);
  if (maxN < minN) return null;
  // ICU fraction-digit skeleton: `.` then min `0`s then up-to `#`s.
  return '.' + '0'.repeat(minN) + '#'.repeat(maxN - minN);
}

/** Maps an i18next `number(...)` option bag to an ICU number skeleton, or null. */
function numberSkeleton(optionText: string | undefined): string | null {
  if (optionText === undefined || optionText.trim() === '') return '';
  const options = parseOptionBag(optionText);
  if (options === null) return null;
  const parts: string[] = [];
  const fraction = fractionSkeleton(options, (minN) => Math.max(minN, 3));
  if (fraction === null) return null;
  if (fraction !== '') parts.push(fraction);
  if (options['useGrouping'] === 'false') parts.push('group-off');
  return parts.join(' ');
}

/** Parses `a: 1, b: false` (or `USD`) into a record; null if not parseable. */
function parseOptionBag(text: string): Record<string, string> | null {
  const result: Record<string, string> = {};
  const trimmed = text.trim();
  if (trimmed === '') return result;
  for (const part of trimmed.split(',')) {
    const [rawKey, ...rest] = part.split(':');
    if (rest.length === 0) return null; // positional arg, not an option bag
    result[rawKey.trim()] = rest.join(':').trim();
  }
  return result;
}

/** Converts the inside of one `{{ ... }}` placeholder to ICU. */
function convertPlaceholder(inner: string, ctx: LeafContext): string {
  let body = inner.trim();
  // Unescaped interpolation: i18next `{{- var}}` injects raw HTML. gt renders
  // dictionary strings as text, so the raw-HTML semantics are dropped; convert
  // the placeholder and report the behavior change.
  let unescaped = false;
  if (body.startsWith('-')) {
    unescaped = true;
    body = body.slice(1).trim();
  }
  const commaIndex = body.indexOf(',');
  const name = (commaIndex === -1 ? body : body.slice(0, commaIndex)).trim();
  const formatterSpec =
    commaIndex === -1 ? '' : body.slice(commaIndex + 1).trim();

  if (!/^[A-Za-z_][\w]*$/.test(name)) {
    // Nested var access (`{{obj.prop}}`), a `$`-prefixed name, or other shapes
    // ICU arg names cannot express (`$` is not a legal ICU argument name even
    // though i18next interpolates it): keep the raw text (escaped) and report.
    ctx.addReport(
      `interpolation \`{{${inner.trim()}}}\` uses a variable name ICU cannot express (e.g. a nested path); left as literal text — rewrite the key manually`
    );
    return escapeIcuText(`{{${inner}}}`);
  }

  if (unescaped) {
    ctx.addReport(
      `\`{{- ${name}}}\` renders raw HTML in react-i18next; gt renders dictionary values as text, so the markup is shown literally — move it into a <T> component if HTML is intended`
    );
  }

  if (formatterSpec === '') return `{${name}}`;

  return convertFormatter(name, formatterSpec, inner, ctx);
}

// Seam reserved for a future `--keep-i18next-format` mode (PR #1602): it would
// emit the leaf as `[value, { $format: 'I18NEXT' }]` and skip the ICU rewrite
// below so formatters render through i18next's own interpolation. v1 converts to
// ICU (zero runtime dependency), so this is the branch point when #1602 lands.
function convertFormatter(
  name: string,
  spec: string,
  inner: string,
  ctx: LeafContext
): string {
  // Chained formatters (`v, f1, f2`) have no ICU equivalent.
  // A top-level comma outside parentheses means a chain.
  if (hasTopLevelComma(spec)) {
    ctx.addReport(
      `chained formatters in \`{{${inner.trim()}}}\` have no ICU equivalent; value renders unformatted — use <T> or a custom renderer`
    );
    return `{${name}}`;
  }

  const callMatch = spec.match(/^([A-Za-z_][\w]*)\s*(?:\(([\s\S]*)\))?$/);
  if (!callMatch) {
    ctx.addReport(
      `formatter \`${spec}\` in \`{{${inner.trim()}}}\` is not recognized; value renders unformatted`
    );
    return `{${name}}`;
  }
  const fmt = callMatch[1];
  const args = callMatch[2];

  if (fmt === 'number') {
    const skeleton = numberSkeleton(args);
    if (skeleton === null) {
      ctx.addReport(
        `number options \`${args}\` in \`{{${inner.trim()}}}\` do not map to an ICU skeleton; value renders as a plain number`
      );
      return `{${name}, number}`;
    }
    return skeleton === ''
      ? `{${name}, number}`
      : `{${name}, number, ::${skeleton}}`;
  }

  if (fmt === 'currency') {
    const code = parseCurrencyCode(args);
    if (!code) {
      ctx.addReport(
        `currency formatter in \`{{${inner.trim()}}}\` has no resolvable ISO code; value renders as a plain number`
      );
      return `{${name}, number}`;
    }
    // Map min/max fraction-digit overrides into the skeleton (currency caps the
    // max at the min); an invalid digit count is dropped and reported instead of
    // silently discarded (the m8 finding).
    const options = parseOptionBag(args ?? '');
    let suffix = '';
    if (options !== null) {
      const fraction = fractionSkeleton(options, (minN) => minN);
      if (fraction === null) {
        ctx.addReport(
          `currency fraction-digit options in \`{{${inner.trim()}}}\` are not valid digit counts; dropped — the currency's default precision is used`
        );
      } else if (fraction !== '') {
        suffix = ` ${fraction}`;
      }
    }
    return `{${name}, number, ::currency/${code}${suffix}}`;
  }

  if (fmt === 'datetime') {
    if (args !== undefined && args.trim() !== '') {
      ctx.addReport(
        `datetime options in \`{{${inner.trim()}}}\` do not map to ICU date/time styles; approximated as \`date, medium\` — verify formatting`
      );
    } else {
      ctx.addReport(
        `\`{{${inner.trim()}}}\` datetime is approximated as ICU \`date, medium\` (i18next defaults to date+time); verify formatting`
      );
    }
    return `{${name}, date, medium}`;
  }

  // relativetime, list, custom names: not representable. Keep the variable
  // (so the key still renders) and report the lost formatting.
  ctx.addReport(
    `formatter \`${fmt}\` in \`{{${inner.trim()}}}\` has no ICU equivalent; value renders unformatted — use <T> or a custom renderer for locale-aware formatting`
  );
  return `{${name}}`;
}

function parseCurrencyCode(args: string | undefined): string | null {
  if (args === undefined) return null;
  const trimmed = args.trim();
  if (trimmed === '') return null;
  const options = parseOptionBag(trimmed);
  if (options && options['currency']) {
    return /^[A-Za-z]{3}$/.test(options['currency'])
      ? options['currency'].toUpperCase()
      : null;
  }
  // positional form: currency(USD)
  return /^[A-Za-z]{3}$/.test(trimmed) ? trimmed.toUpperCase() : null;
}

function hasTopLevelComma(spec: string): boolean {
  let depth = 0;
  for (const ch of spec) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === ',' && depth === 0) return true;
  }
  return false;
}

/**
 * Converts a single leaf string value from i18next to ICU: `$t()` nesting is
 * inlined, `{{var}}` placeholders become ICU arguments, and all surrounding
 * literal text is ICU-escaped. Returns null when the value must be dropped
 * (a nesting cycle); reports accumulate through ctx.addReport.
 */
export function convertLeaf(value: string, ctx: LeafContext): string | null {
  if (ctx.isIcu) {
    // i18next-icu: catalogs are already ICU. Only the `$t()` nesting (an
    // i18next feature, not ICU) needs inlining; the rest is passed through
    // verbatim (already valid ICU, already escaped by the author).
    return inlineNesting(value, ctx, (v) => v);
  }
  return inlineNesting(value, ctx, (segment) =>
    convertInterpolation(segment, ctx)
  );
}

/**
 * Resolves and inlines `$t(ref)` references, calling `convertSegment` on the
 * literal (non-`$t`) spans. `$t(ref, {options})` cannot be composed at build
 * time and is reported (the raw text is kept, escaped).
 */
function inlineNesting(
  value: string,
  ctx: LeafContext,
  convertSegment: (segment: string) => string
): string | null {
  const nestPattern = /\$t\(\s*([^,()]+?)\s*(,\s*\{[\s\S]*?\}\s*)?\)/g;
  let out = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let cyclic = false;
  while ((match = nestPattern.exec(value)) !== null) {
    out += convertSegment(value.slice(lastIndex, match.index));
    const ref = stripQuotes(match[1].trim());
    if (match[2]) {
      ctx.addReport(
        `nesting \`${match[0]}\` passes options; ICU cannot compose messages at runtime — inline the value or use <T>`
      );
      out += ctx.isIcu ? match[0] : escapeIcuText(match[0]);
    } else if (ctx.stack.includes(ref)) {
      ctx.addReport(
        `nesting cycle detected at \`$t(${ref})\`; left unresolved — break the cycle manually`
      );
      cyclic = true;
    } else {
      const resolved = ctx.resolveNested(ref, [...ctx.stack, ref]);
      if (resolved === null) {
        ctx.addReport(
          `nested key \`$t(${ref})\` could not be resolved to a static value; left literal — inline it manually`
        );
        out += ctx.isIcu ? match[0] : escapeIcuText(match[0]);
      } else {
        out += resolved;
      }
    }
    lastIndex = nestPattern.lastIndex;
  }
  if (cyclic) return null;
  out += convertSegment(value.slice(lastIndex));
  return out;
}

/** Converts `{{var}}` placeholders in a literal span and escapes the rest. */
function convertInterpolation(segment: string, ctx: LeafContext): string {
  const pattern = /\{\{([\s\S]*?)\}\}/g;
  let out = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(segment)) !== null) {
    out += escapeIcuText(segment.slice(lastIndex, match.index));
    out += convertPlaceholder(match[1], ctx);
    lastIndex = pattern.lastIndex;
  }
  out += escapeIcuText(segment.slice(lastIndex));
  return out;
}

function stripQuotes(s: string): string {
  return s.replace(/^['"`]|['"`]$/g, '');
}

// ---- tree conversion (grouping) --------------------------------------------

type TreeContext = {
  locale: string;
  ns: string;
  plurals: LocalePlurals;
  separators: Separators;
  countKeys: Set<string>;
  contextKeys: Set<string>;
  isIcu?: boolean;
  addReport: (keypath: string, reason: string) => void;
  /** resolves a `$t(ref)` to its raw source value in this locale's catalogs. */
  rawResolve: (ref: string) => string | null;
};

const COUNT_VAR = 'count';

/** True when a value string references the i18next count variable. */
function mentionsCount(value: unknown): boolean {
  return typeof value === 'string' && /\{\{\s*-?\s*count\b/.test(value);
}

type Grouped = {
  /** base -> category -> raw value (cardinal plural). */
  cardinal: Map<string, Map<string, string>>;
  /** base -> category -> raw value (ordinal plural). */
  ordinal: Map<string, Map<string, string>>;
  /** base -> context -> raw value (pure context). */
  context: Map<string, Map<string, string>>;
  /** bases that combine context and plural (context+plural) — skip+report. */
  combined: Set<string>;
  /** plain keys left as-is (leaf or nested object). */
  plain: Map<string, unknown>;
};

/**
 * Splits an object's direct string keys into plural/ordinal/context groups vs
 * plain keys. Nested objects stay in `plain` for recursion. Grouping is
 * conservative: a suffix only groups when it is a CLDR category for this locale
 * and the group carries `_other`, or (context) when a call site passed context.
 */
function groupKeys(
  tree: Record<string, unknown>,
  tc: TreeContext,
  keypathPrefix: string
): Grouped {
  const sep = tc.separators.pluralSeparator;
  const csep = tc.separators.contextSeparator;

  const cardinal = new Map<string, Map<string, string>>();
  const ordinal = new Map<string, Map<string, string>>();
  const context = new Map<string, Map<string, string>>();
  const combined = new Set<string>();
  const plain = new Map<string, unknown>();

  // Track which raw keys were consumed by a group so we do not also emit them
  // as plain keys.
  const consumed = new Set<string>();

  const stringKeys = Object.keys(tree).filter(
    (k) => typeof tree[k] === 'string'
  );

  // Pass A: ordinal (most specific — `base_ordinal_cat`). Detection uses the
  // universal CLDR category names; per-locale validity is checked in
  // convertTree so an out-of-set category forces the whole set literal.
  for (const key of stringKeys) {
    const parsed = splitSuffix(key, sep);
    if (!parsed) continue;
    const { head, last } = parsed;
    const headParsed = splitSuffix(head, sep);
    if (
      headParsed &&
      headParsed.last === 'ordinal' &&
      ALL_CATEGORIES.has(last)
    ) {
      const base = headParsed.head;
      addToGroup(ordinal, base, last, tree[key] as string);
      consumed.add(key);
    }
  }

  // Pass B: cardinal plural and context+plural. Detection is by universal
  // category name; convertTree validates the group against this locale's set.
  for (const key of stringKeys) {
    if (consumed.has(key)) continue;
    const parsed = splitSuffix(key, sep);
    if (!parsed) continue;
    const { head, last } = parsed;
    if (!ALL_CATEGORIES.has(last)) continue;
    if (head === '') continue;
    // Skip the `base_ordinal` head (handled above).
    const headParsed = splitSuffix(head, sep);
    if (headParsed && headParsed.last === 'ordinal') continue;
    // Context+plural: head is `{ctxBase}{csep}{ctxValue}` where ctxBase was
    // called with context. Detect and route to skip+report.
    if (csep === sep) {
      const ctxSplit = splitSuffix(head, csep);
      if (ctxSplit && isContextBase(ctxSplit.head, tc, keypathPrefix)) {
        combined.add(ctxSplit.head);
        consumed.add(key);
        continue;
      }
    }
    addToGroup(cardinal, head, last, tree[key] as string);
    consumed.add(key);
  }

  // Pass C: pure context (call-site gated).
  for (const key of stringKeys) {
    if (consumed.has(key)) continue;
    const parsed = splitSuffix(key, csep);
    if (!parsed) continue;
    const { head, last } = parsed;
    if (head === '') continue;
    if (isContextBase(head, tc, keypathPrefix)) {
      addToGroup(context, head, last, tree[key] as string);
      consumed.add(key);
    }
  }

  // A bare base key that anchors a group is folded into that group (the
  // context `other` clause, or superseded by the ICU plural) — consume it so
  // it is not also emitted as a plain key colliding with the grouped result.
  for (const base of cardinal.keys()) if (base in tree) consumed.add(base);
  for (const base of ordinal.keys()) if (base in tree) consumed.add(base);
  for (const base of context.keys()) if (base in tree) consumed.add(base);
  for (const base of combined) if (base in tree) consumed.add(base);

  // Remaining keys are plain (leaves or nested objects).
  for (const key of Object.keys(tree)) {
    if (consumed.has(key)) continue;
    plain.set(key, tree[key]);
  }

  return { cardinal, ordinal, context, combined, plain };
}

function isContextBase(
  base: string,
  tc: TreeContext,
  keypathPrefix: string
): boolean {
  const full = keypathPrefix ? `${keypathPrefix}.${base}` : base;
  return tc.contextKeys.has(`${tc.ns}:${full}`);
}

function splitSuffix(
  key: string,
  sep: string
): { head: string; last: string } | null {
  const index = key.lastIndexOf(sep);
  if (index <= 0 || index >= key.length - sep.length) return null;
  return { head: key.slice(0, index), last: key.slice(index + sep.length) };
}

function addToGroup(
  groups: Map<string, Map<string, string>>,
  base: string,
  category: string,
  value: string
): void {
  if (!groups.has(base)) groups.set(base, new Map());
  groups.get(base)!.set(category, value);
}

/**
 * Converts a namespace tree (or subtree) to ICU, applying grouping. `keypath`
 * is the dotted path from the namespace root (for report/evidence keys).
 */
function convertTree(
  tree: Record<string, unknown>,
  tc: TreeContext,
  keypath: string
): Record<string, unknown> {
  const grouped = groupKeys(tree, tc, keypath);
  const result: Record<string, unknown> = {};

  const leaf = (raw: string): string | null => {
    const leafCtx: LeafContext = {
      resolveNested: (ref, stack) => {
        const rawValue = tc.rawResolve(ref);
        if (rawValue === null) return null;
        const nested: LeafContext = { ...leafCtxBase(), stack };
        return convertLeaf(rawValue, nested);
      },
      separators: tc.separators,
      isIcu: tc.isIcu,
      stack: [],
      addReport: (reason) => tc.addReport(keypath || '(root)', reason),
    };
    function leafCtxBase(): LeafContext {
      return {
        resolveNested: leafCtx.resolveNested,
        separators: tc.separators,
        isIcu: tc.isIcu,
        stack: [],
        addReport: leafCtx.addReport,
      };
    }
    return convertLeaf(raw, leafCtx);
  };

  const fullKey = (base: string) => (keypath ? `${keypath}.${base}` : base);

  // Cardinal plurals.
  for (const [base, categories] of grouped.cardinal) {
    const other = base; // the ICU key stays the base stem.
    const evidence =
      [...categories.values()].some(mentionsCount) ||
      tc.countKeys.has(`${tc.ns}:${fullKey(base)}`);
    if (!categories.has('other')) {
      tc.addReport(
        fullKey(base),
        `plural-looking keys \`${base}${tc.separators.pluralSeparator}*\` lack the required \`other\` category; left as literal keys (likely not a plural)`
      );
      writeGroupAsLiteral(
        result,
        base,
        categories,
        tc.separators.pluralSeparator,
        leaf
      );
      continue;
    }
    if (!evidence) {
      // A base with call-site { context } evidence whose context values happen
      // to be CLDR category names (step_one/step_other meaning context one/other)
      // is grabbed by this cardinal pass first. Faithfully converting it to
      // {context, select} is not possible when a context value is literally
      // `other` (i18next's context-less base and the `_other` variant are two
      // distinct strings that ICU's single `other` clause cannot both hold), so
      // it is left literal — but name the context possibility so the user is not
      // misled by a plural-only report (the m5 finding). The base value itself is
      // preserved by the base-key pass below.
      const contextNote = isContextBase(base, tc, keypath)
        ? ` (a call site passed { context } for \`${fullKey(base)}\`, so these may be a context selector whose values collide with CLDR category names — give the context distinct values or use <T>)`
        : '';
      tc.addReport(
        fullKey(base),
        `keys \`${base}${tc.separators.pluralSeparator}<category>\` look like a plural but no \`{{count}}\` or \`t('${fullKey(base)}', { count })\` call site was found; left literal to avoid a false positive${contextNote}`
      );
      writeGroupAsLiteral(
        result,
        base,
        categories,
        tc.separators.pluralSeparator,
        leaf
      );
      continue;
    }
    const invalid = [...categories.keys()].filter(
      (c) => !tc.plurals.cardinal.has(c)
    );
    if (invalid.length > 0) {
      tc.addReport(
        fullKey(base),
        `plural \`${base}\` has categories [${invalid.join(', ')}] outside ${tc.locale}'s CLDR set; left literal`
      );
      writeGroupAsLiteral(
        result,
        base,
        categories,
        tc.separators.pluralSeparator,
        leaf
      );
      continue;
    }
    result[other] = buildBranch('plural', categories, leaf);
  }

  // Ordinal plurals (skip+report when the base already has a cardinal plural).
  for (const [base, categories] of grouped.ordinal) {
    if (
      grouped.cardinal.has(base) &&
      grouped.cardinal.get(base)!.has('other')
    ) {
      tc.addReport(
        fullKey(base),
        `ordinal \`${base}${tc.separators.pluralSeparator}ordinal${tc.separators.pluralSeparator}*\` collides with the cardinal plural on the same key; cardinal converted, ordinal left literal — give the ordinal a distinct key or use <T>`
      );
      writeOrdinalAsLiteral(
        result,
        base,
        categories,
        tc.separators.pluralSeparator,
        leaf
      );
      continue;
    }
    if (!categories.has('other')) {
      tc.addReport(
        fullKey(base),
        `ordinal \`${base}\` lacks the required \`other\` category; left literal`
      );
      writeOrdinalAsLiteral(
        result,
        base,
        categories,
        tc.separators.pluralSeparator,
        leaf
      );
      continue;
    }
    const invalidOrd = [...categories.keys()].filter(
      (c) => !tc.plurals.ordinal.has(c)
    );
    if (invalidOrd.length > 0) {
      tc.addReport(
        fullKey(base),
        `ordinal \`${base}\` has categories [${invalidOrd.join(', ')}] outside ${tc.locale}'s ordinal CLDR set; left literal`
      );
      writeOrdinalAsLiteral(
        result,
        base,
        categories,
        tc.separators.pluralSeparator,
        leaf
      );
      continue;
    }
    result[base] = buildBranch('selectordinal', categories, leaf);
  }

  // Pure context selectors.
  for (const [base, variants] of grouped.context) {
    const options = new Map(variants);
    if (!options.has('other')) {
      // i18next's base key (no context) is the `other` clause; pull it in.
      const baseValue =
        typeof tree[base] === 'string' ? (tree[base] as string) : '';
      options.set('other', baseValue);
      if (baseValue === '') {
        tc.addReport(
          fullKey(base),
          `context selector \`${base}\` has no base (context-less) value; synthesized an empty \`other\` clause — add a fallback`
        );
      }
    }
    result[base] = buildSelect(options, leaf);
  }

  // Combined context+plural: leave every matching key literal, report once.
  for (const base of grouped.combined) {
    tc.addReport(
      fullKey(base),
      `combined context+plural on \`${base}\` is not converted in v1 (2-D key space); left as literal keys — split into separate keys or use <T>`
    );
  }
  // The combined raw keys stay in `plain` only if not consumed; groupKeys
  // consumed them, so re-emit them literally here.
  for (const key of Object.keys(tree)) {
    if (isCombinedMember(key, grouped.combined, tc.separators)) {
      const converted = leaf(tree[key] as string);
      if (converted !== null) result[key] = converted;
    }
  }

  // A bare base key was consumed in groupKeys on the assumption its group would
  // become an ICU plural/select that supersedes it. When the group instead fell
  // back to literal keys (no `other`, no `{{count}}` evidence, an out-of-locale
  // category, or a context set that stayed literal), nothing claimed
  // `result[base]`, so re-emit the base's own value rather than dropping a real
  // translation (the B4 finding). A group that did convert owns `result[base]`
  // already, so this only fires on the literal-fallback path.
  const groupedBases = new Set<string>();
  for (const base of grouped.cardinal.keys()) groupedBases.add(base);
  for (const base of grouped.ordinal.keys()) groupedBases.add(base);
  for (const base of grouped.context.keys()) groupedBases.add(base);
  for (const base of grouped.combined) groupedBases.add(base);
  for (const base of groupedBases) {
    if (base in result) continue;
    if (typeof tree[base] !== 'string') continue;
    const converted = leaf(tree[base] as string);
    if (converted === null) continue;
    result[base] = converted;
    tc.addReport(
      fullKey(base),
      `base key \`${base}\` kept as a literal value alongside its suffixed variants (the group was left literal, so the base translation is preserved rather than dropped)`
    );
  }

  // Plain keys: leaves converted, nested objects recursed, arrays reported.
  for (const [key, value] of grouped.plain) {
    if (typeof value === 'string') {
      const converted = leaf(value);
      if (converted !== null) result[key] = converted;
    } else if (Array.isArray(value)) {
      tc.addReport(
        fullKey(key),
        `array value / \`returnObjects\` has no gt dictionary equivalent (leaves are strings); left as-is — convert to <T> or discrete keys`
      );
      result[key] = value;
    } else if (value !== null && typeof value === 'object') {
      result[key] = convertTree(
        value as Record<string, unknown>,
        tc,
        keypath ? `${keypath}.${key}` : key
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}

function isCombinedMember(
  key: string,
  combined: Set<string>,
  sep: Separators
): boolean {
  if (combined.size === 0) return false;
  for (const base of combined) {
    if (key.startsWith(base + sep.contextSeparator)) return true;
  }
  return false;
}

function writeGroupAsLiteral(
  result: Record<string, unknown>,
  base: string,
  categories: Map<string, string>,
  sep: string,
  leaf: (v: string) => string | null
): void {
  for (const [cat, value] of categories) {
    const converted = leaf(value);
    if (converted !== null) result[`${base}${sep}${cat}`] = converted;
  }
}

function writeOrdinalAsLiteral(
  result: Record<string, unknown>,
  base: string,
  categories: Map<string, string>,
  sep: string,
  leaf: (v: string) => string | null
): void {
  for (const [cat, value] of categories) {
    const converted = leaf(value);
    if (converted !== null)
      result[`${base}${sep}ordinal${sep}${cat}`] = converted;
  }
}

/**
 * ICU-quotes a literal `#` so it is not read as the formatted count. `#` is only
 * special inside a `plural`/`selectordinal` sub-message, so this is applied to
 * branch values ONLY — quoting it in ordinary text would render a literal `'#'`
 * (gt's formatter does not strip the quotes outside a plural).
 *
 * Only `#` in text context (brace depth 0) is quoted. A `#` inside a `{...}`
 * argument node is part of ICU syntax — a number/currency skeleton such as
 * `{price, number, ::.00##}`, or a nested plural's own count — and must be left
 * untouched; quoting it would corrupt the skeleton (ICU number skeletons have no
 * `'` quoting) and break the format.
 */
function quoteHashInBranch(value: string): string {
  let out = '';
  let depth = 0;
  for (const ch of value) {
    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      if (depth > 0) depth--;
    } else if (ch === '#' && depth === 0) {
      out += "'#'";
      continue;
    }
    out += ch;
  }
  return out;
}

function buildBranch(
  kind: 'plural' | 'selectordinal',
  categories: Map<string, string>,
  leaf: (v: string) => string | null
): string {
  const parts: string[] = [];
  for (const cat of orderCategories(categories.keys())) {
    const converted = quoteHashInBranch(leaf(categories.get(cat)!) ?? '');
    parts.push(`${cat} {${converted}}`);
  }
  return `{${COUNT_VAR}, ${kind}, ${parts.join(' ')}}`;
}

function buildSelect(
  options: Map<string, string>,
  leaf: (v: string) => string | null
): string {
  const parts: string[] = [];
  // deterministic order: named contexts first (sorted), `other` last.
  const names = [...options.keys()].filter((k) => k !== 'other').sort();
  for (const name of names) {
    const converted = leaf(options.get(name)!) ?? '';
    parts.push(`${name} {${converted}}`);
  }
  const other = leaf(options.get('other') ?? '') ?? '';
  parts.push(`other {${other}}`);
  return `{context, select, ${parts.join(' ')}}`;
}

// ---- top-level merge -------------------------------------------------------

/**
 * Converts and merges every locale's namespace catalogs into one ICU dictionary
 * per locale. The default namespace merges at the dictionary root; other
 * namespaces nest under their namespace key.
 */
export function convertCatalogs(input: ConvertInput): ConvertResult {
  const separators = input.separators ?? DEFAULT_SEPARATORS;
  const countKeys = input.countKeys ?? new Set<string>();
  const contextKeys = input.contextKeys ?? new Set<string>();

  if (separators.keySeparator === false) {
    // Flat keys with literal dots cannot map onto gt-next's dotted-path
    // dictionary resolution — refuse rather than silently mis-nest.
    throw new CatalogConversionError(
      'i18next `keySeparator: false` (flat keys) is not supported: gt-next resolves dictionary keys by dotted path, so flat keys containing dots would be mis-nested. Convert the catalog to nested keys or migrate those keys manually.'
    );
  }

  if (separators.keySeparator !== '.') {
    // A custom key separator (e.g. '|') is re-expressed as gt-next's '.' path
    // separator in both the dictionary nesting and the emitted t() keys. That is
    // only unambiguous when no key segment itself contains a literal '.', so
    // refuse a catalog whose keys would mis-nest (consistent with the
    // keySeparator: false refusal above).
    for (const locale of input.locales) {
      const nsTrees = input.raw[locale] ?? {};
      for (const ns of Object.keys(nsTrees)) {
        const tree = nsTrees[ns];
        if (tree === null || typeof tree !== 'object') continue;
        const offending = findDotInKeySegment(tree as Record<string, unknown>);
        if (offending !== null) {
          throw new CatalogConversionError(
            `i18next keySeparator '${separators.keySeparator}' cannot be mapped onto gt-next's '.' path separator: the key segment '${offending}' contains a literal '.', which would mis-nest. Rename that key to avoid '.', or migrate it manually.`
          );
        }
      }
    }
  }

  const reports: ConversionReport[] = [];
  const byLocale: Record<string, Record<string, unknown>> = {};

  for (const locale of input.locales) {
    const plurals = pluralCategoriesFor(locale);
    const nsTrees = input.raw[locale] ?? {};
    const merged: Record<string, unknown> = {};

    const rawResolveFor = (): ((ref: string) => string | null) => (ref) =>
      resolveRawRef(ref, nsTrees, input.defaultNS, separators);

    // Non-default namespace names, computed up front so the default-ns merge can
    // detect a collision with a namespace it has not processed yet. Without this
    // the collision was only caught when the namespace happened to be processed
    // before the default namespace (readdirSync order), silently overwriting the
    // default-ns key otherwise (the M3 finding).
    const namespaceNames = new Set(
      Object.keys(nsTrees).filter((ns) => ns !== input.defaultNS)
    );

    for (const ns of Object.keys(nsTrees)) {
      const tree = nsTrees[ns];
      if (tree === null || typeof tree !== 'object') continue;
      const tc: TreeContext = {
        locale,
        ns,
        plurals,
        separators,
        countKeys,
        contextKeys,
        isIcu: input.isIcu,
        addReport: (keypath, reason) =>
          reports.push({ key: `${locale}/${ns}:${keypath}`, reason }),
        rawResolve: rawResolveFor(),
      };
      const converted = convertTree(tree as Record<string, unknown>, tc, '');
      if (ns === input.defaultNS) {
        for (const [key, value] of Object.entries(converted)) {
          if (key in merged || namespaceNames.has(key)) {
            reports.push({
              key: `${locale}/${ns}:${key}`,
              reason: `default-namespace key \`${key}\` collides with a namespace of the same name; namespace kept, default-ns key dropped`,
            });
            continue;
          }
          merged[key] = value;
        }
      } else {
        merged[ns] = converted;
      }
    }

    byLocale[locale] = merged;
  }

  // Synthesize entries for call-site literal defaultValues whose keys are
  // absent from every catalog (only for the default locale — other locales
  // fall back through gt's own resolution).
  // Non-default namespaces nest under their namespace key, so a synthesized
  // entry's path must be namespace + in-namespace key. Join them with the SAME
  // separator getByPath/setByPath split on (the custom keySeparator, default
  // '.'); joining with a literal '.' under a non-default keySeparator would glue
  // the namespace onto the first key segment (ns 'dashboard' + key
  // 'widgets|count' -> 'dashboard.widgets' | 'count') and land the value under a
  // spurious flat key instead of dashboard -> widgets -> count.
  const keySep = separators.keySeparator || '.';
  for (const def of input.defaults ?? []) {
    const target = byLocale[input.defaultLocale];
    if (!target) continue;
    const path =
      def.ns === input.defaultNS ? def.key : `${def.ns}${keySep}${def.key}`;
    if (getByPath(target, path, separators) !== undefined) continue;
    const leafCtx: LeafContext = {
      resolveNested: () => null,
      separators,
      isIcu: input.isIcu,
      stack: [],
      addReport: (reason) =>
        reports.push({
          key: `${input.defaultLocale}/${def.ns}:${def.key}`,
          reason,
        }),
    };
    const converted = convertLeaf(def.value, leafCtx);
    if (converted !== null) {
      const written = setByPath(target, path, converted, separators);
      reports.push({
        key: `${input.defaultLocale}/${def.ns}:${def.key}`,
        reason: written
          ? `synthesized dictionary entry from a call-site defaultValue (key was absent from the catalog)`
          : `a call-site defaultValue for \`${def.key}\` collides with an existing non-object value on its path; kept the existing translation and did not synthesize — reconcile the key manually`,
      });
    }
  }

  // A `$t()` reference that appears in several consuming keys (or is walked at
  // several nesting depths) pushes byte-identical report entries; collapse them
  // so the TODO list is not padded with duplicates (the m9 finding). Distinct
  // keys or reasons are preserved.
  const seenReports = new Set<string>();
  const dedupedReports = reports.filter((report) => {
    const signature = `${report.key}\u0000${report.reason}`;
    if (seenReports.has(signature)) return false;
    seenReports.add(signature);
    return true;
  });

  return { byLocale, reports: dedupedReports };
}

/** Resolves `$t(ns:key)` / `$t(key)` to its raw source string, or null. */
function resolveRawRef(
  ref: string,
  nsTrees: Record<string, Record<string, unknown>>,
  defaultNS: string,
  sep: Separators
): string | null {
  let ns = defaultNS;
  let keyPath = ref;
  if (sep.nsSeparator && ref.includes(sep.nsSeparator)) {
    const idx = ref.indexOf(sep.nsSeparator);
    ns = ref.slice(0, idx);
    keyPath = ref.slice(idx + sep.nsSeparator.length);
  }
  const tree = nsTrees[ns];
  if (!tree) return null;
  const value = getByPath(tree, keyPath, sep);
  return typeof value === 'string' ? value : null;
}

function getByPath(
  tree: Record<string, unknown>,
  keyPath: string,
  sep: Separators
): unknown {
  const segments = sep.keySeparator
    ? keyPath.split(sep.keySeparator)
    : [keyPath];
  let current: unknown = tree;
  for (const segment of segments) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/**
 * Writes `value` at a dotted path, creating intermediate objects. Returns false
 * without writing when an intermediate segment already holds a non-object value
 * (a string translation, an array), so synthesizing a nested defaultValue never
 * clobbers a real translation (the M5 finding). The caller reports the collision.
 */
function setByPath(
  tree: Record<string, unknown>,
  keyPath: string,
  value: string,
  sep: Separators
): boolean {
  const segments = sep.keySeparator
    ? keyPath.split(sep.keySeparator)
    : [keyPath];
  let current: Record<string, unknown> = tree;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    const existing = current[seg];
    if (existing === undefined) {
      current[seg] = {};
    } else if (
      existing === null ||
      typeof existing !== 'object' ||
      Array.isArray(existing)
    ) {
      return false;
    }
    current = current[seg] as Record<string, unknown>;
  }
  current[segments[segments.length - 1]] = value;
  return true;
}

/**
 * Returns the first object key containing a literal '.' anywhere in a nested
 * catalog tree, or null. Used to refuse a custom-keySeparator run whose keys
 * cannot be re-expressed as gt-next '.'-separated paths without mis-nesting.
 */
function findDotInKeySegment(tree: Record<string, unknown>): string | null {
  for (const [key, value] of Object.entries(tree)) {
    if (key.includes('.')) return key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const nested = findDotInKeySegment(value as Record<string, unknown>);
      if (nested !== null) return nested;
    }
  }
  return null;
}
