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
 * or time placeholder holds. It reads no locale and validates none: each call
 * passes the build's locales, and an Intl object is built when a message
 * first needs it. The compiler's static-runtime tests hold the two together.
 *
 * Nothing here runs when a module loads, and a call site passes what it
 * needs, so compiled code can run before the module it is in has: through an
 * import cycle, a function is called that early.
 *
 * A page compiles a function when it is first called, which costs more than
 * running it. So the functions here are small and not nested, and what few
 * messages need (an Intl object, a count that is not a number, an error) is
 * in a function of its own, which most pages never compile.
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

type PluralCount = number | bigint;

/** The Intl objects of one build's locales, each built when first needed. */
type StaticIntl = {
  locales: string[];
  number?: Intl.NumberFormat;
  dateTime?: Intl.DateTimeFormat;
  plural?: Intl.PluralRules;
  selectordinal?: Intl.PluralRules;
};

/** What a call site formats with; see `formatStatic`. */
type StaticBuild = {
  locales: string;
  timeZone: string | undefined;
  digits: 0 | 1 | undefined;
  plural: string | undefined;
  selectordinal: string | undefined;
};

// By locales, so every call site of a build shares what each would build
const intlByLocales = new Map<string, StaticIntl>();

const FALLBACK_BRANCH_KEY = 'other';

const { hasOwnProperty } = Object.prototype;

// The counts a build looks at; see `formatStatic`
const SMALL_COUNT_LIMIT = 1000;

const PLURAL_CATEGORIES: Record<string, string> = {
  z: 'zero',
  o: 'one',
  t: 'two',
  f: 'few',
  m: 'many',
  x: 'other',
};

function getIntl(locales: string, timeZone: string | undefined): StaticIntl {
  const key = `${locales}|${timeZone}`;
  let intl = intlByLocales.get(key);
  if (!intl) intlByLocales.set(key, (intl = { locales: locales.split(',') }));
  return intl;
}

/** A `{name}` value that is an object: a Date in the locale's short date and time, as in ICU. */
function objectValue(
  value: object,
  locales: string,
  timeZone: string | undefined
): unknown {
  if (Object.prototype.toString.call(value) !== '[object Date]') return value;
  const intl = getIntl(locales, timeZone);
  return (intl.dateTime ??= new Intl.DateTimeFormat(intl.locales, {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone,
  })).format(value as Date);
}

/**
 * What a `{name}` value prints as, for a template literal to print: nothing
 * for null and undefined, a Date in the locale's short date and time, as in
 * ICU, and any other value as it is.
 * @param locales The locale to format in, then the build's default locale, with a comma between them.
 * @param timeZone The configured time zone; without one, dates format in the host's.
 * @internal
 */
export function staticValue(
  value: unknown,
  locales: string,
  timeZone?: string
): unknown {
  return value == null
    ? ''
    : typeof value === 'object'
      ? objectValue(value, locales, timeZone)
      : value;
}

/**
 * Formats a message tree in the locales of its build.
 *
 * A page's first `Intl.NumberFormat` takes milliseconds to build, so the
 * compiler asks Intl, when it builds, about each integer from 0 up to 1,000
 * in these locales, and a plural of such a count is formatted from what it
 * found, without an Intl object.
 * @param locales The locale to format in, then the build's default locale, with a comma between them.
 * @param digits 1 when Intl formats each of those integers as its digits.
 * @param plural Their plural categories as one letter each
 * (`PLURAL_CATEGORIES`): those of the first integers, then after a `|` the
 * ones that repeat from there. Left out when the tree needs none.
 * @param selectordinal The same for ordinals.
 * @param timeZone The configured time zone; without one, dates format in the host's.
 * @internal
 */
export function formatStatic(
  tree: StaticMessageTree,
  values: Readonly<Record<string, unknown>>,
  locales: string,
  digits?: 0 | 1,
  plural?: string,
  selectordinal?: string,
  timeZone?: string
): string {
  const parts: unknown[] = [];
  format(
    { locales, timeZone, digits, plural, selectordinal },
    parts,
    tree,
    values
  );
  // One part is printed whole, a symbol included, and an array's items
  // without a separator; several are joined, as the runtime joins them
  const formatted = parts.length === 1 ? parts[0] : parts;
  return typeof formatted === 'string'
    ? formatted
    : Array.isArray(formatted)
      ? formatted.join('')
      : String(formatted);
}

/**
 * Formats a translation, and its source when that throws, as gt-react's
 * runtime renders the source of a translation it cannot format.
 * @internal
 */
export function staticOr<Values>(
  values: Values,
  format: (values: Values) => string,
  formatSource: (values: Values) => string
): string {
  try {
    return format(values);
  } catch {
    return formatSource(values);
  }
}

function format(
  build: StaticBuild,
  parts: unknown[],
  tree: StaticMessageTree,
  values: Readonly<Record<string, unknown>>,
  count?: PluralCount
): void {
  if (typeof tree === 'string') {
    if (tree) append(parts, tree);
    return;
  }
  for (let index = 0; index < tree.length; index++) {
    const node = tree[index];
    if (typeof node === 'string') {
      append(parts, node);
    } else if (node === 0) {
      if (count !== undefined) {
        append(
          parts,
          build.digits && isSmallCount(count)
            ? `${count}`
            : formatCount(build, count)
        );
      }
    } else {
      const name = node[0];
      const value = values[name];
      if (node[1] === undefined) {
        append(parts, typeof value === 'string' ? value : text(build, value));
      } else if (node[1] === 'select') {
        if (typeof value !== 'string') throw wrongType(name, 'string');
        // A select resets the count, as in ICU
        format(
          build,
          parts,
          ownBranch(node[2], value) ??
            ownBranch(node[2], FALLBACK_BRANCH_KEY) ??
            noBranch(name, value),
          values
        );
      } else {
        const number = typeof value === 'number' ? value : toCount(name, value);
        const adjusted = node[3] ? subtract(number, node[3]) : number;
        const table = build[node[1]];
        format(
          build,
          parts,
          // ICU compares the number, so "01" matches `=1`
          ownBranch(node[2], `=${number}`) ??
            ownBranch(
              node[2],
              table && isSmallCount(adjusted)
                ? tableCategory(table, Number(adjusted))
                : intlCategory(build, node[1], name, node[2], adjusted)
            ) ??
            ownBranch(node[2], FALLBACK_BRANCH_KEY) ??
            noBranch(name, value),
          values,
          adjusted
        );
      }
    }
  }
}

/** Adds a part; adjacent text is merged, so parts that are all text give one string. */
function append(parts: unknown[], part: unknown): void {
  const last = parts.length - 1;
  if (typeof part === 'string' && typeof parts[last] === 'string') {
    parts[last] += part;
  } else {
    parts.push(part);
  }
}

function ownBranch(
  branches: Branches,
  key: string
): StaticMessageTree | undefined {
  return hasOwnProperty.call(branches, key) ? branches[key] : undefined;
}

/**
 * Whether a count is one a build looks at: an integer from 0 up to 1,000,
 * and not -0, which Intl prints with its sign.
 */
function isSmallCount(count: PluralCount): boolean {
  return (
    count < SMALL_COUNT_LIMIT &&
    (typeof count === 'bigint'
      ? count >= 0
      : // 1 / -0 is -Infinity
        count % 1 === 0 && 1 / count > 0)
  );
}

/** The plural category the build found for a small count. */
function tableCategory(table: string, index: number): string {
  const first = table.indexOf('|');
  return PLURAL_CATEGORIES[
    table[
      index < first
        ? index
        : first + 1 + ((index - first) % (table.length - first - 1))
    ]
  ];
}

/** The plural category of a count the build did not look at, when a branch is named for one. */
function intlCategory(
  build: StaticBuild,
  kind: 'plural' | 'selectordinal',
  name: string,
  branches: Branches,
  count: PluralCount
): string {
  if (
    !Object.keys(branches).some(
      (key) => key !== FALLBACK_BRANCH_KEY && key[0] !== '='
    )
  ) {
    return FALLBACK_BRANCH_KEY;
  }
  if (
    typeof count === 'bigint' &&
    Math.abs(Number(count)) > Number.MAX_SAFE_INTEGER
  ) {
    throw new RangeError(
      `The variable "${name}" is outside the safe integer range.`
    );
  }
  const intl = getIntl(build.locales, build.timeZone);
  return (intl[kind] ??= new Intl.PluralRules(intl.locales, {
    type: kind === 'plural' ? 'cardinal' : 'ordinal',
  })).select(Number(count));
}

/** A plural's count as `#` prints it, when the build did not find it to be its digits. */
function formatCount(build: StaticBuild, count: PluralCount): string {
  const intl = getIntl(build.locales, build.timeZone);
  return (intl.number ??= new Intl.NumberFormat(intl.locales)).format(count);
}

/** What a plural counts with when its value is not a number: a bigint, or a decimal string. */
function toCount(name: string, value: unknown): PluralCount {
  if (typeof value === 'bigint') return value;
  if (
    typeof value === 'string' &&
    // A decimal number as ICU and Intl both read it, like `1.5e3` or `+.05`
    /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())
  ) {
    return Number(value);
  }
  throw wrongType(name, 'number');
}

function subtract(count: PluralCount, offset: number): PluralCount {
  return typeof count === 'bigint' ? count - BigInt(offset) : count - offset;
}

/** A `{name}` value that is not a string, as a part: text, or a value kept as it is until the parts are joined. */
function text(build: StaticBuild, value: unknown): unknown {
  if (value == null) return '';
  if (typeof value === 'object') {
    return objectValue(value, build.locales, build.timeZone);
  }
  return typeof value === 'number' ||
    typeof value === 'bigint' ||
    typeof value === 'boolean'
    ? String(value)
    : value;
}

function wrongType(name: string, type: string): TypeError {
  return new TypeError(`The variable "${name}" must be a ${type}.`);
}

function noBranch(name: string, value: unknown): never {
  throw new RangeError(
    `The variable "${name}" has no branch for ${JSON.stringify(String(value))}.`
  );
}

/**
 * Stands in for gt-react's `initializeGTSPA()`: the build already holds its
 * locale and translations, so there is nothing to start or load.
 * @internal
 */
export async function initializeGTSPA(_config?: unknown): Promise<void> {}
