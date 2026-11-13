import { isPluralCategoryKey, PLURAL_CATEGORIES } from '../settings/syntax';

export type CheckTranslationOptions = {
  /**
   * The translation's locale. With it, each plural and selectordinal needs a
   * branch for every category the locale has, like `few` and `many` in
   * Russian. Categories it does not have, like `one` in Japanese, may be
   * left out, together with the variables and styles only they use.
   */
  locale?: string;
};

/**
 * A placeholder as the translation rules read it, whether from an ICU
 * string or a message tree. Text and `#` are left out: a translation's are
 * its own.
 */
export type CheckedPlaceholder =
  | { name: string; kind: 'argument' }
  | { name: string; kind: 'tag'; children: CheckedPlaceholder[] }
  | FormattedPlaceholder
  | BranchingPlaceholder;

/**
 * A `number`, `date` or `time` placeholder. `style` is as written, like
 * `percent` or `::yMMMd`, and `undefined` when there is none; a problem
 * shows it. `styleKey` is what it says, spelled one way, so two spellings of
 * one skeleton compare equal. A pattern, like `yyyy-MM-dd`, is the
 * translator's to localize.
 */
export type FormattedPlaceholder = {
  name: string;
  kind: 'number' | 'date' | 'time';
  style: string | undefined;
  styleKey: string | undefined;
  isPattern: boolean;
};

/** Branches are entries, so a `__proto__` key stays a branch. */
export type CheckedBranches = [
  key: string,
  placeholders: CheckedPlaceholder[],
][];

type BranchingPlaceholder =
  | { name: string; kind: 'select'; branches: CheckedBranches }
  | {
      name: string;
      kind: 'plural' | 'selectordinal';
      offset: number;
      branches: CheckedBranches;
    };

type PluralPlaceholder = Extract<
  BranchingPlaceholder,
  { kind: 'plural' | 'selectordinal' }
>;

/** What the rules compare in one message, by `variableKey`. */
type MessageFacts = {
  /** A use of each variable. */
  variables: Map<string, CheckedPlaceholder>;
  /** Each style of a formatted variable, by `styleKey`, with a use of it. */
  styles: Map<string, Map<string | undefined, FormattedPlaceholder>>;
  /** The branch keys of each select, plural and selectordinal variable. */
  branches: Map<
    string,
    { placeholder: BranchingPlaceholder; keys: Set<string> }
  >;
  /** Every plural and selectordinal, each checked on its own. */
  pluralPlaceholders: PluralPlaceholder[];
};

/**
 * Every way a translation does not match its source, in this order: its
 * variables, their styles, its plural branches, and the exact and select
 * branch keys. Empty when it matches.
 */
export function translationProblems(
  source: CheckedPlaceholder[],
  translation: CheckedPlaceholder[],
  locale: string | undefined
): string[] {
  const plurals = pluralLocale(locale);
  const sourceFacts = readFacts(source, undefined);
  const required = plurals ? readFacts(source, plurals) : sourceFacts;
  const translationFacts = readFacts(translation, undefined);
  // A problem names its variable, so two uses of one can word the same problem.
  return [
    ...new Set([
      ...variableProblems(sourceFacts, required, translationFacts),
      ...styleProblems(sourceFacts, required, translationFacts),
      ...pluralBranchProblems(translationFacts, plurals),
      ...branchKeyProblems(sourceFacts, required, translationFacts),
    ]),
  ];
}

/**
 * A variable is a name used as one kind of placeholder; a plural's offset
 * changes what `#` prints, so it is part of the identity too.
 */
function variableKey(placeholder: CheckedPlaceholder): string {
  return JSON.stringify(
    placeholder.kind === 'plural' || placeholder.kind === 'selectordinal'
      ? [placeholder.name, placeholder.kind, placeholder.offset]
      : [placeholder.name, placeholder.kind]
  );
}

/**
 * The facts of a message. With a locale, the plural category branches it
 * has no use for are skipped, which leaves what a translation must keep (per
 * CLDR, a language uses only its own categories, and every value without one
 * falls back to `other`).
 */
function readFacts(
  placeholders: CheckedPlaceholder[],
  plurals: PluralLocale | undefined
): MessageFacts {
  const facts: MessageFacts = {
    variables: new Map(),
    styles: new Map(),
    branches: new Map(),
    pluralPlaceholders: [],
  };
  const visit = (placeholder: CheckedPlaceholder): void => {
    const key = variableKey(placeholder);
    facts.variables.set(key, placeholder);
    switch (placeholder.kind) {
      case 'argument':
        return;
      case 'tag':
        placeholder.children.forEach(visit);
        return;
      case 'number':
      case 'date':
      case 'time': {
        const styles =
          facts.styles.get(key) ??
          new Map<string | undefined, FormattedPlaceholder>();
        styles.set(placeholder.styleKey, placeholder);
        facts.styles.set(key, styles);
        return;
      }
      case 'select':
      case 'plural':
      case 'selectordinal': {
        const known = facts.branches.get(key);
        const keys = known ? known.keys : new Set<string>();
        if (!known) facts.branches.set(key, { placeholder, keys });
        const has =
          plurals && placeholder.kind !== 'select'
            ? plurals.categories(ruleType(placeholder.kind))
            : undefined;
        if (placeholder.kind !== 'select') {
          facts.pluralPlaceholders.push(placeholder);
        }
        for (const [branch, children] of placeholder.branches) {
          if (has && isPluralCategoryKey(branch) && !has.has(branch)) continue;
          keys.add(branch);
          children.forEach(visit);
        }
      }
    }
  };
  placeholders.forEach(visit);
  return facts;
}

/** Order and repetition are free; the variables, by name and kind, are not. */
function variableProblems(
  source: MessageFacts,
  required: MessageFacts,
  translation: MessageFacts
): string[] {
  const problems: string[] = [];
  const sourceNames = new Set(
    [...source.variables.values()].map(({ name }) => name)
  );
  for (const [key, { name }] of translation.variables) {
    if (source.variables.has(key)) continue;
    problems.push(
      sourceNames.has(name)
        ? `"${name}" changed kind or plural offset`
        : `"${name}" does not exist in the source`
    );
  }
  for (const [key, { name }] of required.variables) {
    if (!translation.variables.has(key)) {
      problems.push(`"${name}" is missing from the translation`);
    }
  }
  return problems;
}

/**
 * The styles of variables both use; a variable problem is reported above.
 * A style name or a skeleton is kept as written. A pattern is not compared:
 * where the source uses one, the translation may use any pattern.
 */
function styleProblems(
  source: MessageFacts,
  required: MessageFacts,
  translation: MessageFacts
): string[] {
  const problems: string[] = [];
  for (const [key, used] of translation.styles) {
    const allowed = source.styles.get(key);
    if (!allowed) continue;
    const patternAllowed = [...allowed.values()].some(
      ({ isPattern }) => isPattern
    );
    for (const [style, placeholder] of used) {
      if (placeholder.isPattern ? !patternAllowed : !allowed.has(style)) {
        problems.push(
          `"${placeholder.name}" uses ${printPlaceholder(placeholder)}, which the source does not`
        );
      }
    }
    // A style used only in a branch the locale leaves out is not required.
    const needed = required.styles.get(key);
    if (!needed) continue;
    for (const [style, placeholder] of needed) {
      if (!placeholder.isPattern && !used.has(style)) {
        problems.push(
          `"${placeholder.name}" is missing ${printPlaceholder(placeholder)}`
        );
      }
    }
  }
  return problems;
}

function printPlaceholder({ name, kind, style }: FormattedPlaceholder): string {
  return style === undefined
    ? `{${name}, ${kind}}`
    : `{${name}, ${kind}, ${style}}`;
}

/**
 * Each plural that lacks a branch for a category its locale has, or has a
 * branch that is no category at all. A category the locale does not have is
 * left alone: its branch is never chosen.
 */
function pluralBranchProblems(
  translation: MessageFacts,
  plurals: PluralLocale | undefined
): string[] {
  const problems: string[] = [];
  for (const { name, kind, branches } of translation.pluralPlaceholders) {
    const what = kind === 'plural' ? 'plural' : 'ordinal';
    const keys = branches.map(([key]) => key);
    if (plurals) {
      const missing = [...plurals.categories(ruleType(kind))].filter(
        (category) => !keys.includes(category)
      );
      if (missing.length) {
        problems.push(
          `"${name}" is missing the ${what} ${
            missing.length > 1 ? 'branches' : 'branch'
          } ${missing.join(', ')}, which ${plurals.locale} needs`
        );
      }
    }
    for (const key of keys) {
      if (key[0] !== '=' && !PLURAL_CATEGORIES.has(key)) {
        problems.push(
          `"${name}" has the ${what} branch ${key}, which is not a plural category`
        );
      }
    }
  }
  return problems;
}

/**
 * The keys of variables both use, across all their uses. An exact `=N` the
 * source has says something about that number, so it stays; one added is
 * free. A select key is matched against a value the app passes in, so the
 * select keys are the source's.
 */
function branchKeyProblems(
  source: MessageFacts,
  required: MessageFacts,
  translation: MessageFacts
): string[] {
  const problems: string[] = [];
  for (const [key, { placeholder, keys }] of required.branches) {
    const used = translation.branches.get(key);
    if (!used) continue;
    for (const branch of keys) {
      if (used.keys.has(branch)) continue;
      if (placeholder.kind === 'select') {
        problems.push(
          `"${placeholder.name}" is missing the select branch ${branch}`
        );
      } else if (branch[0] === '=') {
        problems.push(
          `"${placeholder.name}" is missing the exact branch ${branch}, which the source has`
        );
      }
    }
  }
  for (const [key, { placeholder, keys }] of translation.branches) {
    const allowed = source.branches.get(key);
    if (placeholder.kind !== 'select' || !allowed) continue;
    for (const branch of keys) {
      if (!allowed.keys.has(branch)) {
        problems.push(
          `"${placeholder.name}" has the select branch ${branch}, which the source does not`
        );
      }
    }
  }
  return problems;
}

type PluralLocale = {
  locale: string;
  /** The locale's plural categories, cardinal or ordinal. */
  categories: (type: Intl.PluralRuleType) => ReadonlySet<string>;
};

/**
 * A locale's plural categories, or nothing when Intl has no rules for it:
 * Intl would answer with the host's language instead.
 */
function pluralLocale(locale: string | undefined): PluralLocale | undefined {
  if (!locale || !Intl.PluralRules.supportedLocalesOf(locale).length) {
    return undefined;
  }
  // Built only for a plural that asks, since most messages have none.
  const built = new Map<Intl.PluralRuleType, ReadonlySet<string>>();
  return {
    locale,
    categories: (type) => {
      let categories = built.get(type);
      if (!categories) {
        const rules = new Intl.PluralRules(locale, { type });
        categories = new Set(rules.resolvedOptions().pluralCategories);
        built.set(type, categories);
      }
      return categories;
    },
  };
}

const ruleType = (kind: 'plural' | 'selectordinal'): Intl.PluralRuleType =>
  kind === 'plural' ? 'cardinal' : 'ordinal';
