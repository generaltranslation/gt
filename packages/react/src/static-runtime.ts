/**
 * What a build made with the compiler's experimental
 * `experimentalStaticRuntime` option runs instead of gt-react: the compiler
 * resolves every translation for the build's one locale, so the app only
 * formats the messages that have variables. Compiled code imports this entry;
 * it is not written by hand.
 *
 * The formatter here prints what `formatMessageTree` of
 * `@generaltranslation/icu` prints for text, `{name}`, `#`, `select`,
 * `plural` and `selectordinal`, which is all a message without a number, date
 * or time placeholder holds. It reads no locale and validates none: the
 * build's locales are passed in, and an Intl object is built when a message
 * first needs it. The compiler's static-runtime tests hold the two together.
 */

type Branches = Readonly<Record<string, StaticMessageTree>>;

type StaticMessageNode =
  | string
  | 0
  // The second entry is in the type, as never set, so it tells the nodes apart
  | (readonly [name: string] & { readonly 1?: undefined })
  | readonly [name: string, kind: 'select', branches: Branches]
  | readonly [
      name: string,
      kind: 'plural' | 'selectordinal',
      branches: Branches,
      offset?: number,
    ];

/** A message tree without number, date or time placeholders. */
export type StaticMessageTree = string | readonly StaticMessageNode[];

/** Formats a message tree in the locale its build was made for. */
export type StaticFormatter = (
  tree: StaticMessageTree,
  values: Readonly<Record<string, unknown>>
) => string;

type PluralCount = number | bigint;

/** The Intl objects of one build's locales, each built when first needed. */
type StaticIntl = {
  number?: Intl.NumberFormat;
  dateTime?: Intl.DateTimeFormat;
  plural?: Intl.PluralRules;
  selectordinal?: Intl.PluralRules;
};

// By locales, so the modules of a build share what each of them would build
const intlByLocales = new Map<string, StaticIntl>();

// A decimal number as ICU and Intl both read it, like `1.5e3` or `+.05`
const DECIMAL_NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

const FALLBACK_BRANCH_KEY = 'other';

function ownBranch(
  branches: Branches,
  key: string
): StaticMessageTree | undefined {
  return Object.prototype.hasOwnProperty.call(branches, key)
    ? branches[key]
    : undefined;
}

function getIntl(locales: string[], timeZone: string | undefined): StaticIntl {
  const key = `${locales}|${timeZone}`;
  let intl = intlByLocales.get(key);
  if (!intl) intlByLocales.set(key, (intl = {}));
  return intl;
}

/**
 * What a `{name}` value prints as, for a template literal to print: nothing
 * for null and undefined, a Date in the locale's short date and time, as in
 * ICU, and any other value as it is.
 * @param locales The build's locale, then its default locale, as Intl reads them.
 * @param timeZone The configured time zone; without one, dates format in the host's.
 * @internal
 */
export function createStaticValue(
  locales: string[],
  timeZone?: string
): (value: unknown) => unknown {
  const shared = getIntl(locales, timeZone);
  return (value) => {
    if (value == null) return '';
    if (
      typeof value === 'object' &&
      Object.prototype.toString.call(value) === '[object Date]'
    ) {
      return (shared.dateTime ??= new Intl.DateTimeFormat(locales, {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone,
      })).format(value as Date);
    }
    return value;
  };
}

/**
 * A formatter for the message trees of one build.
 * @param locales The build's locale, then its default locale, as Intl reads them.
 * @param timeZone The configured time zone; without one, dates format in the host's.
 * @internal
 */
export function createStaticFormatter(
  locales: string[],
  timeZone?: string
): StaticFormatter {
  const shared = getIntl(locales, timeZone);
  const text = createStaticValue(locales, timeZone);

  const format = (
    tree: StaticMessageTree,
    values: Readonly<Record<string, unknown>>,
    count?: PluralCount
  ): string => {
    if (typeof tree === 'string') return tree;
    let out = '';
    for (const node of tree) {
      if (typeof node === 'string') {
        out += node;
        continue;
      }
      if (node === 0) {
        if (count !== undefined) {
          out += (shared.number ??= new Intl.NumberFormat(locales)).format(
            count
          );
        }
        continue;
      }
      const name = node[0];
      const value = values[name];
      if (node[1] === undefined) {
        out += text(value);
        continue;
      }
      const branches = node[2];
      if (node[1] === 'select') {
        if (typeof value !== 'string') {
          throw new TypeError(`The variable "${name}" must be a string.`);
        }
        const branch =
          ownBranch(branches, value) ??
          ownBranch(branches, FALLBACK_BRANCH_KEY);
        if (branch === undefined) throw noBranch(name, value);
        // A select resets the count, as in ICU
        out += format(branch, values);
        continue;
      }
      if (
        typeof value !== 'number' &&
        typeof value !== 'bigint' &&
        !(typeof value === 'string' && DECIMAL_NUMBER.test(value.trim()))
      ) {
        throw new TypeError(`The variable "${name}" must be a number.`);
      }
      const number = typeof value === 'bigint' ? value : Number(value);
      // ICU compares the number, so "01" matches `=1`
      let branch = ownBranch(branches, `=${number}`);
      const offset = node[3] ?? 0;
      const adjusted =
        typeof number === 'bigint' ? number - BigInt(offset) : number - offset;
      if (
        branch === undefined &&
        Object.keys(branches).some(
          (branchKey) =>
            branchKey !== FALLBACK_BRANCH_KEY && branchKey[0] !== '='
        )
      ) {
        if (
          typeof adjusted === 'bigint' &&
          Math.abs(Number(adjusted)) > Number.MAX_SAFE_INTEGER
        ) {
          throw new RangeError(
            `The variable "${name}" is outside the safe integer range.`
          );
        }
        branch = ownBranch(
          branches,
          (shared[node[1]] ??= new Intl.PluralRules(locales, {
            type: node[1] === 'plural' ? 'cardinal' : 'ordinal',
          })).select(Number(adjusted))
        );
      }
      branch ??= ownBranch(branches, FALLBACK_BRANCH_KEY);
      if (branch === undefined) throw noBranch(name, value);
      out += format(branch, values, adjusted);
    }
    return out;
  };

  return (tree, values) => {
    // A message that is one value prints it whole, a symbol included
    if (
      typeof tree !== 'string' &&
      tree.length === 1 &&
      typeof tree[0] === 'object' &&
      tree[0].length === 1
    ) {
      return String(text(values[tree[0][0]]));
    }
    return format(tree, values);
  };
}

function noBranch(name: string, value: unknown): RangeError {
  return new RangeError(
    `The variable "${name}" has no branch for ${JSON.stringify(String(value))}.`
  );
}

/**
 * Stands in for gt-react's `initializeGTSPA()`: the build already holds its
 * locale and translations, so there is nothing to start or load.
 * @internal
 */
export async function initializeGTSPA(_config?: unknown): Promise<void> {}
