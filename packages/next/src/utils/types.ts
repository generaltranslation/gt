import type { DerivableText } from 'gt-i18n/internal';
import { ReactNode } from 'react';

export type GTProviderProps = {
  children?: ReactNode;
};

export type TxProps = Record<string, ReactNode | DerivableText> & {
  children: ReactNode;
  context?: DerivableText;
  maxChars?: number;
  locale?: string;
};
