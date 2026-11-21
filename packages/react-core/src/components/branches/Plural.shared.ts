import {
  getPluralBranchKey,
  isAcceptedPluralForm,
} from 'generaltranslation/internal';
import { getPluralBranch, isCount } from '../../utils/plurals/getPluralBranch';
import { fillCount } from '../../utils/plurals/fillCount';
import type { ReactNode } from 'react';
import { getFormatLocales } from '../../hooks/utils/getFormatLocales';

// Pure render logic shared by the hook-based and RSC implementations. This
// module must stay free of hook/context imports so it can be reached from the
// components-rsc entrypoint.

type PluralProps = {
  n: number | bigint;
  /** The fallback, as `other` is in `plural()`. */
  children: ReactNode;
} & Partial<
  // `_0` is the exact number 0: ICU's `=0`, which JSX cannot spell.
  Record<Exclude<Intl.LDMLPluralRule, 'other'> | `_${number}`, ReactNode>
>;

type PluralConditions = {
  _locale: string;
  _enableI18n: boolean;
};

type ResolvedPluralProps = PluralProps & PluralConditions;

function renderPlural(
  { _enableI18n, _locale, n, children, ...props }: ResolvedPluralProps,
  ordinal?: boolean
): ReactNode {
  const locales = getFormatLocales({
    locale: _locale,
    enableI18n: _enableI18n,
  });
  const branches = Object.fromEntries([
    ...Object.entries(props)
      .filter(([prop]) => isAcceptedPluralForm(prop))
      .map(([prop, branch]) => [getPluralBranchKey(prop), branch]),
    ['other', children],
  ]);
  const branch: ReactNode = getPluralBranch(n, locales, branches, ordinal);
  // An `n` that is no number is reported where the branch is picked.
  return isCount(n) ? fillCount(branch, n) : branch;
}

export { renderPlural };
export type { PluralProps, ResolvedPluralProps };
