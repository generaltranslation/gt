// Type-level tests, checked by `tsc --noEmit` (not run by vitest).
import { msg, n, part, plural, select, t } from '../../unstable';
import { dyn, tx } from '../../unstable-internal';

declare const greeting: string;
declare const name: string;
declare const count: number;
declare const role: 'admin' | 'member';
declare const flag: boolean;

export const accepted = [
  // tx translates dyn() text at runtime, directly or nested.
  tx`${dyn(greeting)}, ${{ name }}!`,
  tx({ context: 'greeting' })`${dyn(greeting)}!`,
  tx`${plural({ count }, { one: part`${n} ${dyn(greeting)}`, other: part`${n} items` })}`,
  tx`${select({ role }, { admin: part`${dyn(greeting)}`, member: 'Member' })}`,
  tx`${part`${part`${dyn(greeting)}`}`}`,
  tx`${flag ? dyn(greeting) : ''}`,
];

export const rejected = [
  // @ts-expect-error gt and t render from the catalog, which cannot hold dyn() text
  t`${dyn(greeting)}, ${{ name }}!`,

  // @ts-expect-error a part holding dyn() text is still runtime text
  t`${part`${dyn(greeting)}`}`,

  // @ts-expect-error so is a plural whose branch holds it
  t`${plural({ count }, { one: part`${n} ${dyn(greeting)}`, other: part`${n} items` })}`,

  // @ts-expect-error and a select whose branch holds it
  t`${select({ role }, { admin: part`${dyn(greeting)}`, member: 'Member' })}`,

  // @ts-expect-error msg renders later from the catalog too
  msg`${dyn(greeting)}`,

  // @ts-expect-error a hole that may be dyn() text is rejected as well
  t`${flag ? dyn(greeting) : ''}`,
];
