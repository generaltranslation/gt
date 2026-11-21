import { getPluralForm } from 'generaltranslation/internal';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { getI18nConfig, getRuntimeEnvironment } from 'gt-i18n/internal';

// Branches are keyed as in stored content: `=0`, a plural category, a
// `<Select>` value, or `other`. Stored content drops a branch whose content is
// undefined, so such a branch counts as absent here too.

function pick<T>(branches: Record<string, T>, key: string): T | undefined {
  return Object.hasOwn(branches, key) ? branches[key] : undefined;
}

export const isCount = (n: unknown): n is number | bigint =>
  typeof n === 'number' || typeof n === 'bigint';

/**
 * The key of the branch ICU picks for `n`: an exact key, then the locale's
 * plural category, then `other`. A value that is not a number only fits `other`.
 * `ordinal` picks among ordinal categories, as `<Ordinal>` does.
 */
export function selectPluralKey(
  n: unknown,
  locales: string[],
  branches: Record<string, unknown>,
  ordinal?: boolean
): string {
  if (!isCount(n)) return 'other';
  const keys = Object.keys(branches).filter(
    (key) => branches[key] !== undefined
  );
  // A custom alias reaches Intl as its code, never by name.
  const config = getI18nConfig();
  const codes = locales.map((locale) => config.resolveCanonicalLocale(locale));
  return getPluralForm(n, keys, codes, ordinal ? 'ordinal' : 'cardinal');
}

/** The key of the branch named by the value, then `other`. */
export function selectBranchKey(
  value: unknown,
  branches: Record<string, unknown>
): string {
  return value != null && pick(branches, String(value)) !== undefined
    ? String(value)
    : 'other';
}

// A translation picks the key among its own branches, and the source may have
// no branch of that name: its `other` pairs with it then.
function pickOrOther<T>(branches: Record<string, T>, key: string) {
  const selected = pick(branches, key);
  return selected !== undefined ? selected : pick(branches, 'other');
}

/**
 * The source branch of a `<Plural>` or an `<Ordinal>`, which reports a count
 * it cannot use. `key` is the branch a translation picked; without one the
 * source picks.
 */
export function getPluralBranch<T>(
  n: unknown,
  locales: string[],
  branches: Record<string, T>,
  ordinal?: boolean,
  key = selectPluralKey(n, locales, branches, ordinal)
): T | undefined {
  const selected = pickOrOther(branches, key);
  const component = ordinal ? '<Ordinal>' : '<Plural>';
  if (!isCount(n)) {
    report({
      whatHappened: `${component} needs a number or a bigint for n`,
      fix: 'Convert the value before passing it, like n={Number(count)}',
      rendered:
        selected === undefined
          ? 'Nothing was rendered'
          : 'The children were rendered',
      details: `n: ${String(n)} (${typeof n})`,
    });
  } else if (selected === undefined) {
    report({
      whatHappened: `${component} has no branch for n`,
      fix: 'Give it children to render as the fallback',
      rendered: 'Nothing was rendered',
      details: `n: ${n}`,
    });
  }
  return selected;
}

/**
 * The source branch of a `<Select>`, which reports a value with no branch.
 * `key` is the branch a translation picked; without one the source picks.
 */
export function getBranch<T>(
  value: unknown,
  branches: Record<string, T>,
  key = selectBranchKey(value, branches)
): T | undefined {
  const selected = pickOrOther(branches, key);
  if (selected === undefined) {
    report({
      whatHappened: '<Select> has no branch for its value',
      fix: 'Give it children to render as the fallback',
      rendered: 'Nothing was rendered',
      details: `value: ${String(value)}`,
    });
  }
  return selected;
}

/** Reports an `<N>` that no `<Plural>` gave a count. */
export function reportMissingCount(): void {
  report({
    whatHappened: '<N> has no count to show',
    fix: 'Put it in the children or a branch of a <Plural> whose n is a number. A <Plural> cannot see an <N> that another component renders',
    rendered: 'Nothing was rendered',
  });
}

function report({
  whatHappened,
  fix,
  rendered,
  details,
}: {
  whatHappened: string;
  fix: string;
  rendered: string;
  details?: string;
}): void {
  const development = getRuntimeEnvironment() === 'development';
  const diagnostic = createDiagnosticMessage({
    source: '@generaltranslation/react-core',
    severity: 'Error',
    whatHappened,
    fix,
    reassurance: development ? undefined : rendered,
    details,
  });
  if (development) throw new Error(diagnostic);
  console.error(diagnostic);
}
