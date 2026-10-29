import { afterEach, describe, expect, it, vi } from 'vitest';
import { hashMessageTree } from 'generaltranslation/id';
import { transformWithPlugin } from '../../__tests__/transformWithPlugin';
import wireFormatCases from '../../../../../test-fixtures/icu-tree-wire-format.json';

const UNSTABLE_HELPERS =
  't, useGT, getGT, plural, selectordinal, select, number, date, part, derive, n';

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
        const output = await compile(forms[form](testCase.template));
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
    const save = hashMessageTree([{ type: 0, value: 'Save' }]);
    const button = hashMessageTree([{ type: 0, value: 'Save' }], {
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

  it('hashes a destructured value as an anonymous value', async () => {
    const output = await compile(
      "const { name } = { name: 'Ada' };\nt`Hi ${name}`;"
    );
    expect(injectedHashes(output)).toEqual([
      hashMessageTree([
        { type: 0, value: 'Hi ' },
        { type: 1, value: '_gt_1' },
      ]),
    ]);
  });

  it('skips only a template with a reserved variable name', async () => {
    const output = await compile('t`Hi ${{ _gt_user }}`;\nt`Save`;');
    expect(injectedHashes(output)).toEqual([
      hashMessageTree([{ type: 0, value: 'Save' }]),
    ]);
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
