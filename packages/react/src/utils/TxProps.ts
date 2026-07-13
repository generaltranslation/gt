import type { ReactNode } from 'react';

export type TxProps = Record<string, ReactNode> & {
  children: ReactNode;
  context?: string;
  locale?: string;
  maxChars?: number;
};
