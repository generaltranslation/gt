// Type-level tests, checked by `tsc --noEmit` (not run by vitest). They
// mirror the mistakes section of the tagged-gt DX prototype.
import {
  date,
  derive,
  n,
  number,
  part,
  plural,
  select,
  selectordinal,
  t,
  type GT,
} from '../../unstable';

declare const gt: GT;
declare const name: string;
declare const count: number;
declare const who: string;
declare const role: 'admin' | 'member';
declare const status: 'in-progress' | 'done';
declare const price: number;
declare const due: Date;
declare const input: string;
const labels = { admin: 'Admin', member: 'Member' } as const;
enum Plan {
  Free = 'free',
  Pro = 'pro',
}
declare const plan: Plan;
declare const flag: boolean;
declare const category: 'admin' | 'other';
const planBranches = { [Plan.Free]: 'Free', [Plan.Pro]: 'Pro' } as const;
const indexedBranches: Record<string, 'Yes' | 'No'> & { other: 'No' } = {
  yes: 'Yes',
  other: 'No',
};
const optionalBranches: { admin: 'Admin'; member?: 'Member' } = {
  admin: 'Admin',
};
const optionalOther: { other?: 'Someone' } = {};
const counted = part`${n} items`;
const plain = part`plain`;

export function validUsage(): string[] {
  return [
    gt`Hello, world!`,
    gt`Hello, ${{ name }}!`,
    t`Hello, ${input}`,
    gt`${count} items, flag ${flag}`,
    t({ context: 'button: save a file' })`Save`,
    gt({ maxChars: 10, requiresReview: true, locale: 'fr' })`Save`,
    gt`You have ${plural({ count }, { one: part`${n} item`, other: part`${n} items` })}.`,
    gt`${plural({ count }, { '=0': 'None', one: part`${n} from ${{ who }}`, other: part`${n} from ${who}` })}`,
    gt`${selectordinal({ count }, { one: part`${n}st`, other: part`${n}th` })}`,
    gt`${select({ role }, { admin: 'Admin', member: 'Member' })}`,
    gt`${select({ role }, { admin: 'Admin', other: 'Someone' })}`,
    gt`${select({ who }, { other: 'Someone' })}`,
    gt`${plural({ count }, { '=0': 'None', other: `Some` })}`,
    gt`${plural({ count }, { '=-1': 'Overdrawn', other: 'Fine' })}`,
    gt`${plural({ count }, { other: part`${part`${n}`} items` })}`,
    gt`${plural({ count }, { other: part`${select({ role }, { admin: 'Admins', other: 'People' })} ${n}` })}`,
    gt`${select({ status }, { done: 'Done', other: 'Running' })}`,
    gt`Signed in as ${derive(role)}`,
    gt`Signed in as ${derive(labels[role])}`,
    gt`Total: ${number({ price }, { style: 'currency', currency: 'USD' })}`,
    gt`Due ${date({ due }, { dateStyle: 'medium' })}`,
    gt`${plural(count, { one: 'One file', other: part`${n} files` })}`,
    gt`${selectordinal(count, { one: part`${n}st`, other: part`${n}th` })}`,
    gt`${select(role, { admin: 'Admin', member: 'Member' })}`,
    gt`${select(who, { admin: 'Admin', other: 'Someone' })}`,
    gt`Total: ${number(price, { style: 'currency', currency: 'USD' })}`,
    gt`Due ${date(due, { dateStyle: 'medium' })} or ${date(0)}`,
    gt`${select(plan, { free: 'Free', pro: 'Pro' })}`,
    gt`${select({ plan }, { free: 'Free', other: 'Paid' })}`,
    // Computed enum keys are the values the enum compares with.
    gt`${select(plan, { [Plan.Free]: 'Free', [Plan.Pro]: 'Pro' })}`,
    gt`${select({ plan }, { [Plan.Free]: 'Free', [Plan.Pro]: 'Pro' })}`,
    gt`${select(plan, planBranches)}`,
    // other is reachable when 'other' is one of the values.
    gt`${select(category, { admin: 'Admin', other: 'Other' })}`,
    gt`${select({ category }, { admin: 'Admin', other: 'Other' })}`,
    gt`${select('other', { other: 'Other' })}`,
    // An index-signature map with a required other covers any value.
    gt`${select(who, indexedBranches)}`,
    // A part that may use `n` is fine in a plural branch.
    gt`${plural({ count }, { other: part`${flag ? counted : plain}` })}`,
  ];
}

export function mistakes(): unknown[] {
  return [
    // @ts-expect-error non-literal message
    gt(input),

    // @ts-expect-error a bare Date, which needs date() to be formatted
    gt`Due ${due}`,

    // @ts-expect-error a named Date
    gt`Due ${{ due }}`,

    // @ts-expect-error a value that may be a Date
    gt`Due ${Math.random() > 0.5 ? due : 'soon'}`,

    // @ts-expect-error placeholder with two keys
    gt`Hello, ${{ name, who }}`,

    // @ts-expect-error placeholder without a name
    gt`Hello, ${{}}`,

    // @ts-expect-error plural of a string
    gt`${plural({ n: 'three' }, { other: 'x' })}`,

    // @ts-expect-error plural without `other`
    gt`${plural({ n: 1 }, { one: 'x' })}`,

    // @ts-expect-error branch with a value, which needs part
    gt`${plural({ count }, { one: 'One', other: `${count} items` })}`,

    // @ts-expect-error branch with a variable, which needs part
    gt`${select({ role }, { admin: `Admin ${name}`, member: 'Member' })}`,

    // @ts-expect-error branch typed string, which may hold values
    gt`${plural({ count }, { other: input })}`,

    // @ts-expect-error typo'd plural category
    gt`${plural({ count }, { onee: 'One', other: 'Many' })}`,

    // @ts-expect-error branch for a value outside the union
    gt`${select({ role }, { admin: 'Admin', member: 'Member', guest: 'Guest' })}`,

    // @ts-expect-error select key ICU cannot write, even for a value in the union
    gt`${select({ status }, { 'in-progress': 'Running', done: 'Done' })}`,

    // @ts-expect-error select key ICU cannot write, next to other
    gt`${select({ who }, { 'non-binary': 'They', other: 'Someone' })}`,

    // @ts-expect-error exact plural key that is not an integer
    gt`${plural({ count }, { '=1.5': 'One and a half', other: 'Many' })}`,

    // @ts-expect-error hex exact plural key, which ICU reads as text
    gt`${plural({ count }, { '=0x10': 'Sixteen', other: 'Many' })}`,

    // @ts-expect-error binary exact plural key
    gt`${selectordinal({ count }, { '=0b1': 'First', other: 'Later' })}`,

    // @ts-expect-error =-0, which never matches a count
    gt`${plural({ count }, { '=-0': 'Zero', other: 'Many' })}`,

    // @ts-expect-error select misses 'member' and has no `other`
    gt`${select({ role }, { admin: 'Admin' })}`,

    // @ts-expect-error select over a plain string needs `other`
    gt`${select({ who }, { admin: 'Admin' })}`,

    // @ts-expect-error other is never used once every value has a branch
    gt`${select({ role }, { admin: 'Admin', member: 'Member', other: 'Someone' })}`,

    // @ts-expect-error unnamed select with an other that is never used
    gt`${select(role, { admin: 'Admin', member: 'Member', other: 'Someone' })}`,

    // @ts-expect-error select with no branches
    gt`${select(role, {})}`,

    // @ts-expect-error named select with no branches
    gt`${select({ role }, {})}`,

    // @ts-expect-error select over a plain string with no branches
    gt`${select(who, {})}`,

    // @ts-expect-error select of a string enum misses 'pro' and has no `other`
    gt`${select(plan, { free: 'Free' })}`,

    // @ts-expect-error unnamed select misses 'member' and has no `other`
    gt`${select(role, { admin: 'Admin' })}`,

    // @ts-expect-error unnamed select over a plain string needs `other`
    gt`${select(who, { admin: 'Admin' })}`,

    // @ts-expect-error unnamed select branch for a value outside the union
    gt`${select(role, { admin: 'Admin', member: 'Member', guest: 'Guest' })}`,

    // @ts-expect-error unnamed plural of a string
    gt`${plural('three', { other: 'x' })}`,

    // @ts-expect-error unnamed date of a string
    date('2024-01-01'),

    // @ts-expect-error typo'd option
    gt({ contxt: 'button' })`Save`,

    // @ts-expect-error number of a string
    number({ price: 'free' }),

    // @ts-expect-error `n` in a plain template literal, which needs part
    `${n} items`,

    // @ts-expect-error `n` outside a plural
    gt`${n} items`,

    // @ts-expect-error `n` in a part outside a plural
    gt`${part`${n} items`}`,

    // @ts-expect-error `n` next to another value in a select branch
    gt`${select({ role }, { admin: part`${n} from ${{ who }}`, other: 'People' })}`,

    // @ts-expect-error `n` in a select branch
    gt`${select({ role }, { admin: part`${n} admins`, other: 'People' })}`,

    // @ts-expect-error a part that may use `n`, at message level
    gt`${part`${flag ? n : 'none'}`}`,

    // @ts-expect-error a part that may hold a counted part, in a select branch
    gt`${select({ role }, { admin: part`${flag ? counted : plain}`, member: 'M' })}`,

    // @ts-expect-error a typed map whose member branch may be missing
    gt`${select({ role }, optionalBranches)}`,

    // @ts-expect-error a typed map whose other branch may be missing
    gt`${select(who, optionalOther)}`,

    // @ts-expect-error `n` in a select inside a plural, where ICU resets it
    gt`${plural({ count }, { other: part`${select({ role }, { admin: part`${n} admins`, other: 'People' })}` })}`,

    // @ts-expect-error placeholder with two keys inside part
    part`from ${{ name, who }}`,

    // @ts-expect-error derive() of any string
    derive(name),

    // @ts-expect-error derive() of a union with any string
    derive(role === 'admin' ? 'Admin' : name),

    // @ts-expect-error derive() of a template pattern
    derive(`dear ${name}` as const),
  ];
}
