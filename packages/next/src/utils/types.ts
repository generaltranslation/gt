import { ReactNode } from 'react';

export type GTProviderProps = {
  children?: ReactNode;
};

export type TxProps = Record<string, ReactNode> & {
  children: ReactNode;
  context?: string;
  maxChars?: number;
  locale?: string;
};
