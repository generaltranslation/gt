import { getPluralForm } from 'generaltranslation/internal';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { getRuntimeEnvironment } from 'gt-i18n/internal';

// Branches are keyed as in stored content: `=0`, a plural category, a
// `<Branch>` value, or `other`. Stored content drops a branch whose content is
// undefined, so such a branch counts as absent here too.

function pick<T>(branches: Record<string, T>, key: string): T | undefined {
  return Object.hasOwn(branches, key) ? branches[key] : undefined;
}

export const isCount = (n: unknown): n is number | bigint =>
  typeof n === 'number' || typeof n === 'bigint';

/**
 * The key of the branch ICU picks for `n`: an exact key, then the locale's
 * plural category, then `other`. A value that is not a number only fits `other`.
 */
export function selectPluralKey(
  n: unknown,
  locales: string[],
  branches: Record<string, unknown>
): string {
  if (!isCount(n)) return 'other';
  const keys = Object.keys(branches).filter(
    (key) => branches[key] !== undefined
  );
  return getPluralForm(n, keys, locales);
}

/** The key of the branch named by the value, then `other`. */
export function selectBranchKey(
  branch: unknown,
  branches: Record<string, unknown>
): string {
  return branch != null && pick(branches, String(branch)) !== undefined
    ? String(branch)
    : 'other';
}

// A translation picks the key among its own branches, and the source may have
// no branch of that name: its `other` pairs with it then.
function pickOrOther<T>(branches: Record<string, T>, key: string) {
  const selected = pick(branches, key);
  return selected !== undefined ? selected : pick(branches, 'other');
}

/**
 * The source branch of a `<Plural>`, which reports a count it cannot use.
 * `key` is the branch a translation picked; without one the source picks.
 */
export function getPluralBranch<T>(
  n: unknown,
  locales: string[],
  branches: Record<string, T>,
  key = selectPluralKey(n, locales, branches)
): T | undefined {
  const selected = pickOrOther(branches, key);
  if (!isCount(n)) {
    report({
      whatHappened: '<Plural> needs a number or a bigint for n',
      fix: 'Convert the value before passing it, like n={Number(count)}',
      rendered:
        selected === undefined
          ? 'Nothing was rendered'
          : 'The children were rendered',
      details: `n: ${String(n)} (${typeof n})`,
    });
  } else if (selected === undefined) {
    report({
      whatHappened: '<Plural> has no branch for n',
      fix: 'Give it children to render as the fallback',
      rendered: 'Nothing was rendered',
      details: `n: ${n}`,
    });
  }
  return selected;
}

/**
 * The source branch of a `<Branch>`, which reports a value with no branch.
 * `key` is the branch a translation picked; without one the source picks.
 */
export function getBranch<T>(
  branch: unknown,
  branches: Record<string, T>,
  key = selectBranchKey(branch, branches)
): T | undefined {
  const selected = pickOrOther(branches, key);
  if (selected === undefined) {
    report({
      whatHappened: '<Branch> has no branch for its value',
      fix: 'Give it children to render as the fallback',
      rendered: 'Nothing was rendered',
      details: `branch: ${String(branch)}`,
    });
  }
  return selected;
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
  details: string;
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
