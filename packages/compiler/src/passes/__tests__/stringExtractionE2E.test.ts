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
