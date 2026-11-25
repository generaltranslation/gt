// Type-level tests for the component prop types gt-react-native exports,
// checked by `tsc --noEmit` (not run by vitest).
import type { ComponentProps } from 'react';
import type {
  Currency,
  CurrencyProps,
  DateTime,
  DateTimeProps,
  N,
  NProps,
  Num,
  NumProps,
  Plural,
  PluralProps,
  RelativeTime,
  RelativeTimeProps,
  Select,
  SelectProps,
} from '../index';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
function expectType<_T extends true>(): void {}

expectType<Equal<ComponentProps<typeof Currency>, CurrencyProps>>();
expectType<Equal<ComponentProps<typeof DateTime>, DateTimeProps>>();
expectType<Equal<ComponentProps<typeof N>, NProps>>();
expectType<Equal<ComponentProps<typeof Num>, NumProps>>();
expectType<Equal<ComponentProps<typeof Plural>, PluralProps>>();
expectType<Equal<ComponentProps<typeof RelativeTime>, RelativeTimeProps>>();
expectType<Equal<ComponentProps<typeof Select>, SelectProps>>();
