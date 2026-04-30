import { describe, it, expect } from 'vitest';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import { collectionPass } from '../collectionPass';
import { initializeState } from '../../state/utils/initializeState';
import { TransformState } from '../../state/types';
import { TranslationContent } from '../../state/StringCollector';

/**
 * E2E tests for string extraction through the collection pass.
 *
 * Exercises the full pipeline: source code → parse → collection pass → StringCollector
 * for gt() (useGT callback), msg(), and t() with complex static expressions.
 */

function collect(
  code: string,
  overrides: Record<string, unknown> = {}
): TransformState {
  const state = initializeState(overrides, 'test.tsx');
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });
  traverse(ast, collectionPass(state));
  return state;
}

function getCallbackContent(state: TransformState): TranslationContent[] {
  return state.stringCollector.getAllTranslationContent();
}

function getRuntimeContent(state: TransformState): TranslationContent[] {
  return state.stringCollector.getRuntimeOnlyContent();
}

// ─────────────────────────────────────────────────────
// gt() — useGT callback
// ─────────────────────────────────────────────────────

describe('gt() string extraction E2E', () => {
  const prefix = `import { useGT } from 'gt-next';\nconst gt = useGT();\n`;

  it('extracts simple string literal', () => {
    const state = collect(prefix + `gt("Hello");`);
    const content = getCallbackContent(state);
    expect(content).toHaveLength(1);
    expect(content[0].message).toBe('Hello');
    expect(content[0].hash).toBeTruthy();
  });

  it('extracts string concatenation: "Hello" + " World"', () => {
    const state = collect(prefix + `gt("Hello" + " World");`);
    const content = getCallbackContent(state);
    expect(content).toHaveLength(1);
    expect(content[0].message).toBe('Hello World');
    expect(content[0].hash).toBeTruthy();
  });

  it('extracts template literal with static expression: `Hello ${"World"}`', () => {
    const state = collect(prefix + 'gt(`Hello ${"World"}`);');
    const content = getCallbackContent(state);
    expect(content).toHaveLength(1);
    expect(content[0].message).toBe('Hello World');
  });

  it('extracts nested template: `A ${`B ${"C"}`}`', () => {
    const state = collect(prefix + 'gt(`A ${`B ${"C"}`}`);');
    const content = getCallbackContent(state);
    expect(content).toHaveLength(1);
    expect(content[0].message).toBe('A B C');
  });

  it('extracts mixed concat + template: "A" + `B ${"C"}`', () => {
    const state = collect(prefix + 'gt("A" + `B ${"C"}`);');
    const content = getCallbackContent(state);
    expect(content).toHaveLength(1);
    expect(content[0].message).toBe('AB C');
  });

  it('extracts with numeric literal: `Count: ${5}`', () => {
    const state = collect(prefix + 'gt(`Count: ${5}`);');
    const content = getCallbackContent(state);
    expect(content).toHaveLength(1);
    expect(content[0].message).toBe('Count: 5');
  });

  it('extracts with options alongside complex expression', () => {
    const state = collect(
      prefix + 'gt("Hello" + " World", { $id: "hw", $context: "greeting" });'
    );
    const content = getCallbackContent(state);
    expect(content).toHaveLength(1);
    expect(content[0].message).toBe('Hello World');
    expect(content[0].id).toBe('hw');
    expect(content[0].context).toBe('greeting');
  });

  it('extracts $context from string concatenation: "section" + ".title"', () => {
    const state = collect(
      prefix + 'gt("Hello", { $context: "section" + ".title" });'
    );
    const content = getCallbackContent(state);
    expect(content).toHaveLength(1);
    expect(content[0].context).toBe('section.title');
  });

  it('extracts $context from string + numeric: "section" + 1', () => {
    const state = collect(prefix + 'gt("Hello", { $context: "section" + 1 });');
    const content = getCallbackContent(state);
    expect(content).toHaveLength(1);
    expect(content[0].context).toBe('section1');
  });

  it('extracts $context from template literal: `section.title`', () => {
    const state = collect(
      prefix + 'gt("Hello", { $context: `section.title` });'
    );
    const content = getCallbackContent(state);
    expect(content).toHaveLength(1);
    expect(content[0].context).toBe('section.title');
  });

  it('rejects $context with dynamic variable', () => {
    const state = collect(prefix + 'gt("Hello", { $context: contextVar });');
    const content = getCallbackContent(state);
    expect(content).toHaveLength(0);
    expect(state.errorTracker.getErrors().length).toBeGreaterThan(0);
  });

  it('extracts multiple calls independently', () => {
    const state = collect(
      prefix + `gt("Hello" + " World");\ngt(\`Foo \${"Bar"}\`);`
    );
    const content = getCallbackContent(state);
    expect(content).toHaveLength(2);
    expect(content[0].message).toBe('Hello World');
    expect(content[1].message).toBe('Foo Bar');
  });

  it('produces different hashes for different content', () => {
    const state = collect(prefix + `gt("Hello");\ngt("World");`);
    const content = getCallbackContent(state);
    expect(content).toHaveLength(2);
    expect(content[0].hash).not.toBe(content[1].hash);
  });

  it('produces same hash regardless of expression form', () => {
    const state1 = collect(prefix + `gt("Hello World");`);
    const state2 = collect(prefix + `gt("Hello" + " World");`);
    const state3 = collect(prefix + 'gt(`Hello ${"World"}`);');
    const c1 = getCallbackContent(state1);
    const c2 = getCallbackContent(state2);
    const c3 = getCallbackContent(state3);
    expect(c1[0].hash).toBe(c2[0].hash);
    expect(c2[0].hash).toBe(c3[0].hash);
  });

  it('extracts string + numeric literal: "Hello, " + 1', () => {
    const state = collect(prefix + `gt("Hello, " + 1);`);
    const content = getCallbackContent(state);
    expect(content).toHaveLength(1);
    expect(content[0].message).toBe('Hello, 1');
  });

  it('extracts string + string via concat: "page" + ".title"', () => {
    const state = collect(prefix + `gt("page" + ".title");`);
    const content = getCallbackContent(state);
    expect(content).toHaveLength(1);
    expect(content[0].message).toBe('page.title');
  });

  it('extracts string + numeric: "section" + 1', () => {
    const state = collect(prefix + `gt("section" + 1);`);
    const content = getCallbackContent(state);
    expect(content).toHaveLength(1);
    expect(content[0].message).toBe('section1');
  });

  it('extracts chained concat: "a" + "b" + "c"', () => {
    const state = collect(prefix + `gt("a" + "b" + "c");`);
    const content = getCallbackContent(state);
    expect(content).toHaveLength(1);
    expect(content[0].message).toBe('abc');
  });

  it('extracts string + boolean: "value: " + true', () => {
    const state = collect(prefix + `gt("value: " + true);`);
    const content = getCallbackContent(state);
    expect(content).toHaveLength(1);
    expect(content[0].message).toBe('value: true');
  });

  it('extracts string + null: "value: " + null', () => {
    const state = collect(prefix + `gt("value: " + null);`);
    const content = getCallbackContent(state);
    expect(content).toHaveLength(1);
    expect(content[0].message).toBe('value: null');
  });

  it('rejects variable + string: variable + ".title"', () => {
    const state = collect(prefix + `gt(variable + ".title");`);
    const content = getCallbackContent(state);
    expect(content).toHaveLength(0);
    expect(state.errorTracker.getErrors().length).toBeGreaterThan(0);
  });

  it('rejects dynamic content with no extraction', () => {
    const state = collect(prefix + `gt(name);`);
    const content = getCallbackContent(state);
    expect(content).toHaveLength(0);
    expect(state.errorTracker.getErrors().length).toBeGreaterThan(0);
  });

  it('rejects template with dynamic expression', () => {
    const state = collect(prefix + 'gt(`Hello ${name}`);');
    const content = getCallbackContent(state);
    expect(content).toHaveLength(0);
    expect(state.errorTracker.getErrors().length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────
// msg() — standalone
// ─────────────────────────────────────────────────────

describe('msg() string extraction E2E', () => {
  const prefix = `import { msg } from 'gt-next';\n`;

  it('extracts simple string literal', () => {
    const state = collect(prefix + `msg("Hello");`);
    const content = getRuntimeContent(state);
    expect(content).toHaveLength(1);
    expect(content[0].message).toBe('Hello');
    expect(content[0].hash).toBeTruthy();
  });

  it('extracts string concatenation: "Hello" + " World"', () => {
    const state = collect(prefix + `msg("Hello" + " World");`);
    const content = getRuntimeContent(state);
    expect(content).toHaveLength(1);
    expect(content[0].message).toBe('Hello World');
  });

  it('extracts template literal with static expression: `Hello ${"World"}`', () => {
    const state = collect(prefix + 'msg(`Hello ${"World"}`);');
    const content = getRuntimeContent(state);
    expect(content).toHaveLength(1);
    expect(content[0].message).toBe('Hello World');
  });

  it('extracts nested template: `A ${`B ${"C"}`}`', () => {
    const state = collect(prefix + 'msg(`A ${`B ${"C"}`}`);');
    const content = getRuntimeContent(state);
    expect(content).toHaveLength(1);
    expect(content[0].message).toBe('A B C');
  });

  it('extracts mixed concat + template', () => {
    const state = collect(prefix + 'msg("A" + `B ${"C"}`);');
    const content = getRuntimeContent(state);
    expect(content).toHaveLength(1);
    expect(content[0].message).toBe('AB C');
  });

  it('extracts with options', () => {
    const state = collect(
      prefix + 'msg("Hello" + " World", { $id: "hw", $context: "nav" });'
    );
    const content = getRuntimeContent(state);
    expect(content).toHaveLength(1);
    expect(content[0].message).toBe('Hello World');
    expect(content[0].id).toBe('hw');
    expect(content[0].context).toBe('nav');
  });

  it('produces same hash as gt() for identical content', () => {
    const gtCode = `import { useGT } from 'gt-next';\nconst gt = useGT();\ngt("Hello World");`;
    const msgCode = `import { msg } from 'gt-next';\nmsg("Hello" + " World");`;
    const gtState = collect(gtCode);
    const msgState = collect(msgCode);
    const gtContent = getCallbackContent(gtState);
    const msgContent = getRuntimeContent(msgState);
    expect(gtContent[0].hash).toBe(msgContent[0].hash);
  });

  it('rejects dynamic content', () => {
    const state = collect(prefix + 'msg(name);');
    const content = getRuntimeContent(state);
    expect(content).toHaveLength(0);
    expect(state.errorTracker.getErrors().length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────
// t() — standalone (not tagged template)
// ─────────────────────────────────────────────────────

describe('t() string extraction E2E', () => {
  const prefix = `import { t } from 'gt-next';\n`;

  it('extracts simple string literal', () => {
    const state = collect(prefix + `t("Hello");`);
    const content = getRuntimeContent(state);
    expect(content).toHaveLength(1);
    expect(content[0].message).toBe('Hello');
    expect(content[0].hash).toBeTruthy();
  });

  it('extracts string concatenation: "Hello" + " World"', () => {
    const state = collect(prefix + `t("Hello" + " World");`);
    const content = getRuntimeContent(state);
    expect(content).toHaveLength(1);
    expect(content[0].message).toBe('Hello World');
  });

  it('extracts template literal with static expression: `Hello ${"World"}`', () => {
    const state = collect(prefix + 't(`Hello ${"World"}`);');
    const content = getRuntimeContent(state);
    expect(content).toHaveLength(1);
    expect(content[0].message).toBe('Hello World');
  });

  it('extracts nested template: `A ${`B ${"C"}`}`', () => {
    const state = collect(prefix + 't(`A ${`B ${"C"}`}`);');
    const content = getRuntimeContent(state);
    expect(content).toHaveLength(1);
    expect(content[0].message).toBe('A B C');
  });

  it('extracts mixed concat + template', () => {
    const state = collect(prefix + 't("A" + `B ${"C"}`);');
    const content = getRuntimeContent(state);
    expect(content).toHaveLength(1);
    expect(content[0].message).toBe('AB C');
  });

  it('extracts with options', () => {
    const state = collect(
      prefix + 't("Hello" + " World", { $id: "hw", $context: "nav" });'
    );
    const content = getRuntimeContent(state);
    expect(content).toHaveLength(1);
    expect(content[0].message).toBe('Hello World');
    expect(content[0].id).toBe('hw');
    expect(content[0].context).toBe('nav');
  });

  it('produces same hash as gt() for identical content', () => {
    const gtCode = `import { useGT } from 'gt-next';\nconst gt = useGT();\ngt("Hello World");`;
    const tCode = `import { t } from 'gt-next';\nt("Hello" + " World");`;
    const gtState = collect(gtCode);
    const tState = collect(tCode);
    const gtContent = getCallbackContent(gtState);
    const tContent = getRuntimeContent(tState);
    expect(gtContent[0].hash).toBe(tContent[0].hash);
  });

  it('rejects dynamic content', () => {
    const state = collect(prefix + 't(name);');
    const content = getRuntimeContent(state);
    expect(content).toHaveLength(0);
    expect(state.errorTracker.getErrors().length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────
// t`` — tagged template (collection pass extraction)
//
// Unlike gt()/msg()/t(), tagged templates convert dynamic
// expressions into ICU {0} placeholders rather than rejecting them.
// The collection pass extracts via processTaggedTemplateExpression
// for unbound t or t imported from gt-react/browser.
// ─────────────────────────────────────────────────────

describe('t`` tagged template extraction E2E', () => {
  it('extracts simple tagged template: t`Hello`', () => {
    const state = collect('t`Hello`;');
    const content = getRuntimeContent(state);
    expect(content).toHaveLength(1);
    expect(content[0].message).toBe('Hello');
    expect(content[0].hash).toBeTruthy();
  });

  it('reports invalid escape sequences in tagged templates', () => {
    const state = collect('t`\\xg`;');
    const content = getRuntimeContent(state);
    expect(content).toHaveLength(0);
    expect(state.errorTracker.getErrors()).toEqual([
      'Template literal contains an invalid escape sequence',
    ]);
  });

  it('extracts tagged template with dynamic expression as ICU placeholder: t`Hello ${name}`', () => {
    const state = collect('const name = "World";\nt`Hello ${name}`;');
    const content = getRuntimeContent(state);
    expect(content).toHaveLength(1);
    expect(content[0].message).toBe('Hello {0}');
  });

  it('extracts tagged template with multiple dynamic expressions: t`${greeting} ${name}!`', () => {
    const state = collect(
      'const greeting = "Hi";\nconst name = "World";\nt`${greeting} ${name}!`;'
    );
    const content = getRuntimeContent(state);
    expect(content).toHaveLength(1);
    expect(content[0].message).toBe('{0} {1}!');
  });

  it('extracts tagged template with static string expression collapsed: t`Hello ${"World"}`', () => {
    const state = collect('t`Hello ${"World"}`;');
    const content = getRuntimeContent(state);
    expect(content).toHaveLength(1);
    expect(content[0].message).toBe('Hello World');
  });

  it('extracts tagged template with nested static template: t`A ${`B`}`', () => {
    const state = collect('t`A ${`B`}`;');
    const content = getRuntimeContent(state);
    expect(content).toHaveLength(1);
    expect(content[0].message).toBe('A B');
  });

  it('extracts tagged template with static concat in expression: t`Hello ${"Wo" + "rld"}`', () => {
    const state = collect('t`Hello ${"Wo" + "rld"}`;');
    const content = getRuntimeContent(state);
    expect(content).toHaveLength(1);
    expect(content[0].message).toBe('Hello World');
  });

  it('extracts tagged template with numeric literal collapsed: t`Count: ${5}`', () => {
    const state = collect('t`Count: ${5}`;');
    const content = getRuntimeContent(state);
    expect(content).toHaveLength(1);
    expect(content[0].message).toBe('Count: 5');
  });

  it('extracts tagged template with mixed static and dynamic: t`Hello ${"World"}, ${name}!`', () => {
    const state = collect('const name = "X";\nt`Hello ${"World"}, ${name}!`;');
    const content = getRuntimeContent(state);
    expect(content).toHaveLength(1);
    expect(content[0].message).toBe('Hello World, {0}!');
  });

  it('extracts tagged template imported from gt-react/browser', () => {
    const state = collect(`import { t } from 'gt-react/browser';\nt\`Hello\`;`);
    const content = getRuntimeContent(state);
    expect(content).toHaveLength(1);
    expect(content[0].message).toBe('Hello');
  });

  it('does not extract tagged template imported from non-GT source', () => {
    const state = collect(`import { t } from 'i18next';\nt\`Hello\`;`);
    const content = getRuntimeContent(state);
    expect(content).toHaveLength(0);
  });

  it('skips tagged template containing derive() (returns TemplateLiteral)', () => {
    const state = collect(
      `import { derive } from 'gt-react/browser';\nt\`Hello \${derive(getName())}\`;`
    );
    const content = getRuntimeContent(state);
    expect(content).toHaveLength(0);
  });

  it('produces same hash as gt() for purely static content', () => {
    const gtCode = `import { useGT } from 'gt-next';\nconst gt = useGT();\ngt("Hello World");`;
    const taggedCode = `t\`Hello World\`;`;
    const gtState = collect(gtCode);
    const taggedState = collect(taggedCode);
    const gtHash = getCallbackContent(gtState)[0].hash;
    const taggedHash = getRuntimeContent(taggedState)[0].hash;
    expect(gtHash).toBe(taggedHash);
  });
});

// ─────────────────────────────────────────────────────
// Cross-function consistency
// ─────────────────────────────────────────────────────

describe('cross-function hash consistency', () => {
  it('gt(), msg(), and t() produce identical hashes for same complex expression result', () => {
    const gtCode = `import { useGT } from 'gt-next';\nconst gt = useGT();\ngt("A" + \`B \${"C"}\`);`;
    const msgCode = `import { msg } from 'gt-next';\nmsg("A" + \`B \${"C"}\`);`;
    const tCode = `import { t } from 'gt-next';\nt("A" + \`B \${"C"}\`);`;

    const gtState = collect(gtCode);
    const msgState = collect(msgCode);
    const tState = collect(tCode);

    const gtHash = getCallbackContent(gtState)[0].hash;
    const msgHash = getRuntimeContent(msgState)[0].hash;
    const tHash = getRuntimeContent(tState)[0].hash;

    expect(gtHash).toBeTruthy();
    expect(gtHash).toBe(msgHash);
    expect(msgHash).toBe(tHash);
  });
});
