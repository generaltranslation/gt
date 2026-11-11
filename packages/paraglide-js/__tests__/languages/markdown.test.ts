import { describe, expect, test } from 'vitest';
import { defaultLanguages } from '../../lib/compiler/languages/index.js';
import {
  NO_PACKAGES,
  parseSource,
  type ParseFunction,
} from '../../lib/compiler/languages/language.js';
import { parseSync } from 'oxc-parser';
import { markdownLanguage } from '../../lib/compiler/languages/markdown.js';
import {
  defaultTargets,
  packageTarget,
} from '../../lib/compiler/paraglide/targets.js';
import { analyzeProject, summarize } from '../helpers/project.js';

const targets = [
  ...defaultTargets,
  packageTarget('adapter', 'paraglide-adapter'),
];
const adapter = { '/app/node_modules/paraglide-adapter/index.js': 'export {}' };
const file = '/app/src/docs/guide.md';
const parse: ParseFunction = (file, code, lang) =>
  parseSync(file, code, { lang }) as never;

async function analyze(lines: string[]) {
  return analyzeProject(
    { [file]: lines.join('\n'), ...adapter },
    { entry: file, targets, languages: [...defaultLanguages, markdownLanguage] }
  );
}

/** e.g. `message:greeting:call 3 <p>` */
function describeUsages(usages: Awaited<ReturnType<typeof analyze>>): string[] {
  return usages.map((usage) => {
    const element = usage.element
      ? ` <${usage.element.element}${usage.element.attribute ? ` ${usage.element.attribute}` : ''}>`
      : '';
    return `${summarize([usage])[0]} ${usage.line}${element}`;
  });
}

describe('Markdown (VitePress)', () => {
  test('script setup, interpolations, directives and components', async () => {
    const usages = await analyze([
      `---`,
      `title: "{{ not an expression }}"`,
      `---`,
      `<script setup lang="ts">`,
      `import { m } from "../paraglide/messages.js";`,
      `import { ParaglideMessage } from "paraglide-adapter";`,
      `import { setLocale } from "../paraglide/runtime.js";`,
      'const label = `${m.label()}`;',
      `</script>`,
      ``,
      `# {{ m.heading() }}`,
      ``,
      `Text with {{ m.inline() }} and a <span :title="m.title()">span</span>.`,
      ``,
      `<button @click="setLocale('de')">DE</button>`,
      ``,
      `<ul><li v-for="m in items">{{ m.label }}</li></ul>`,
      ``,
      `<paraglide-message :message="m.tos" />`,
      ``,
      `<style>`,
      `p { content: "{{ m.style() }}" }`,
      `</style>`,
    ]);
    expect(describeUsages(usages)).toEqual([
      'message:label:call 8',
      'message:heading:call 11',
      'message:inline:call 13',
      'message:title:call 13 <span :title>',
      'runtime:setLocale:call 15 <button @click>',
      'adapter:ParaglideMessage:component 19',
      'message:tos:reference 19 <paraglide-message :message>',
    ]);
    expect(usages[2]).toMatchObject({
      expression: 'm.inline()',
      line: 13,
      column: 14,
      scope: 'guide',
      resolution: ['src/paraglide/messages.js'],
    });
  });

  test('code, inline code and v-pre elements are not interpolated', async () => {
    const usages = await analyze([
      `<script setup>`,
      `import { m } from "../paraglide/messages.js";`,
      `</script>`,
      ``,
      '```vue',
      `<template>{{ m.in_fence() }}</template>`,
      '```',
      ``,
      'Inline `{{ m.in_code() }}` code.',
      ``,
      `::: v-pre`,
      `{{ m.in_container() }}`,
      `:::`,
      ``,
      `<div v-pre>{{ m.in_v_pre() }}<p>{{ m.nested() }}</p></div>`,
      ``,
      `{{ m.after() }}`,
    ]);
    // `@vue/language-core` does not know VitePress's `::: v-pre` container.
    expect(describeUsages(usages)).toEqual([
      'message:in_container:call 12',
      'message:after:call 17',
    ]);
  });

  test('a README without Vue is an empty module', async () => {
    const usages = await analyze([
      `# Project`,
      ``,
      `Some <b>HTML</b>, a <https://example.com> link, and code:`,
      ``,
      '```js',
      `const x = { a: 1 }; // {{ not vue }}`,
      '```',
    ]);
    expect(usages).toEqual([]);
  });

  test('skipped, naming the packages, without @vue/language-core', async () => {
    const result = await parseSource(
      file,
      '# Title\n',
      parse,
      [markdownLanguage],
      NO_PACKAGES
    );
    expect(result).toMatchObject({
      missing: ['@vue/language-core', 'typescript'],
    });
  });

  test('an expression that does not parse is skipped, not the file', async () => {
    const usages = await analyze([
      `<script setup>`,
      `import { m } from "../paraglide/messages.js";`,
      `</script>`,
      ``,
      `<p :title="m.broken(">{{ m.ok() }}</p>`,
    ]);
    expect(describeUsages(usages)).toEqual(['message:ok:call 5 <p>']);
  });
});
