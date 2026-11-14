/**
 * String extraction through the collection pass: source code -> collection
 * pass -> StringCollector, for gt() (the useGT callback), msg(), t() and
 * t`` tagged templates.
 *
 * Every extracted entry is checked against the shared hasher, so the same
 * message hashes identically whichever function or expression form it came
 * from.
 */
import { describe, it, expect } from 'vitest';
import { runPasses } from './testHelpers';
import hashSource from '../../utils/calculateHash';

/**
 * The entries in each collection. gt() callbacks register in the callback
 * collection; standalone msg(), t() and t`` register as runtime-only. Which
 * collection an entry lands in decides whether it is preloaded.
 */
function collect(code: string) {
  const { state, errors } = runPasses(code, ['collection']);
  return {
    errors,
    callback: state.stringCollector.getAllTranslationContent(),
    runtimeOnly: state.stringCollector.getRuntimeOnlyContent(),
  };
}

const entry = (
  message: string,
  options: { id?: string; context?: string } = {}
) => ({
  message,
  ...options,
  hash: hashSource({
    source: message,
    context: options.context,
    dataFormat: 'ICU',
  }),
});

const GT = `import { useGT } from 'gt-next';\nconst gt = useGT();\n`;
const MSG = `import { msg } from 'gt-next';\n`;
const T = `import { t } from 'gt-next';\n`;

describe('gt() callback extraction', () => {
  it.each([
    ['"Hello"', 'Hello'],
    ['"Hello" + " World"', 'Hello World'],
    ['`Hello ${"World"}`', 'Hello World'],
    ['"A" + `B ${"C"}`', 'AB C'],
    ['`Count: ${5}`', 'Count: 5'],
    ['"value: " + true', 'value: true'],
    ['"value: " + null', 'value: null'],
  ])('resolves gt(%s)', (expression, message) => {
    expect(collect(`${GT}gt(${expression});`)).toEqual({
      errors: [],
      callback: [entry(message)],
      runtimeOnly: [],
    });
  });

  it.each([
    ['"section" + 1', 'section1'],
    ['`section.title`', 'section.title'],
  ])('resolves a static $context: %s', (expression, context) => {
    expect(
      collect(`${GT}gt("Hello", { $context: ${expression} });`).callback
    ).toEqual([entry('Hello', { context })]);
  });

  it('extracts multiple calls independently, in order', () => {
    expect(
      collect(`${GT}gt("Hello" + " World");\ngt(\`Foo \${"Bar"}\`);`).callback
    ).toEqual([entry('Hello World'), entry('Foo Bar')]);
  });

  it.each([
    'gt(name);',
    'gt(variable + ".title");',
    'gt(`Hello ${name}`);',
    'gt("Hello", { $context: contextVar });',
  ])('rejects dynamic content: %s', (call) => {
    const { errors, callback, runtimeOnly } = collect(GT + call);
    expect([...callback, ...runtimeOnly]).toEqual([]);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe.each([
  ['gt() callback', GT, 'gt', 'callback'],
  ['msg()', MSG, 'msg', 'runtimeOnly'],
  ['t()', T, 't', 'runtimeOnly'],
])('%s', (_name, setup, fn, collection) => {
  it(`extracts a complex static expression with its options as ${collection}`, () => {
    expect(
      collect(
        `${setup}${fn}("A" + \`B \${"C"}\`, { $id: "hw", $context: "nav" });`
      )
    ).toEqual({
      errors: [],
      callback: [],
      runtimeOnly: [],
      [collection]: [entry('AB C', { id: 'hw', context: 'nav' })],
    });
  });

  it('rejects a dynamic message', () => {
    const { errors, callback, runtimeOnly } = collect(`${setup}${fn}(name);`);
    expect([...callback, ...runtimeOnly]).toEqual([]);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('t() extraction', () => {
  it('does not treat labels as shadowing translation imports', () => {
    const { runtimeOnly } = collect(
      `${T}t: while (condition) { t("Inside label"); }\nt("After label");`
    );
    expect(runtimeOnly.map(({ message }) => message)).toEqual([
      'Inside label',
      'After label',
    ]);
  });
});

// Unlike gt()/msg()/t(), tagged templates turn dynamic expressions into ICU
// {n} placeholders instead of rejecting them.
describe('t`` tagged template extraction', () => {
  it.each([
    ['t`Hello`;', 'Hello'],
    ['const name = "World";\nt`Hello ${name}`;', 'Hello {0}'],
    [
      'const greeting = "Hi";\nconst name = "World";\nt`${greeting} ${name}!`;',
      '{0} {1}!',
    ],
    ['const name = "X";\nt`Hello ${"World"}, ${name}!`;', 'Hello World, {0}!'],
    ["import { t } from 'gt-react';\nt`Hello`;", 'Hello'],
  ])('extracts %j', (code, message) => {
    expect(collect(code)).toEqual({
      errors: [],
      callback: [],
      runtimeOnly: [entry(message)],
    });
  });

  it.each([
    [
      't imported from a non-GT source',
      "import { t } from 'i18next';\nt`Hello`;",
    ],
    [
      'a template containing derive()',
      "import { derive } from 'gt-react';\nt`Hello ${derive(getName())}`;",
    ],
  ])('does not extract %s', (_name, code) => {
    expect(collect(code)).toEqual({
      errors: [],
      callback: [],
      runtimeOnly: [],
    });
  });

  it('reports invalid escape sequences', () => {
    expect(collect('t`\\xg`;')).toEqual({
      errors: ['Template literal contains an invalid escape sequence'],
      callback: [],
      runtimeOnly: [],
    });
  });
});

// ─────────────────────────────────────────────────────
// Unstable tagged-template API (extracted by the CLI as message trees)
// ─────────────────────────────────────────────────────

describe('unstable tagged-template sources are ignored', () => {
  it.each([
    'gt-react/unstable',
    'gt-tanstack-start/unstable',
    'gt-i18n/unstable',
  ])('does not collect t`` or useGT() tags imported from %s', (source) => {
    expect(
      collect(
        `import { t, useGT } from '${source}';\n` +
          'const gt = useGT();\n' +
          't`Hello, ${{ name }}!`;\n' +
          "t({ context: 'button' })`Save`;\n" +
          'gt`Hello`;\n' +
          "gt({ context: 'button' })`Save`;"
      )
    ).toEqual({ errors: [], callback: [], runtimeOnly: [] });
  });
});
