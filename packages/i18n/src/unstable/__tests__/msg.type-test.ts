// Type-level tests for msg and m, checked by `tsc --noEmit` (not run by vitest).
import {
  date,
  type M,
  mFallback,
  msg,
  type Msg,
  n,
  number,
  plural,
  part,
} from '../../unstable';

declare const m: M;
declare const name: string;
declare const count: number;
declare const due: Date;
declare const id: bigint;
declare const maybe: string | undefined;

export function validUsage(): unknown[] {
  const save: 'Save' = msg('Save');
  const message: string = msg(name);
  const greeting: string | Msg = msg`Hello, ${{ name }}!`;
  const button: string | Msg = msg({ context: 'button' })`Save`;
  const translated: string = m(save);
  const rendered: string = m(greeting);
  const missing: undefined = m(undefined);
  const nothing: null = mFallback(null);
  const optional: string | undefined = m(maybe, { name });
  const fallback: string = mFallback(button);
  return [
    message,
    button,
    translated,
    missing,
    nothing,
    optional,
    rendered,
    fallback,
    // Helpers and their values are captured like any value.
    msg`Due ${date({ due })}`,
    msg`Id ${number({ id })} or ${id}`,
    msg`${plural({ count }, { one: part`${n} item`, other: part`${n} items` })}`,
  ];
}

export function invalidUsage(): unknown[] {
  return [
    // @ts-expect-error a bare Date, which needs date() to be formatted
    msg`Due ${due}`,

    // @ts-expect-error placeholder with two keys
    msg`Hello, ${{ name, count }}`,

    // @ts-expect-error `n` outside a plural branch
    msg`${n} items`,

    // @ts-expect-error there is no locale option
    msg({ locale: 'fr' })`Save`,

    // @ts-expect-error a plain string is literal text, without values
    msg('Hello, {name}', { name }),

    // @ts-expect-error m takes a string or a Msg
    m(1),

    // @ts-expect-error a template with values is not a string
    ((): string => msg`Hello, ${{ name }}!`)(),
  ];
}
