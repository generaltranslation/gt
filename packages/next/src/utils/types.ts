import type { Tx } from 'gt-react';
import { ReactNode } from 'react';

export type GTProviderProps = {
  children?: ReactNode;
};

export type TxProps = Parameters<typeof Tx>[0];
