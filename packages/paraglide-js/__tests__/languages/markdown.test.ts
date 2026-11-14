import { describe, expect, test } from 'vitest';
import { defaultLanguages } from '../../src/compiler/languages/index.js';
import { markdownLanguage } from '../../src/compiler/languages/markdown.js';
import { analyzeProject, describeUsages } from '../helpers/project.js';

const file = '/app/src/docs/guide.md';

async function analyze(lines: string[]) {
  return analyzeProject(
    { [file]: lines.join('\n') },
    {
      entry: file,
      languages: [...defaultLanguages, markdownLanguage],
    }
  );
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
      'message:title:call 13',
      'message:tos:reference 19',
    ]);
    expect(usages[2]).toMatchObject({
      line: 13,
      column: 14,
      targetFile: '/app/src/paraglide/messages.js',
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

  test('math, snippet imports, and inline code inside tags and interpolations', async () => {
    const usages = await analyze([
      `<script setup>`,
      `import { m } from "../paraglide/messages.js";`,
      `</script>`,
      ``,
      `$$ {{ m.in_math() }} $$`,
      ``,
      `<<< @/snippets/{{ m.in_snippet() }}`,
      ``,
      'A <span :title="`${m.tick()}`">`{{ m.code_in_tag() }}`</span> {{ `${m.in_interpolation()}` }}',
      ``,
      `{{ m.multi(`,
      `  1`,
      `) }}`,
      ``,
      `<Comp><template #row="{ m }">{{ m.slot }}</template></Comp>`,
    ]);
    expect(describeUsages(usages)).toEqual([
      'message:tick:call 9',
      'message:in_interpolation:call 9',
      'message:multi:call 11',
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

  test('an expression that does not parse is skipped, not the file', async () => {
    const usages = await analyze([
      `<script setup>`,
      `import { m } from "../paraglide/messages.js";`,
      `</script>`,
      ``,
      `<p :title="m.broken(">{{ m.ok() }}</p>`,
    ]);
    expect(describeUsages(usages)).toEqual(['message:ok:call 5']);
  });
});
