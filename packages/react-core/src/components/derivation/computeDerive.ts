import type { ReactNode } from 'react';

type DeriveProps<T extends ReactNode> = {
  children: T;
};

function computeDerive<T extends ReactNode>({ children }: DeriveProps<T>): T {
  return children;
}

export { computeDerive };
export type { DeriveProps };
