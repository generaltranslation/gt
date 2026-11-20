import { getContext, setContext } from 'svelte';

const COUNT_CONTEXT = Symbol.for('gt-svelte.plural-count');

/** The `n` of a plural, or nothing when it is no number. */
export type PluralCount = number | bigint | undefined;

/** An `n` as it was passed, which a plural reports when it is no number. */
export function toPluralCount(n: unknown): PluralCount {
  return typeof n === 'number' || typeof n === 'bigint' ? n : undefined;
}

/** Tells the `<N>` below a `<Plural>` its count. */
export function setPluralCount(count: () => PluralCount): void {
  setContext(COUNT_CONTEXT, count);
}

/**
 * Returns a function that reads the `n` of the nearest `<Plural>`. Call it
 * during component initialization.
 */
export function usePluralCount(): () => PluralCount {
  const count = getContext<(() => PluralCount) | undefined>(COUNT_CONTEXT);
  return () => count?.();
}
