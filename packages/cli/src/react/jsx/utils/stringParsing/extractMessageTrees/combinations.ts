import type * as t from '@babel/types';
import { NonStaticMessageError } from './diagnostics.js';

/** Each variant is uploaded as its own entry, so larger messages are skipped. */
const MAX_MESSAGE_VARIANTS = 1000;

/** Every combination of one item per list, within MAX_MESSAGE_VARIANTS. */
export function product<T>(lists: T[][], node: t.Node): T[][] {
  assertVariantLimit(
    lists.reduce((count, list) => count * list.length, 1),
    node
  );
  return lists.reduce<T[][]>(
    (combinations, list) =>
      combinations.flatMap((combination) =>
        list.map((item) => [...combination, item])
      ),
    [[]]
  );
}

export function assertVariantLimit(size: number, node: t.Node): void {
  if (size > MAX_MESSAGE_VARIANTS) {
    throw new NonStaticMessageError(
      `it has ${size} derive() variants, more than the limit of ${MAX_MESSAGE_VARIANTS}`,
      node
    );
  }
}
