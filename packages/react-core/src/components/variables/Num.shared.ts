import { computeNum as computeNumBase } from 'gt-i18n/internal';

// Pure compute logic shared by the hook-based and RSC implementations. This
// module must stay free of hook/context imports so it can be reached from the
// components-rsc entrypoint.

type NumProps = {
  children: number | string | null | undefined;
  options?: Intl.NumberFormatOptions;
  locales?: string[];
  name?: string;
  _locale?: string;
  _enableI18n?: boolean;
};

type ResolvedNumProps = NumProps & {
  _locale: string;
  _enableI18n: boolean;
};

function computeNum({
  _enableI18n,
  _locale,
  children,
  options,
  locales,
}: ResolvedNumProps): string | null {
  return computeNumBase({
    value: children,
    options,
    locales,
    locale: _locale,
    enableI18n: _enableI18n,
  });
}

export { computeNum };
export type { NumProps, ResolvedNumProps };
