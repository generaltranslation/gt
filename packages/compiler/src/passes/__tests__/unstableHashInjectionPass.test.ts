import { afterEach, describe, expect, it, vi } from 'vitest';
import { hashMessageTree } from 'generaltranslation/id';
import { transformWithPlugin } from '../../__tests__/transformWithPlugin';
import wireFormatCases from '../../../../../test-fixtures/icu-tree-wire-format.json';

const UNSTABLE_HELPERS =
  't, useGT, getGT, plural, selectordinal, select, number, date, part, derive, n';

// The fixtures' free variables, as local values like fixtureParity.test.ts:
// only a provably primitive value is hashed as an unnamed variable.
const FIXTURE_VALUES =
  "const first = 'Ada', second = 'Grace', count = 2, role = 'admin', price = 9.5, name = 'Ada';\nconst due = new Date(0);";

const injectedHashes = (output: string | null) =>
  [...(output ?? '').matchAll(/\$_hash: "([^"]*)"/g)].map((match) => match[1]);

// A thrown transform error is logged and also returns null; fail on it.
afterEach(() => {
  const { calls } = consoleError.mock;
  consoleError.mockClear();
  expect(calls).toEqual([]);
});
const consoleError = vi.spyOn(console, 'error');

async function compile(body: string, options?: { compileTimeHash: boolean }) {
  return transformWithPlugin(
    options,
    `import { ${UNSTABLE_HELPERS} } from 'gt-i18n/unstable';\n${body}\n`
  );
}

describe('unstableHashInjectionPass', () => {
  // `gt` in each fixture template becomes the tag under test.
  const forms: Record<string, (template: string) => string> = {
    t: (template) => `${template.replace(/^gt/, 't')};`,
    useGT: (template) =>
      `export function Component() {\n  const gt = useGT();\n  return ${template};\n}`,
    getGT: (template) =>
      `export async function load() {\n  const gt = await getGT();\n  return ${template};\n}`,
  };

  describe.each(Object.keys(forms))('fixture parity via %s', (form) => {
    it.each(wireFormatCases.map((testCase) => [testCase.name, testCase]))(
      '%s',
      async (_name, testCase) => {
        const output = await compile(
          `${FIXTURE_VALUES}\n${forms[form](testCase.template)}`
        );
        if (testCase.template.includes('derive(')) {
          // derive() values are resolved by the runtime, which hashes them.
          expect(output).toBeNull();
        } else {
          expect(injectedHashes(output)).toEqual([testCase.hash]);
        }
      }
    );
  });

  it('rewrites the tag into the options form', async () => {
    const save = hashMessageTree(['Save']);
    const button = hashMessageTree(['Save'], {
      context: 'button',
    });
    const output = await compile(
      "t`Save`;\nt({ context: 'button', locale: getLocale() })`Save`;"
    );
    expect(output).toContain(`t({ $_hash: "${save}" })\`Save\``);
    expect(output).toContain(
      `t({ context: 'button', locale: getLocale(), $_hash: "${button}" })\`Save\``
    );
  });

  it.each([
    ['a variable with two keys', 't`Hello ${{ name, other }}`;'],
    ['an options variable', 't(options)`Save`;'],
    ['a dynamic context', 't({ context: label })`Save`;'],
    ['an unsupported option', "t({ $_hash: 'custom' })`Save`;"],
    ['a __proto__ variable', 't`Hello ${{ __proto__: name }}`;'],
    ['a __proto__ branch', "t`${select({ role }, { __proto__: 'x' })}`;"],
    ['a dynamic branch', 't`${plural({ count }, { other: label })}`;'],
    ['a dynamic Intl option', 't`${number({ n }, { currency: code })}`;'],
    ['a placeholder variable', 'const role = derive(admin);\nt`Role ${role}`;'],
    ['an object variable', 'const vars = { name };\nt`Hi ${vars}`;'],
    [
      'an aliased helper',
      "const many = plural;\nt`${many({ count }, { other: '#' })}`;",
    ],
    ['a conditional fragment', 't`${flag ? part`a` : part`b`}`;'],
    [
      'a branch template literal with values',
      't`${plural({ count }, { other: `from ${name}` })}`;',
    ],
    ['n outside a plural', 't`${n} items`;'],
    [
      'a fragment read from a local object',
      'const fragments = { greeting: part`Hi ${{ name }}!` };\nt`Hi ${fragments.greeting}`;',
    ],
    [
      'a fragment read through a computed literal key',
      "const f = { ['greeting']: part`Hello` };\nt`${f.greeting}`;",
    ],
    [
      'a fragment read after a sibling property of the same object',
      "const f = { plain: '', greeting: part`Hello` };\nt`${flag ? f.plain : f.greeting}`;",
    ],
    [
      'a fragment assigned from an inner scope',
      "let v = '';\n{\n  const fragment = part`Hello`;\n  v = fragment;\n}\nt`${v}`;",
    ],
    [
      'an aliased n',
      'const c = n;\nt`${plural({ count }, { other: part`${c} items` })}`;',
    ],
    [
      'an object assigned to a destructured variable',
      'let { value } = input;\nvalue = { name };\nt`Hi ${value}`;',
    ],
    [
      'an unnamed plural value that holds a { name: value } object',
      "const vars = { count };\nt`${plural(vars, { other: 'x' })}`;",
    ],
    ['an unnamed date value written as an object', 't`${date({ ...due })}`;'],
    ['a reassigned gt', 'let gt = useGT();\ngt = other;\ngt`Save`;'],
    // Values whose shape Babel cannot see: an object is a named variable at
    // runtime, so guessing an unnamed one would miss the catalog entry.
    [
      'a parameter passed to a helper',
      "function label(value: { count: number }) {\n  return t`${plural(value, { other: 'items' })}`;\n}",
    ],
    [
      'a plain parameter',
      'function hi(name: string) {\n  return t`Hi ${name}`;\n}',
    ],
    [
      'a call result passed to a helper',
      'const values = () => ({ count: 2 });\nt`Count: ${number(values())}`;',
    ],
    ['a call result', 't`Hi ${getName()}`;'],
    [
      'a destructured value',
      "const { value } = { value: { name: 'Ada' } };\nt`Hi ${value}`;",
    ],
    [
      'a fragment read through an alias of a local object',
      'const fragments = { greeting: part`Hello` };\nconst alias = fragments;\nt`${alias.greeting}`;',
    ],
    [
      'a mutated property',
      "const box = { value: '' };\nbox.value = { name: 'Ada' };\nt`Hi ${box.value}`;",
    ],
    ['an undeclared value', 't`Hi ${user}`;'],
    [
      'a value assigned by a loop',
      "let item = '';\nfor (item of items) {}\nt`Hi ${item}`;",
    ],
    ['a destructured gt', 'const [gt] = useGT();\ngt`Save`;'],
  ])('leaves templates with %s untouched', async (_name, body) => {
    expect(await compile(body)).toBeNull();
  });

  it.each([
    [
      'a branch',
      "const one = part`# item`;\nt`${plural({ count }, { one, other: '# items' })}`;",
    ],
    [
      'a mutated fragment',
      "const fragment = part`Before`;\nfragment.strings = ['After'];\nt`${fragment}`;",
    ],
  ])(
    'leaves a part`...` referenced by identifier in %s to the runtime',
    async (_name, body) => {
      expect(await compile(body)).toBeNull();
    }
  );

  // Each level reads the one before twice, so the unbudgeted search doubles per level.
  const sharedChain = (depth: number) =>
    Array.from(
      { length: depth },
      (_, i) => `const v${i + 1} = flag ? v${i} : v${i};`
    ).join('\n');

  it('hashes a value behind a short chain of shared aliases', async () => {
    const output = await compile(
      `const v0 = 'plain';\n${sharedChain(4)}\nt\`Hi \${v4}\`;`
    );
    expect(injectedHashes(output)).toHaveLength(1);
  });

  it('leaves a value behind a long chain of shared aliases to the runtime', async () => {
    const output = await compile(
      `const v0 = 'plain';\n${sharedChain(20)}\nt\`Hi \${v20}\`;`
    );
    expect(output).toBeNull();
  });

  it.each([
    ['a literal', "t`Hi ${'Ada'}`;"],
    ['a template literal', 't`Hi ${`${first} ${last}`}`;'],
    ['an operator result', 't`Total ${price * count}`;'],
    ['a negated value', 't`Is ${!flag}`;'],
    [
      'a local variable whose every value is primitive',
      "let label = 'a';\nlabel += suffix;\nlabel = flag ? 'b' : label;\nt`Hi ${label}`;",
    ],
    [
      'a local Date passed to date()',
      'const due = new Date(0);\nt`Due ${date(due)}`;',
    ],
    ['undefined', 't`Hi ${undefined}`;'],
  ])('hashes %s as an unnamed value', async (_name, body) => {
    expect(injectedHashes(await compile(body))).toHaveLength(1);
  });

  it('skips only a template with a reserved variable name', async () => {
    const output = await compile('t`Hi ${{ _gt_user }}`;\nt`Save`;');
    expect(injectedHashes(output)).toEqual([hashMessageTree(['Save'])]);
  });

  it('skips templates when compileTimeHash is false', async () => {
    expect(await compile('t`Save`;', { compileTimeHash: false })).toBeNull();
  });

  it('ignores the same names imported from legacy sources', async () => {
    const output = await transformWithPlugin(
      undefined,
      "import { useGT } from 'gt-react';\nimport { t } from 'gt-i18n/unstable';\nconst gt = useGT();\ngt`Save`;"
    );
    expect(output).toBeNull();
  });
});
