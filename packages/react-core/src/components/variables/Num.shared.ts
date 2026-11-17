import { getI18nConfig } from 'gt-i18n/internal';
import { getFormatLocales } from '../../hooks/utils/getFormatLocales';

// Pure compute logic shared by the hook-based and RSC implementations. This
// module must stay free of hook/context imports so it can be reached from the
// components-rsc entrypoint.

type NumProps = {
  children: number | bigint | null | undefined;
  options?: Intl.NumberFormatOptions;
  name?: string;
};

type ResolvedNumProps = NumProps & {
  _locale: string;
  _enableI18n: boolean;
};

function computeNum({
  _enableI18n,
  _locale,
  children,
  options = {},
}: ResolvedNumProps): string | null {
  const locales = getFormatLocales({
    locale: _locale,
    enableI18n: _enableI18n,
  });
  const i18nConfig = getI18nConfig();
  if (children == null) return null;
  return i18nConfig.formatNum(children, { locales, ...options });
}

export { computeNum };
export type { NumProps, ResolvedNumProps };
