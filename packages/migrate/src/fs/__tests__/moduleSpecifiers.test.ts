import { describe, expect, it } from 'vitest';
import {
  MODULE_SPECIFIER_PREFIX_SOURCE,
  moduleSpecifierMatches,
} from '../moduleSpecifiers.js';

describe('moduleSpecifierMatches', () => {
  it('sees every import form with conventional spacing', () => {
    const code = [
      "import { a } from './a';",
      "export { b } from './b';",
      "const c = await import('./c');",
      "import './side-effect';",
      "const d = require('./d');",
    ].join('\n');
    expect(moduleSpecifierMatches(code)).toEqual(
      expect.arrayContaining(['./a', './b', './c', './side-effect', './d'])
    );
  });

  it('sees the whitespace-free forms (round-10 A2: the delete guard missed them)', () => {
    const code = [
      "import { a } from'./a';",
      "export * from'./b';",
      "const c = await import('./c');",
      "import'./side-effect';",
      "const d = require('./d');",
    ].join('\n');
    expect(moduleSpecifierMatches(code)).toEqual(
      expect.arrayContaining(['./a', './b', './c', './side-effect', './d'])
    );
  });

  it('does not invent specifiers from unrelated text', () => {
    const code = [
      'const from = { key: "value" };',
      'const importx = "./nope";',
      '// object spread below, not an import',
      "const x = { from: './also-nope' };",
    ].join('\n');
    expect(moduleSpecifierMatches(code)).toEqual([]);
  });

  it('prefix source matches library usage in every form', () => {
    const pattern = new RegExp(
      MODULE_SPECIFIER_PREFIX_SOURCE + String.raw`['"]next-intl(?:\/|['"])`
    );
    for (const usage of [
      "import { useTranslations } from 'next-intl';",
      "import { useTranslations } from'next-intl';",
      "import 'next-intl';",
      "const m = await import('next-intl/server');",
      "const m = require('next-intl');",
    ]) {
      expect(pattern.test(usage), usage).toBe(true);
    }
    expect(pattern.test("import { x } from 'next-intl-extras';")).toBe(false);
  });
});
