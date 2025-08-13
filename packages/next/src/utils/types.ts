import { ReactNode } from 'react';

export type GTProviderProps = {
  children?: ReactNode;
  id?: string;
  locale?: string;
  region?: string | undefined;
};

export type TxProps = Record<string, any> & {
  children: any;
  context?: string;
  locale?: string;
};
