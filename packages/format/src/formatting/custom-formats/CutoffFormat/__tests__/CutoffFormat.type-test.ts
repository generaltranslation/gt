// Type-level tests for CutoffFormat, checked by `tsc --noEmit` (not run by
// vitest).
import { CutoffFormatConstructor } from '../CutoffFormat';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
function expectType<_T extends true>(): void {}

// An absent terminator or separator is left out, so every part is a string.
const parts = new CutoffFormatConstructor('en', {
  maxChars: 5,
}).formatToParts('Hello, world!');
expectType<
  Equal<typeof parts, [string] | [string, string] | [string, string, string]>
>();
