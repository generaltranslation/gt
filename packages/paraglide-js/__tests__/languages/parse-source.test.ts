import { expect, test } from 'vitest';
import { defaultLanguages } from '../../src/compiler/languages/index.js';
import {
  generateSource,
  parseSource,
  parseSourceSync,
  type ParseFunction,
} from '../../src/compiler/languages/language.js';
import { parseCode } from '../../src/compiler/utils/parse.js';
import { REPO_PACKAGES } from '../helpers/project.js';

const parse: ParseFunction = (file, code, lang) =>
  parseCode(file, code, { lang, range: true, astType: 'ts' }) as never;

const VUE = `<script setup>\nimport { m } from "./paraglide/messages.js";\n</script>\n<template><p>{{ m.greeting() }}</p></template>\n`;

test.each([
  ['/app/src/Card.vue', VUE],
  ['/app/src/main.ts', 'export const a = 1;\n'],
])(
  'parses %s as parseSource does, with what its language generated before',
  async (file, code) => {
    const generated = await generateSource(
      file,
      code,
      defaultLanguages,
      REPO_PACKAGES
    );
    if (generated && 'error' in generated) throw new Error(generated.error);

    const parsed = await parseSource(
      file,
      code,
      parse,
      defaultLanguages,
      REPO_PACKAGES
    );
    const again = parseSourceSync(file, code, parse, generated);

    expect(again).toEqual(parsed);
    expect(generated?.language).toBe(file.endsWith('.vue') ? 'vue' : undefined);
  }
);
