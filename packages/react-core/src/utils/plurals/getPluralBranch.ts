import { getPluralForm } from 'generaltranslation/internal';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { getRuntimeEnvironment } from 'gt-i18n/internal';

// Branches are keyed as in stored content: `=0`, a plural category, a
// `<Branch>` value, or `other`. Stored content drops a branch whose content is
// undefined, so such a branch counts as absent here too.

function pick<T>(branches: Record<string, T>, key: string): T | undefined {
  return Object.hasOwn(branches, key) ? branches[key] : undefined;
}

const isCount = (n: unknown): n is number | bigint =>
  typeof n === 'number' || typeof n === 'bigint';

/**
 * The branch ICU picks for `n`: an exact key, then the locale's plural
 * category, then `other`. A value that is not a number only fits `other`.
 */
export function selectPluralBranch<T>(
  n: unknown,
  locales: string[],
  branches: Record<string, T>
): T | undefined {
  if (!isCount(n)) return pick(branches, 'other');
  const keys = Object.keys(branches).filter(
    (key) => branches[key] !== undefined
  );
  return pick(branches, getPluralForm(n, keys, locales));
}

/** The branch named by the value, then `other`. */
export function selectBranch<T>(
  branch: unknown,
  branches: Record<string, T>
): T | undefined {
  const selected = branch == null ? undefined : pick(branches, String(branch));
  return selected !== undefined ? selected : pick(branches, 'other');
}

/** selectPluralBranch() for source content, which reports a count it cannot use. */
export function getPluralBranch<T>(
  n: unknown,
  locales: string[],
  branches: Record<string, T>
): T | undefined {
  const selected = selectPluralBranch(n, locales, branches);
  if (!isCount(n)) {
    report({
      whatHappened: '<Plural> needs a number or a bigint for n',
      fix: 'Convert the value before passing it, like n={Number(count)}',
      rendered:
        selected === undefined
          ? 'Nothing was rendered'
          : 'The other branch was rendered',
      details: `n: ${String(n)} (${typeof n})`,
    });
  } else if (selected === undefined) {
    report({
      whatHappened: '<Plural> has no branch for n',
      fix: 'Add an other branch',
      rendered: 'Nothing was rendered',
      details: `n: ${n}`,
    });
  }
  return selected;
}

/** selectBranch() for source content, which reports a value with no branch. */
export function getBranch<T>(
  branch: unknown,
  branches: Record<string, T>
): T | undefined {
  const selected = selectBranch(branch, branches);
  if (selected === undefined) {
    report({
      whatHappened: '<Branch> has no branch for its value',
      fix: 'Add an other branch',
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
    wayOut: development ? undefined : rendered,
    details,
  });
  if (development) throw new Error(diagnostic);
  console.error(diagnostic);
}
