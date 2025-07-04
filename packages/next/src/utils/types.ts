import { ReactNode } from 'react';

export type GTProviderProps = {
  children?: ReactNode;
  id?: string;
  locale?: string;
};

export type TxProps = Record<string, any> & {
  children: any;
  context?: string;
  locale?: string;
};
