import { ReactNode } from 'react';

export type GTProviderProps = {
  children?: ReactNode;
  id?: string;
  locale?: string;
};

export type TxProps = {
  children: any;
  id?: string;
  context?: string;
  locale?: string;
};
