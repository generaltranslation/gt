import type {
  FALLBACK_BRANCH_KEY,
  MessageTreeChoiceKind,
} from '@generaltranslation/icu/internal';
import { createGtI18nDiagnostic } from '../logs/diagnostics';

/**
 * Tags placeholder objects. `Symbol.for` lets placeholders created by one
 * bundled copy of gt-i18n be read by another.
 */
export const PLACEHOLDER: unique symbol = Symbol.for(
  'gt-i18n.unstable.placeholder'
);

type Primitive = string | number | bigint | boolean | Date | null | undefined;
// What a hole renders as text, like a template literal. A Date has no
// locale-aware text of its own, so it goes through date().
type HoleValue = Exclude<Primitive, Date>;
type DateHoleError = 'a Date needs date() to be formatted: ${date({ due })}';

/** Branch text: a string, or a `part` template that contains placeholders. */
export type Branch = string | Fragment;

type DerivePlaceholder = {
  readonly [PLACEHOLDER]: 'derive';
  readonly value: string;
};
// Text known only at runtime, which tx translates as part of the message.
type DynPlaceholder = {
  readonly [PLACEHOLDER]: 'dyn';
  readonly value: string;
};
// A helper's value is named, like plural({ count }, ...), or passed directly,
// like plural(count, ...), which leaves `name` undefined: an anonymous `_gt_N`.
type NumberPlaceholder = {
  readonly [PLACEHOLDER]: 'number';
  readonly name: string | undefined;
  readonly value: Primitive;
  readonly options?: Intl.NumberFormatOptions;
};
type DatePlaceholder = {
  readonly [PLACEHOLDER]: 'date';
  readonly name: string | undefined;
  readonly value: Primitive;
  readonly options?: Intl.DateTimeFormatOptions;
};
type ChoicePlaceholder<UsesDyn extends boolean = boolean> = {
  readonly [PLACEHOLDER]: MessageTreeChoiceKind;
  readonly name: string | undefined;
  readonly value: Primitive;
  readonly branches: Readonly<Record<string, Branch | undefined>>;
  readonly [USES_DYN]?: UsesDyn;
};
// Type-only: whether a fragment uses `n`, so places where ICU has no
// plural count can reject it. No runtime object has this key.
// shortcut: a value annotated as plain `Fragment` loses the flag and is checked
// only at runtime; infer the type from part`...` to keep the check.
declare const USES_PLURAL_COUNT: unique symbol;
// Type-only, the same way: whether a part or branch holds dyn() text, so gt,
// t and msg can reject it wherever it is nested.
declare const USES_DYN: unique symbol;
export type Fragment<
  UsesPluralCount extends boolean = boolean,
  UsesDyn extends boolean = boolean,
> = {
  readonly [PLACEHOLDER]: 'fragment';
  readonly strings: readonly string[];
  readonly holes: readonly unknown[];
  readonly [USES_PLURAL_COUNT]?: UsesPluralCount;
  readonly [USES_DYN]?: UsesDyn;
};
export type Placeholder =
  | DerivePlaceholder
  | NumberPlaceholder
  | DatePlaceholder
  | ChoicePlaceholder
  | Fragment;

/**
 * The count of the nearest `plural()` or `selectordinal()`, formatted for the
 * locale like ICU `#`: `` plural({ count }, { other: part`${n} items` }) ``.
 * A symbol, so a plain template literal cannot use it by mistake.
 * A local variable named `n` hides it and silently becomes an ordinary value,
 * so import it under another name there: `import { n as pound }`.
 */
export const n: unique symbol = Symbol.for('gt-i18n.unstable.plural-count');

// A bare value is anonymous; ${{ name }} must be exactly one key with a primitive value.
type IsUnion<T, U = T> = T extends unknown
  ? [U] extends [T]
    ? false
    : true
  : never;
type OneKey<O> = keyof O extends never
  ? never
  : true extends IsUnion<keyof O>
    ? never
    : O;
// `n`, or a part that uses it.
type PluralCountHole = typeof n | Fragment<true>;
// dyn() text, or a part or plural/select that holds it.
type DynHole =
  | DynPlaceholder
  | Fragment<boolean, true>
  | ChoicePlaceholder<true>;
/**
 * ICU has a plural count only inside a plural or selectordinal branch, so a
 * message (`AllowsPluralCount` false) rejects `n` and fragments that
 * use it, while a part may hold them for the branch it ends up in.
 */
type CheckHole<H, AllowsPluralCount extends boolean> = H extends PluralCountHole
  ? AllowsPluralCount extends true
    ? H
    : 'n, the plural count, only works inside a plural or selectordinal branch'
  : H extends Placeholder | DynPlaceholder | HoleValue
    ? H
    : H extends Date
      ? DateHoleError
      : H extends Record<string, Primitive>
        ? keyof H extends never
          ? 'placeholder needs a name: ${{ name }}'
          : true extends IsUnion<keyof H>
            ? 'placeholder must have exactly one key: ${{ name }}'
            : H[keyof H] extends HoleValue
              ? H
              : DateHoleError
        : 'placeholder is not a value, ${{ name }}, or an unstable helper';
/**
 * dyn() text has no catalog translation, so only tx, which translates at
 * runtime, accepts it. Distributes, so `flag ? dyn(text) : ''` is rejected too.
 */
type RejectDyn<H, AllowsPluralCount extends boolean> = H extends DynHole
  ? 'dyn() text is translated at runtime, so it only works in tx'
  : CheckHole<H, AllowsPluralCount>;
export type CheckHoles<
  H extends readonly unknown[],
  AllowsPluralCount extends boolean = false,
  AllowsDyn extends boolean = false,
> = {
  [I in keyof H]: AllowsDyn extends true
    ? CheckHole<H[I], AllowsPluralCount>
    : RejectDyn<H[I], AllowsPluralCount>;
};
// Distributes, so a hole like `flag ? n : 'none'` may be a PluralCountHole.
type MayBe<T, U> = T extends U ? true : false;
// Checks each hole on its own: the union of all holes would not match.
type SomeHoleIs<H extends readonly unknown[], U> = true extends {
  [I in keyof H]: MayBe<H[I], U>;
}[number]
  ? true
  : false;
type SomeBranchIs<B, U> = true extends {
  [K in keyof B]: MayBe<B[K], U>;
}[keyof B]
  ? true
  : false;

// ICU reads exact plural keys as integers, so `=1.5` is not one.
type ExactPluralKey = `=${bigint}`;
// TypeScript reads `${bigint}` like a bigint literal, so it also accepts
// `=0x10`, `=0b1` and `=0o7`, which ICU cannot read; `=-0` never matches.
type NonDecimalPluralKey =
  | `=${string}${'x' | 'X' | 'b' | 'B' | 'o' | 'O'}${string}`
  | '=-0';
type Other = typeof FALLBACK_BRANCH_KEY;
type PluralCategory = Exclude<Intl.LDMLPluralRule, Other> | ExactPluralKey;

/**
 * ICU ends a branch key at whitespace or a syntax character, so a key such as
 * `in-progress` cannot be written as ICU text and the runtime rejects it:
 * `select({ status }, { 'in-progress': 'Running', other: 'Done' })` throws.
 * shortcut: lists only ASCII; other Unicode whitespace and syntax characters
 * still fail at runtime only. Add them if such keys show up.
 */
type IcuSyntaxChar =
  | ' '
  | '\t'
  | '\n'
  | '\v'
  | '\f'
  | '\r'
  | '!'
  | '"'
  | '#'
  | '$'
  | '%'
  | '&'
  | "'"
  | '('
  | ')'
  | '*'
  | '+'
  | ','
  | '-'
  | '.'
  | '/'
  | ':'
  | ';'
  | '<'
  | '='
  | '>'
  | '?'
  | '@'
  | '['
  | '\\'
  | ']'
  | '^'
  | '`'
  | '{'
  | '|'
  | '}'
  | '~';
type InvalidKey = '' | `${string}${IcuSyntaxChar}${string}`;

// `${string}` rather than string keeps a template literal's holes in its type:
// `from ${name}` stays `from ${string}` instead of widening to string.
type BranchInput = `${string}` | Fragment;
// Record<T, 1> of a type with holes (or of string) is an index signature,
// which {} satisfies; a literal like 'No messages' is a required key.
type HasValues<T> = {} extends Record<T & string, 1> ? true : false;
/**
 * Replaces each invalid branch with an explanation, so the error lands on that
 * branch. Inferring through this mapped type also skips TypeScript's excess
 * property check, so unknown keys are checked here.
 */
type CheckBranches<B, Key, ExactKey = never> = {
  [K in keyof B]: KeyString<K> extends ExactKey
    ? KeyString<K> extends NonDecimalPluralKey
      ? 'an exact plural key is = and a decimal integer, like =0 or =-1'
      : CheckBranch<B[K], true>
    : KeyString<K> extends InvalidKey
      ? 'ICU cannot write this key, which is empty or has whitespace or a character like - or .: map the value to a key without them, or use other'
      : KeyString<K> extends Key
        ? // Only plurals have exact keys, and only plural branches have a count.
          CheckBranch<B[K], [ExactKey] extends [never] ? false : true>
        : 'not a branch of this plural or select';
};
type CheckBranch<T, AllowsPluralCount extends boolean> = [T] extends [string]
  ? HasValues<T> extends true
    ? 'this branch has values: write it as part`...`'
    : T
  : AllowsPluralCount extends true
    ? T
    : T extends Fragment<true>
      ? 'n is not the plural count inside select, as in ICU: use number({ count }) instead'
      : T;
// A key as the string a value is compared with: the computed key
// `[Plan.Free]` is 'free', and `{ 10: ... }` is '10'.
type KeyString<K> = `${K & (string | number)}`;
// Keys a typed branch map always has: an optional key may be missing.
type RequiredKeys<B> = {
  [K in keyof B]-?: {} extends Pick<B, K> ? never : KeyString<K>;
}[keyof B];
type HasOther<B> = B extends { [FALLBACK_BRANCH_KEY]: unknown } ? true : false;
/**
 * The parameter type lists the keys still valid for the branches typed so far,
 * which is what editors suggest, and makes a missing branch a required key
 * whose type explains the fix.
 */
type SelectBranches<B, V extends string> = string extends keyof B
  ? HasOther<B> extends true
    ? // An index-signature map with a required other covers any value.
      CheckBranches<B, V | Other>
    : // No branch keys to infer from, as in `{}` or while an editor completes.
      SelectBranchesNeeded<V>
  : string extends V
    ? HasOther<B> extends true
      ? CheckBranches<B, V | Other>
      : SelectOtherMissing<B, V>
    : HasOther<B> extends true
      ? // other is unused only when the other keys cover every value, so a
        // select of 'admin' | 'other' keeps it.
        [Exclude<V, Exclude<RequiredKeys<B>, Other>>] extends [never]
        ? UnusedOther<B, V>
        : CheckBranches<B, V | Other> &
            Partial<Record<Exclude<V, RequiredKeys<B>>, BranchInput>>
      : [Exclude<V, RequiredKeys<B>>] extends [never]
        ? CheckBranches<B, V>
        : SelectBranchMissing<B, V, Exclude<V, RequiredKeys<B>>>;
// Before any branch is typed, editors suggest every value and an optional other.
type SelectBranchesNeeded<V extends string> = string extends V
  ? { [FALLBACK_BRANCH_KEY]: 'select of any string needs an other branch' }
  : {
      [K in V]: `select needs a branch for '${K}', or an other branch`;
    } & Partial<Record<Exclude<Other, V>, BranchInput>>;
// A missing key is left out of the checked branches, so a typed map's
// optional key meets the explanation instead of collapsing it to never.
type SelectOtherMissing<B, V extends string> = Omit<
  CheckBranches<B, V>,
  Other
> & {
  [FALLBACK_BRANCH_KEY]: 'select of any string needs an other branch';
};
type SelectBranchMissing<B, V extends string, M extends string> = Omit<
  CheckBranches<B, V>,
  M
> & {
  [K in M]: `select needs a branch for '${K}', or an other branch`;
} & {
  [FALLBACK_BRANCH_KEY]?: BranchInput;
};
// Once every value of a finite union has a branch, `other` can never be chosen.
type UnusedOther<B, V extends string> = {
  [K in keyof B]: KeyString<K> extends Other
    ? 'other is never used: every value of the select has a branch, so remove other'
    : CheckBranches<B, V>[K];
};
type PluralBranches = { [FALLBACK_BRANCH_KEY]: BranchInput } & Partial<
  Record<PluralCategory, BranchInput>
>;

/**
 * Write branches with values as part`...`; `n` is the count. Name the count
 * with `plural({ count }, ...)`, or pass it directly as `plural(count, ...)`.
 */
export function plural<
  const O extends Record<string, number | bigint>,
  const B extends PluralBranches,
>(
  value: number | bigint | OneKey<O>,
  branches: CheckBranches<B, PluralCategory | Other, ExactPluralKey>
): ChoicePlaceholder<SomeBranchIs<B, DynHole>> {
  return choice('plural', value, branches as Record<string, Branch>);
}

export function selectordinal<
  const O extends Record<string, number | bigint>,
  const B extends PluralBranches,
>(
  value: number | bigint | OneKey<O>,
  branches: CheckBranches<B, PluralCategory | Other, ExactPluralKey>
): ChoicePlaceholder<SomeBranchIs<B, DynHole>> {
  return choice('selectordinal', value, branches as Record<string, Branch>);
}

// `${...}` turns a string enum's members into their values, which are the keys.
type SelectValue<A> = A extends string ? `${A}` : `${A[keyof A] & string}`;
/** Cover every value of a finite union, or add `other`. */
export function select<
  const A extends string | Record<string, string>,
  const B extends Record<string, BranchInput>,
>(
  value: A extends string ? A : OneKey<A>,
  branches: SelectBranches<B, SelectValue<A>>
): ChoicePlaceholder<SomeBranchIs<B, DynHole>> {
  // SelectBranches is only an error message when the call fails to type-check.
  return choice('select', value, branches as Record<string, Branch>);
}

/** Intl options instead of ICU skeleton strings: nothing to parse. */
export function number<const O extends Record<string, number | bigint>>(
  value: number | bigint | OneKey<O>,
  options?: Intl.NumberFormatOptions
): Placeholder {
  const [name, v] = entry(value);
  return { [PLACEHOLDER]: 'number', name, value: v, options };
}

export function date<const O extends Record<string, Date | number>>(
  value: Date | number | OneKey<O>,
  options?: Intl.DateTimeFormatOptions
): Placeholder {
  const [name, v] = entry(value);
  return { [PLACEHOLDER]: 'date', name, value: v, options };
}

/** Branch text that contains placeholders, written like a gt message. */
export function part<const H extends readonly unknown[]>(
  strings: TemplateStringsArray,
  ...holes: CheckHoles<H, true, true>
): Fragment<SomeHoleIs<H, PluralCountHole>, SomeHoleIs<H, DynHole>> {
  return { [PLACEHOLDER]: 'fragment', strings, holes };
}

// True when some member is any string, like `string` or `id-${string}`.
type IsOpen<T> = T extends unknown ? HasValues<T> : never;

/**
 * Static text chosen in code. The CLI reads every possible value from the
 * argument's type, so it must be a string literal or a union of them, such as
 * a union type, a string enum, or an `as const` lookup. In JavaScript files
 * this is best effort: the CLI reads the types TypeScript infers or JSDoc
 * declares, and skips the message with a warning when they are too wide.
 */
export function derive<const T extends string>(
  value: true extends IsOpen<T>
    ? 'derive() needs a finite set of strings: use a union type, a string enum, or as const'
    : T
): Placeholder {
  return { [PLACEHOLDER]: 'derive', value };
}

/**
 * Text known only at runtime, like a database value, which tx translates as
 * part of the message in one request: `` tx`${dyn(greeting)}, ${{ name }}!` ``.
 * gt, t and msg render from the catalog, which has no translation for such
 * text, so their types reject it. Each distinct text is its own message, and
 * it is sent for translation.
 */
export function dyn(text: string): DynPlaceholder {
  return { [PLACEHOLDER]: 'dyn', value: text };
}

export function isPlaceholder(
  value: unknown
): value is Placeholder | DynPlaceholder {
  return typeof value === 'object' && value !== null && PLACEHOLDER in value;
}

/** A value gt formats as is, rather than a `{ name: value }` binding. */
export function isAnonymousValue(value: unknown): boolean {
  return typeof value !== 'object' || value === null || value instanceof Date;
}

function entry(value: unknown): [string | undefined, Primitive] {
  if (isAnonymousValue(value)) return [undefined, value as Primitive];
  const [name, v] = getVariable(value);
  return [name, v as Primitive];
}

function createInvalidPlaceholderError(hole: unknown, keys: string[]): string {
  return createGtI18nDiagnostic({
    severity: 'Error',
    whatHappened:
      'A gt template placeholder is not a value, a named variable, or a helper',
    fix: 'Write named variables as ${{ name }} with exactly one key',
    details:
      typeof hole === 'object' && hole !== null
        ? `Object keys: ${keys.join(', ') || 'none'}`
        : `Received a ${typeof hole}`,
  });
}

/**
 * The name and value of a `{ name: value }` binding. Types reject most invalid
 * bindings; this check guards untyped callers and widened records.
 */
export function getVariable(hole: unknown): [name: string, value: unknown] {
  const keys =
    typeof hole === 'object' && hole !== null ? Object.keys(hole) : [];
  if (keys.length !== 1) {
    throw new Error(createInvalidPlaceholderError(hole, keys));
  }
  return [keys[0], (hole as Record<string, unknown>)[keys[0]]];
}

function choice<UsesDyn extends boolean>(
  kind: ChoicePlaceholder[typeof PLACEHOLDER],
  value: unknown,
  branches: Record<string, Branch | undefined>
): ChoicePlaceholder<UsesDyn> {
  const [name, v] = entry(value);
  return { [PLACEHOLDER]: kind, name, value: v, branches };
}
