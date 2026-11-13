import { describe, expect, test } from 'vitest';
import type { ParaglideUsage } from '../../src/compiler/analysis/types.js';
import { ENTRY, analyzeProject } from '../helpers/project.js';

const imports = [
  `import { m } from "./paraglide/messages.js";`,
  `import { getLocale } from "./paraglide/runtime.js";`,
  ``,
].join('\n');

/** e.g. `message:error_*:call dynamic` */
async function usages(code: string): Promise<string[]> {
  const found = await analyzeProject({ [ENTRY]: imports + code });
  return found.map(
    (usage: ParaglideUsage) =>
      `${usage.target}:${usage.name}:${usage.kind}${usage.dynamic ? ' dynamic' : ''}`
  );
}

describe('dynamic member access', () => {
  test.each([
    ['an unknown key', `m[key]();`, ['message:*:call dynamic']],
    [
      'a template with a prefix',
      'm[`error_${code}`]();',
      ['message:error_*:call dynamic'],
    ],
    ['concatenation', `m["a_" + x + "_b"]();`, ['message:a_*_b:call dynamic']],
    [
      'text joined with a number',
      `m["step_" + index + 1]();`,
      ['message:step_*1:call dynamic'],
    ],
    [
      'an unknown sum in a template may be a number: its operands are not joined',
      'm[`step_${index + 1}`]();',
      ['message:step_*:call dynamic'],
    ],
    ['an unknown sum', `m[index + 1]();`, ['message:*:call dynamic']],
    [
      'a sum of known numbers is added',
      `m["step_" + (1 + 2)]();`,
      ['message:step_3:call'],
    ],
    [
      'a sum of a known const',
      'const first = 1; m[`step_${first + 1}`]();',
      ['message:step_2:call'],
    ],
    [
      'a known const key',
      `const k = "greeting"; m[k]();`,
      ['message:greeting:call'],
    ],
    [
      'a known template',
      "const k = `gre${'eting'}`; m[k]();",
      ['message:greeting:call'],
    ],
    [
      'two static alternatives are two usages',
      `m[cond ? "a" : "b"]();`,
      ['message:a:call', 'message:b:call'],
    ],
    [
      'a let that may hold either',
      `let k = "a"; if (x) k = "b"; m[k]();`,
      ['message:a:call', 'message:b:call'],
    ],
    [
      'a method on a dynamic member',
      `m[key].parts();`,
      ['message:*:method dynamic'],
    ],
    [
      'an alias of a dynamic member',
      `const fn = m[key]; fn();`,
      ['message:*:call dynamic'],
    ],
    ['a reference', `items.map((k) => m[k]);`, ['message:*:reference dynamic']],
    [
      'usages in the key are recorded too',
      `m[getLocale()]();`,
      ['message:*:call dynamic'],
    ],
    ['an untracked object', `obj[key]();`, []],
    [
      'a key a function passes to itself is the key it is called with',
      `function walk(key, d) { m[key](); if (d) { walk(key, d - 1); walk(key, d - 1); } } walk("a", 3);`,
      ['message:a:call'],
    ],
    [
      'keys that functions pass to each other',
      `function a(k) { m[k](); b(k); } function b(k) { a(k); } a("x"); b("y");`,
      ['message:y:call', 'message:x:call'],
    ],
    [
      'a key a function changes before passing it to itself may be any text',
      `function walk(key) { m[key](); walk(key + "_"); } walk("a");`,
      ['message:*:call dynamic', 'message:a:call'],
    ],
    [
      'a variable assigned from itself',
      `let k = "a"; if (x) k = k + "b"; m[k]();`,
      ['message:a:call', 'message:*:call dynamic'],
    ],
    [
      'a variable assigned only from itself',
      `let k; k = k; m[k]();`,
      ['message:*:call dynamic'],
    ],
  ])('%s', async (_name, code, expected) => {
    expect(await usages(code)).toEqual(expected);
  });

  test('the position is the whole access', async () => {
    const code = imports + 'm[`error_${code}`]();';
    const [usage] = await analyzeProject({ [ENTRY]: code });
    expect(usage).toMatchObject({
      name: 'error_*',
      dynamic: true,
      line: 3,
      column: 1,
    });
    expect(code.slice(usage!.start, usage!.end)).toBe('m[`error_${code}`]()');
  });
});
