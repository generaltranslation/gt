// Type-level tests, checked by `tsc --noEmit` (not run by vitest).
import { derive, plural, T, Tx } from '../index.types';

declare const tone: 'formal' | 'casual';
declare const count: number;

export const deriveContexts = [
  <T context='greeting'>Hello</T>,
  <T context={derive(tone)}>Hello</T>,
  <Tx context={derive(tone)}>Hello</Tx>,

  // @ts-expect-error only derive() stands for a context
  <T context={plural(count, { other: 'many' })}>Hello</T>,
];
