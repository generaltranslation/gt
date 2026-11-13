import {
  FALLBACK_BRANCH_KEY,
  isPluralCategoryKey,
  PLURAL_CATEGORIES,
} from '../settings/syntax';

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
 * string or a message tree. Text is left out: a translation's is its own.
 * So is whether it writes `#`; a `count` is a `#` it did write, read only
 * for the tag around it.
 */
export type CheckedPlaceholder =
  | { name: string; kind: 'argument' }
  | CountPlaceholder
  | { name: string; kind: 'tag'; children: CheckedPlaceholder[] }
  | FormattedPlaceholder
  | BranchingPlaceholder;

/**
 * The `#` of a plural: its variable, and the plural's kind and offset, since
 * two plurals of one variable print different counts.
 */
export type CountPlaceholder = {
  name: string;
  kind: 'count';
  of: 'plural' | 'selectordinal';
  offset: number;
};

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
 * variables, their styles, its plural branches, the exact and select branch
 * keys, and where its variables are shown. Empty when it matches.
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
      ...placementProblems(
        source,
        sourceFacts,
        translation,
        translationFacts,
        plurals
      ),
      ...tagProblems(source, translation),
    ]),
  ];
}

/**
 * A variable is a name used as one kind of placeholder; a plural's offset
 * changes what `#` prints, so it is part of the identity too.
 */
function variableKey(placeholder: CheckedPlaceholder): string {
  switch (placeholder.kind) {
    case 'plural':
    case 'selectordinal':
      return JSON.stringify([
        placeholder.name,
        placeholder.kind,
        placeholder.offset,
      ]);
    case 'count':
      return JSON.stringify([
        placeholder.name,
        placeholder.kind,
        placeholder.of,
        placeholder.offset,
      ]);
    default:
      return JSON.stringify([placeholder.name, placeholder.kind]);
  }
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
    if (placeholder.kind === 'count') return;
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
    const sourceStyles = [...allowed.values()];
    const pattern = sourceStyles.find(({ isPattern }) => isPattern);
    for (const [style, placeholder] of used) {
      if (placeholder.isPattern ? pattern : allowed.has(style)) continue;
      const uses = `"${placeholder.name}" uses ${printPlaceholder(placeholder)}`;
      problems.push(
        // Where a pattern is the source's one style, say what may stand in for it.
        pattern && sourceStyles.length === 1
          ? `${uses}, where the source has ${printPlaceholder(pattern)}: keep it or localize its pattern`
          : `${uses}, which the source does not`
      );
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

/** One branch of each select or plural, by `variableKey`: the readers it is picked for. */
type Readers = Map<string, string>;

/** A select or plural variable, and the branch keys a reader can have for it. */
type BranchChoice = { variable: string; name: string; keys: string[] };

// shortcut: a message with more combinations of branches than this is not checked for placement; raise it if a real message needs more.
const MAX_READERS = 1024;

const isBranching = (
  placeholder: CheckedPlaceholder
): placeholder is BranchingPlaceholder =>
  placeholder.kind === 'select' ||
  placeholder.kind === 'plural' ||
  placeholder.kind === 'selectordinal';

/**
 * A reader who sees a variable in the source sees it in the translation.
 * Each language builds its sentences its own way, so a variable may move
 * into every branch or out of them (ICU advises a whole sentence in each
 * branch). Moved into one branch only, it is lost for every other reader: ICU
 * formats that without complaint.
 *
 * A select's keys are the same in both, so it is checked for the readers of
 * each combination of select branches. A language has its own plural
 * categories, so what those readers see whatever the number is compared.
 */
function placementProblems(
  source: CheckedPlaceholder[],
  sourceFacts: MessageFacts,
  translation: CheckedPlaceholder[],
  translationFacts: MessageFacts,
  plurals: PluralLocale | undefined
): string[] {
  const selects = branchChoices(sourceFacts, true, undefined);
  const sourceNumbers = branchChoices(sourceFacts, false, undefined);
  const numbers = branchChoices(translationFacts, false, plurals);
  const count = (choices: BranchChoice[]): number =>
    choices.reduce((product, { keys }) => product * keys.length, 1);
  if (count(selects) * (count(sourceNumbers) + count(numbers)) > MAX_READERS) {
    return [];
  }
  // One problem for a variable, for the first readers who lose it.
  const problems = new Map<string, string>();
  for (const selected of combinations(selects)) {
    const shown = shownWhateverTheNumber(translation, selected, numbers);
    for (const [key, name] of shownWhateverTheNumber(
      source,
      selected,
      sourceNumbers
    )) {
      // A variable the translation lacks is reported as missing.
      if (shown.has(key) || !translationFacts.variables.has(key)) continue;
      if (problems.has(key)) continue;
      const when = selects
        .map(({ variable, name }) => `${name} is ${selected.get(variable)}`)
        .join(' and ');
      problems.set(
        key,
        when
          ? `"${name}" is not shown when ${when}, as it is in the source`
          : `"${name}" is not shown in every branch, as it is in the source`
      );
    }
  }
  return [...problems.values()];
}

/**
 * The selects of a message, or its plurals, with the keys of their branches.
 * With a locale, a plural category it does not have is never picked, so it
 * is no reader's.
 */
function branchChoices(
  facts: MessageFacts,
  selects: boolean,
  plurals: PluralLocale | undefined
): BranchChoice[] {
  const choices: BranchChoice[] = [];
  for (const [variable, { placeholder, keys }] of facts.branches) {
    if ((placeholder.kind === 'select') !== selects) continue;
    const has =
      placeholder.kind === 'select'
        ? undefined
        : plurals?.categories(ruleType(placeholder.kind));
    choices.push({
      variable,
      name: placeholder.name,
      keys: [...keys].filter(
        (key) => !has || !isPluralCategoryKey(key) || has.has(key)
      ),
    });
  }
  return choices;
}

/** Every way to pick one key for each choice. */
function combinations(choices: BranchChoice[]): Readers[] {
  let all: Readers[] = [new Map()];
  for (const { variable, keys } of choices) {
    all = all.flatMap((picked) =>
      keys.map((key) => new Map(picked).set(variable, key))
    );
  }
  return all;
}

/** The variables, by `variableKey` with their names, that the readers of these select branches see for every number. */
function shownWhateverTheNumber(
  placeholders: CheckedPlaceholder[],
  selected: Readers,
  numbers: BranchChoice[]
): Map<string, string> {
  let always: Map<string, string> | undefined;
  for (const picked of combinations(numbers)) {
    const shown = shownTo(placeholders, new Map([...selected, ...picked]));
    if (!always) {
      always = shown;
      continue;
    }
    for (const key of always.keys()) {
      if (!shown.has(key)) always.delete(key);
    }
  }
  return always ?? new Map();
}

/**
 * The variables one reader sees: each select and plural shows the branch
 * picked for them, or `other` where it has no such branch, as ICU picks it.
 */
function shownTo(
  placeholders: CheckedPlaceholder[],
  readers: Readers
): Map<string, string> {
  const shown = new Map<string, string>();
  const visit = (placeholder: CheckedPlaceholder): void => {
    if (placeholder.kind === 'count') return;
    const variable = variableKey(placeholder);
    shown.set(variable, placeholder.name);
    if (placeholder.kind === 'tag') {
      placeholder.children.forEach(visit);
    } else if (isBranching(placeholder)) {
      const picked = readers.get(variable);
      // shortcut: a number with an exact branch elsewhere takes `other` here, not its category's branch; pick by Intl.PluralRules if that ever misjudges a real message.
      const branch =
        placeholder.branches.find(([key]) => key === picked) ??
        placeholder.branches.find(([key]) => key === FALLBACK_BRANCH_KEY);
      branch?.[1].forEach(visit);
    }
  };
  placeholders.forEach(visit);
  return shown;
}

/**
 * A variable that is inside a tag at every use in the source stays inside
 * that tag: a link or a style around other words is a visible defect. Moving
 * a variable into a tag, splitting a tag and nesting tags another way are
 * free. ICU has no tags, so this rule is this library's own.
 */
function tagProblems(
  source: CheckedPlaceholder[],
  translation: CheckedPlaceholder[]
): string[] {
  const problems: string[] = [];
  const inTranslation = enclosingTags(translation);
  for (const [key, { name, tags }] of enclosingTags(source)) {
    const translated = inTranslation.get(key);
    if (!translated) continue;
    for (const tag of tags) {
      if (!translated.tags.has(tag)) {
        problems.push(
          `"${name}" is not inside <${tag}>, as it is in the source`
        );
      }
    }
  }
  return problems;
}

/**
 * For each variable a reader sees printed, the tags around every use of it.
 * A select or plural prints nothing itself, so a tag may sit around it or
 * inside each of its branches; what a plural prints is its count, each `#`.
 */
function enclosingTags(
  placeholders: CheckedPlaceholder[]
): Map<string, { name: string; tags: Set<string> }> {
  const found = new Map<string, { name: string; tags: Set<string> }>();
  const visit = (placeholder: CheckedPlaceholder, around: string[]): void => {
    if (placeholder.kind === 'tag') {
      const inside = [...around, placeholder.name];
      placeholder.children.forEach((child) => visit(child, inside));
      return;
    }
    if (isBranching(placeholder)) {
      for (const [, branch] of placeholder.branches) {
        branch.forEach((child) => visit(child, around));
      }
      return;
    }
    const key = variableKey(placeholder);
    const known = found.get(key);
    if (!known) {
      found.set(key, { name: placeholder.name, tags: new Set(around) });
      return;
    }
    for (const tag of known.tags) {
      if (!around.includes(tag)) known.tags.delete(tag);
    }
  };
  placeholders.forEach((placeholder) => visit(placeholder, []));
  return found;
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
