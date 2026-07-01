import { ReactNode } from 'react';

export type GTProviderProps = {
  children?: ReactNode;
  id?: string;
};

export type TxProps = Record<string, ReactNode> & {
  children: ReactNode;
  context?: string;
  maxChars?: number;
  locale?: string;
};
