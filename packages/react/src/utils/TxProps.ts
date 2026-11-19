import type { DerivableText } from 'gt-i18n/internal';
import type { ReactNode } from 'react';

export type TxProps = Record<string, ReactNode | DerivableText> & {
  children: ReactNode;
  context?: DerivableText;
  locale?: string;
  maxChars?: number;
};
