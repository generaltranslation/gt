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

/** Collected string entries (callback entries first, then standalone ones) */
function collect(code: string) {
  const { state, errors } = runPasses(code, ['collection']);
  return {
    errors,
    content: [
      ...state.stringCollector.getAllTranslationContent(),
      ...state.stringCollector.getRuntimeOnlyContent(),
    ],
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
      content: [entry(message)],
    });
  });

  it.each([
    ['"section" + 1', 'section1'],
    ['`section.title`', 'section.title'],
  ])('resolves a static $context: %s', (expression, context) => {
    expect(
      collect(`${GT}gt("Hello", { $context: ${expression} });`).content
    ).toEqual([entry('Hello', { context })]);
  });

  it('extracts multiple calls independently, in order', () => {
    expect(
      collect(`${GT}gt("Hello" + " World");\ngt(\`Foo \${"Bar"}\`);`).content
    ).toEqual([entry('Hello World'), entry('Foo Bar')]);
  });

  it.each([
    'gt(name);',
    'gt(variable + ".title");',
    'gt(`Hello ${name}`);',
    'gt("Hello", { $context: contextVar });',
  ])('rejects dynamic content: %s', (call) => {
    const { errors, content } = collect(GT + call);
    expect(content).toEqual([]);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe.each([
  ['gt() callback', GT, 'gt'],
  ['msg()', MSG, 'msg'],
  ['t()', T, 't'],
])('%s', (_name, setup, fn) => {
  it('extracts a complex static expression with its options', () => {
    expect(
      collect(
        `${setup}${fn}("A" + \`B \${"C"}\`, { $id: "hw", $context: "nav" });`
      )
    ).toEqual({
      errors: [],
      content: [entry('AB C', { id: 'hw', context: 'nav' })],
    });
  });

  it('rejects a dynamic message', () => {
    const { errors, content } = collect(`${setup}${fn}(name);`);
    expect(content).toEqual([]);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('t() extraction', () => {
  it('does not treat labels as shadowing translation imports', () => {
    const { content } = collect(
      `${T}t: while (condition) { t("Inside label"); }\nt("After label");`
    );
    expect(content.map(({ message }) => message)).toEqual([
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
    ["import { t } from 'gt-react/browser';\nt`Hello`;", 'Hello'],
    ["import { t } from 'gt-react/client';\nt`Hello`;", 'Hello'],
  ])('extracts %j', (code, message) => {
    expect(collect(code)).toEqual({ errors: [], content: [entry(message)] });
  });

  it.each([
    [
      't imported from a non-GT source',
      "import { t } from 'i18next';\nt`Hello`;",
    ],
    [
      'a template containing derive()',
      "import { derive } from 'gt-react/browser';\nt`Hello ${derive(getName())}`;",
    ],
  ])('does not extract %s', (_name, code) => {
    expect(collect(code)).toEqual({ errors: [], content: [] });
  });

  it('reports invalid escape sequences', () => {
    expect(collect('t`\\xg`;')).toEqual({
      errors: ['Template literal contains an invalid escape sequence'],
      content: [],
    });
  });
});
