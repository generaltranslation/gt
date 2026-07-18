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
  try {
    return {
      cardinal: new Set(
        new Intl.PluralRules(locale).resolvedOptions().pluralCategories
      ),
      ordinal: new Set(
        new Intl.PluralRules(locale, {
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

/** Maps an i18next `number(...)` option bag to an ICU number skeleton, or null. */
function numberSkeleton(optionText: string | undefined): string | null {
  if (optionText === undefined || optionText.trim() === '') return '';
  const options = parseOptionBag(optionText);
  if (options === null) return null;
  const parts: string[] = [];
  const min = options['minimumFractionDigits'];
  const max = options['maximumFractionDigits'];
  if (min !== undefined || max !== undefined) {
    const lo = min !== undefined ? Number(min) : undefined;
    const hi = max !== undefined ? Number(max) : undefined;
    if (
      (lo !== undefined && Number.isNaN(lo)) ||
      (hi !== undefined && Number.isNaN(hi))
    ) {
      return null;
    }
    const loN = lo ?? hi ?? 0;
    const hiN = hi ?? lo ?? 0;
    // ICU fraction-digit skeleton: `.` then min `0`s then up-to `#`s.
    parts.push('.' + '0'.repeat(loN) + '#'.repeat(Math.max(0, hiN - loN)));
  }
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

  if (!/^[A-Za-z_$][\w$]*$/.test(name)) {
    // Nested var access (`{{obj.prop}}`) or other shapes ICU arg names cannot
    // express: keep the raw text (escaped) and report.
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
    return `{${name}, number, ::currency/${code}}`;
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
      tc.addReport(
        fullKey(base),
        `keys \`${base}${tc.separators.pluralSeparator}<category>\` look like a plural but no \`{{count}}\` or \`t('${fullKey(base)}', { count })\` call site was found; left literal to avoid a false positive`
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

function buildBranch(
  kind: 'plural' | 'selectordinal',
  categories: Map<string, string>,
  leaf: (v: string) => string | null
): string {
  const parts: string[] = [];
  for (const cat of orderCategories(categories.keys())) {
    const converted = leaf(categories.get(cat)!) ?? '';
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

  const reports: ConversionReport[] = [];
  const byLocale: Record<string, Record<string, unknown>> = {};

  for (const locale of input.locales) {
    const plurals = pluralCategoriesFor(locale);
    const nsTrees = input.raw[locale] ?? {};
    const merged: Record<string, unknown> = {};

    const rawResolveFor = (): ((ref: string) => string | null) => (ref) =>
      resolveRawRef(ref, nsTrees, input.defaultNS, separators);

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
          if (key in merged) {
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
  for (const def of input.defaults ?? []) {
    const target = byLocale[input.defaultLocale];
    if (!target) continue;
    const path = def.ns === input.defaultNS ? def.key : `${def.ns}.${def.key}`;
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
      setByPath(target, path, converted, separators);
      reports.push({
        key: `${input.defaultLocale}/${def.ns}:${def.key}`,
        reason: `synthesized dictionary entry from a call-site defaultValue (key was absent from the catalog)`,
      });
    }
  }

  return { byLocale, reports };
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

function setByPath(
  tree: Record<string, unknown>,
  keyPath: string,
  value: string,
  sep: Separators
): void {
  const segments = sep.keySeparator
    ? keyPath.split(sep.keySeparator)
    : [keyPath];
  let current: Record<string, unknown> = tree;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (current[seg] === null || typeof current[seg] !== 'object') {
      current[seg] = {};
    }
    current = current[seg] as Record<string, unknown>;
  }
  current[segments[segments.length - 1]] = value;
}
