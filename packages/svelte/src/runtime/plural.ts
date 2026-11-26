import { getPluralBranchKey } from 'generaltranslation/internal';
import { getI18nConfig } from 'gt-i18n/internal';

/**
 * The branch of a `<Plural>` or an `<Ordinal>` for `n`, picked as ICU does:
 * an exact number, then the locale's category of the given type, then the
 * children.
 */
export function selectPluralBranch(
  n: unknown,
  // Untyped callers can still pass other props, which match no key.
  branches: Record<string, unknown>,
  children: unknown,
  locale: string,
  type: Intl.PluralRuleType
): unknown {
  // `other` is not a prop: the children are ICU's `other`. A branch passed as
  // undefined counts as absent, as in gt-react.
  const names = Object.keys(branches).filter(
    (name) => name !== 'other' && branches[name] !== undefined
  );
  const keys = names.map(getPluralBranchKey);
  const key =
    typeof n === 'number' || typeof n === 'bigint'
      ? // The config reads a locale alias as its code, like its formatters.
        getI18nConfig().getPluralForm(n, [...keys, 'other'], { locale, type })
      : 'other';
  return key === 'other' ? children : branches[names[keys.indexOf(key)]];
}
