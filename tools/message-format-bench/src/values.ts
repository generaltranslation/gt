/** The values every message is formatted with. Shared with the browser page, so it imports nothing. */

/** A page shows about this many messages, however large the catalog is. */
export const PAGE_MESSAGES = 100;

const STRINGS = {
  name: 'Ada',
  user: 'grace',
  team: 'Core',
  project: 'Atlas',
  email: 'ada@example.com',
  file: 'report.pdf',
};
export const STRING_NAMES = Object.keys(STRINGS);
const COUNTS = [0, 1, 2, 5, 1234];
/** `guest` has no branch, so it takes `other`. */
const ROLES = ['admin', 'member', 'guest'];

export type Values = typeof STRINGS & {
  count: number;
  role: string;
  amount: number;
  ratio: number;
  due: Date;
};

/** One values object per message index; every variable has one fixed type. */
const VALUES: Values[] = Array.from({ length: 15 }, (_, i) => ({
  ...STRINGS,
  count: COUNTS[i % 5]!,
  role: ROLES[i % 3]!,
  amount: 1234.5,
  ratio: 0.42,
  due: new Date(Date.UTC(2026, 0, 15, 9, 30)),
}));
export const valuesFor = (i: number): Values => VALUES[i % 15]!;

/**
 * Builds and uses the Intl formatters the corpus needs, with no message
 * library. The first Intl.NumberFormat of a process loads the engine's ICU
 * data, whatever library asks for it. `plural` is what one plural needs (rules
 * and the number for `#`); `all` adds the percent and date formatters of the
 * `rich` mix.
 */
export function intlFloor(now: () => number): { plural: number; all: number } {
  const start = now();
  let chars =
    new Intl.PluralRules('en').select(2).length +
    new Intl.NumberFormat('en').format(1234.5).length;
  const plural = now() - start;
  chars +=
    new Intl.NumberFormat('en', { style: 'percent' }).format(0.42).length +
    new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(0).length;
  if (chars === 0) throw new Error('Intl printed nothing');
  return { plural, all: now() - start };
}

/** A format's runtime: how its catalog is loaded and how one message is formatted. */
export type Runtime = {
  /** Turns the catalog file's text into what `make` takes. JSON.parse when absent. */
  parse?: (text: string) => unknown;
  /** Sets the library up for one catalog and returns the function that formats a message. */
  make: (
    catalog: never
  ) => (key: string, values: Values, index: number) => string;
};
