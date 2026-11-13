import { parseSync } from 'oxc-parser';
import { describe, expect, test } from 'vitest';
import { astroLanguage } from '../../src/compiler/languages/astro.js';
import {
  NO_PACKAGES,
  parseSource,
  type LanguageContext,
  type ParseFunction,
} from '../../src/compiler/languages/language.js';
import { sourceSnippet } from '../../src/compiler/output/source-code.js';
import { svelteLanguage } from '../../src/compiler/languages/svelte.js';
import { vueLanguage } from '../../src/compiler/languages/vue.js';
import {
  ADAPTER_FILES,
  ADAPTER_TARGETS,
  analyzeProject,
  describeUsages,
  REPO_PACKAGES,
} from '../helpers/project.js';

async function analyze(file: string, code: string) {
  return analyzeProject(
    { [file]: code, ...ADAPTER_FILES },
    { entry: file, targets: ADAPTER_TARGETS }
  );
}

describe('Vue', () => {
  const file = '/app/src/components/Cart.vue';

  test('template interpolations, directives and both scripts', async () => {
    const usages = await analyze(
      file,
      [
        `<template>`,
        `  <h1 :title="m.title()">{{ m.greeting({ name }) }}</h1>`,
        `  <p v-if="show">{{ count > 1 ? m.items({ count }) : m.item() }}</p>`,
        `  <button @click="setLocale('de'); track()">{{ "{{" }}</button>`,
        `  <input v-model="name" :placeholder='m.name_placeholder()' />`,
        `  <paraglide-message :message="m.tos" />`,
        `  <ParaglideMessage v-bind:message="m.tos"></ParaglideMessage>`,
        `</template>`,
        ``,
        `<script lang="ts">`,
        `export default { name: "Cart" };`,
        `</script>`,
        ``,
        `<script setup lang="ts">`,
        `import { ref } from "vue";`,
        `import { ParaglideMessage } from "paraglide-adapter";`,
        `import { m } from "../paraglide/messages.js";`,
        `import { setLocale } from "../paraglide/runtime.js";`,
        `const name = ref<string>("");`,
        `const label = m.cart_label();`,
        `</script>`,
        ``,
        `<style scoped>`,
        `h1 { color: red; }`,
        `</style>`,
      ].join('\n')
    );
    expect(describeUsages(usages)).toEqual([
      'message:title:call 2 <h1 :title>',
      'message:greeting:call 2 <h1>',
      'message:items:call 3 <p>',
      'message:item:call 3 <p>',
      'runtime:setLocale:call 4 <button @click>',
      'message:name_placeholder:call 5 <input :placeholder>',
      'adapter:ParaglideMessage:component 6',
      'message:tos:reference 6 <paraglide-message :message>',
      'adapter:ParaglideMessage:component 7',
      'message:tos:reference 7 <ParaglideMessage v-bind:message>',
      'message:cart_label:call 20',
    ]);
    expect(usages[0]).toMatchObject({
      expression: 'm.title()',
      column: 15,
      scope: 'Cart',
      resolution: ['src/paraglide/messages.js'],
    });
    expect(usages[6]).toMatchObject({
      expression: `<paraglide-message :message="m.tos" />`,
      column: 3,
    });
  });

  test('v-for aliases and slot props shadow imports in their element', async () => {
    const usages = await analyze(
      file,
      [
        `<script setup>`,
        `import { m } from "../paraglide/messages.js";`,
        `</script>`,
        `<template>`,
        `  <ul>`,
        `    <li v-for="(m, index) in lists" :key="m.id">{{ m.label }}</li>`,
        `    <li v-for="item of items">{{ m.row({ item }) }}</li>`,
        `  </ul>`,
        `  <List><template #row="{ m }">{{ m.label }}</template></List>`,
        `  <p>{{ m.footer() }}</p>`,
        `</template>`,
      ].join('\n')
    );
    expect(describeUsages(usages)).toEqual([
      'message:row:call 7 <li>',
      'message:footer:call 10 <p>',
    ]);
  });

  test('an expression that does not parse is skipped, not the file', async () => {
    const usages = await analyze(
      file,
      [
        `<script setup>`,
        `import { m } from "../paraglide/messages.js";`,
        `</script>`,
        `<template>`,
        `  <p :title="m.broken(">{{ m.ok() }}</p>`,
        `</template>`,
      ].join('\n')
    );
    expect(describeUsages(usages)).toEqual(['message:ok:call 5 <p>']);
  });
});

describe('Svelte', () => {
  const file = '/app/src/routes/+page.svelte';

  test('tags, attributes, blocks and directives', async () => {
    const usages = await analyze(
      file,
      [
        `<script lang="ts">`,
        `  import { m } from "../paraglide/messages.js";`,
        `  import { setLocale } from "../paraglide/runtime.js";`,
        `  import { ParaglideMessage } from "paraglide-adapter";`,
        `  let { items }: { items: string[] } = $props();`,
        `  const title = $derived(m.title());`,
        `</script>`,
        ``,
        `<svelte:head><title>{m.page_title()}</title></svelte:head>`,
        `<h1 class:big={true} title="Hi {m.greeting()}!">{m.heading()}</h1>`,
        `{#if items.length === 0}`,
        `  <p>{m.empty()}</p>`,
        `{:else if items.length > 9}`,
        `  {@html m.many()}`,
        `{:else}`,
        `  {#each items as m, i (m)}<li>{m.label}</li>{:else}{m.none()}{/each}`,
        `{/if}`,
        `<button onclick={() => setLocale("de")}>DE</button>`,
        `<ParaglideMessage message={m.tos} />`,
        `{@const t = m}`,
        `<p>{t.short()}</p>`,
        `{#snippet row(m)}{m.label}{/snippet}`,
        `{#await load() then m}{m.label}{:catch error}{m.failed()}{/await}`,
        `<style>p { color: red }</style>`,
      ].join('\n')
    );
    expect(describeUsages(usages)).toEqual([
      'message:title:call 6',
      'message:page_title:call 9 <title>',
      'message:greeting:call 10 <h1 title>',
      'message:heading:call 10 <h1>',
      'message:empty:call 12 <p>',
      'message:many:call 14',
      'message:none:call 16',
      'runtime:setLocale:call 18 <button onclick>',
      'adapter:ParaglideMessage:component 19',
      'message:tos:reference 19 <ParaglideMessage message>',
      'message:short:call 21 <p>',
      'message:failed:call 23',
    ]);
    expect(usages[1]).toMatchObject({ scope: '+page', column: 22 });
  });

  test('Svelte 4 let: directives shadow imports in their element', async () => {
    const usages = await analyze(
      file,
      [
        `<script>`,
        `  import { m } from "../paraglide/messages.js";`,
        `</script>`,
        `<List let:m>{m.label}</List>`,
        `<List let:item={m}><p>{m.label}</p></List>`,
        `<List let:row={{ m, index }}>{m.label}{index}</List>`,
        `<List let:item>{m.inside({ item })}</List>`,
        `<List let:m />`,
        `<p>{m.after()}</p>`,
      ].join('\n')
    );
    expect(describeUsages(usages)).toEqual([
      'message:inside:call 7 <List>',
      'message:after:call 9 <p>',
    ]);
  });

  test('an expression that does not parse loses only itself', async () => {
    const usages = await analyze(
      file,
      [
        `<script>`,
        `  import { m } from "../paraglide/messages.js";`,
        `</script>`,
        `<p title={m.broken(1 +)}>{m.after_attribute()}</p>`,
        `{#if m.block()}<p>{m.broken_too(:)}</p>{/if}`,
        `<p>{m.last()}</p>`,
      ].join('\n')
    );
    expect(describeUsages(usages)).toEqual([
      'message:after_attribute:call 4 <p>',
      'message:block:call 5',
      'message:last:call 6 <p>',
    ]);
  });

  test('exports of <script module> are followed', async () => {
    const usages = await analyzeProject(
      {
        '/app/src/App.tsx': `import { t } from "./i18n.svelte"; t.greeting();`,
        '/app/src/i18n.svelte': [
          `<script module>`,
          `  import { m } from "./paraglide/messages.js";`,
          `  export const t = m;`,
          `</script>`,
        ].join('\n'),
      },
      {}
    );
    expect(usages[0]).toMatchObject({
      name: 'greeting',
      resolution: ['src/i18n.svelte', 'src/paraglide/messages.js'],
    });
  });
});

describe('without the language tools, or with a file they reject', () => {
  const parse: ParseFunction = (file, code, lang) =>
    parseSync(file, code, { lang }) as never;
  const vue = `<script setup>\nconst = ;\n</script>\n<template><p /></template>`;
  const svelte = `<script>\nconst = ;\n</script>\n<p></p>`;

  test('skipped, naming the packages to install', async () => {
    expect(
      await parseSource('/app/A.vue', vue, parse, [vueLanguage], NO_PACKAGES)
    ).toMatchObject({
      missing: ['@vue/language-core', 'typescript'],
    });
    expect(
      await parseSource(
        '/app/A.svelte',
        svelte,
        parse,
        [svelteLanguage],
        NO_PACKAGES
      )
    ).toMatchObject({ missing: ['svelte2tsx', 'svelte'] });
  });

  test('a script with a syntax error is skipped with the error', async () => {
    for (const [file, code, language] of [
      ['/app/A.vue', vue, vueLanguage],
      ['/app/A.svelte', svelte, svelteLanguage],
    ] as const) {
      const result = await parseSource(
        file,
        code,
        parse,
        [language],
        REPO_PACKAGES
      );
      expect(result).toMatchObject({ error: expect.any(String) });
      expect(result).not.toHaveProperty('missing');
    }
  });
});

describe('Astro', () => {
  const file = '/app/src/pages/index.astro';

  test('frontmatter, expressions, markup in expressions and client scripts', async () => {
    const usages = await analyze(
      file,
      [
        `---`,
        `import { m } from "../paraglide/messages.js";`,
        `import { ParaglideMessage } from "paraglide-adapter";`,
        `if (!Astro.locals.user) return Astro.redirect("/login");`,
        `const items = [m.first(), m.second()];`,
        `---`,
        `<!doctype html>`,
        `<html>`,
        `<head><meta charset="utf-8"><title>{m.title()}</title></head>`,
        `<body>`,
        `  <!-- {m.commented()} -->`,
        `  <p>Don't {m.greeting()}<br></p>`,
        `  <ul>{items.map((item) => <li title={m.tip({ item })}>{item}{m.suffix()}</li>)}</ul>`,
        `  {list.map((m) => <span>{m.label}</span>)}`,
        `  <a {...props} title=\`\${m.link()}\`>x</a>`,
        `  <ParaglideMessage message={m.tos} />`,
        `  <style>p { color: red; }</style>`,
        `  <script>`,
        `    import { setLocale } from "../paraglide/runtime.js";`,
        `    setLocale("de");`,
        `  </script>`,
        `</body>`,
        `</html>`,
      ].join('\n')
    );
    expect(describeUsages(usages)).toEqual([
      'message:first:call 5',
      'message:second:call 5',
      'message:title:call 9 <title>',
      'message:greeting:call 12 <p>',
      'message:tip:call 13 <li title>',
      'message:suffix:call 13 <li>',
      'message:link:call 15 <a title>',
      // A component tag is in its parent element.
      'adapter:ParaglideMessage:component 16 <body>',
      'message:tos:reference 16 <ParaglideMessage message>',
      'runtime:setLocale:call 20 <script>',
    ]);
    expect(usages[4]).toMatchObject({
      expression: 'm.tip({ item })',
      scope: 'index',
    });
  });

  test('positions after non-ASCII text, in the markup and in a client script', async () => {
    const usages = await analyze(
      file,
      [
        `---`,
        `import { m } from "../paraglide/messages.js";`,
        `const 名前 = "ß";`,
        `---`,
        `<p>Grüße 👋 {m.greeting()} <b title={m.bold()}>ö</b></p>`,
        `<script>`,
        `  import { m } from "../paraglide/messages.js";`,
        `  console.log("ü", m.client());`,
        `</script>`,
      ].join('\n')
    );
    expect(
      usages.map(
        ({ expression, line, column }) => `${expression} ${line}:${column}`
      )
    ).toEqual([
      // 👋 is two UTF-16 units.
      'm.greeting() 5:14',
      'm.bold() 5:38',
      'm.client() 8:20',
    ]);
  });

  test("a client script is a module of its own: its names are not the frontmatter's or another script's", async () => {
    const UI_OUTDIR = '/app/packages/ui/paraglide';
    const page = [
      `---`,
      `import { m } from "../paraglide/messages.js";`,
      `const label = m.server;`,
      `---`,
      `<p>{label()}</p>`,
      `<script>`,
      `  import { m } from "../../packages/ui/paraglide/messages.js";`,
      `  const label = m.client;`,
      `  document.title = label();`,
      `</script>`,
      `<script>`,
      `  import { m } from "../paraglide/messages.js";`,
      `  import { show } from "../show.js";`,
      `  const label = m.other;`,
      `  show(label, m.passed);`,
      `</script>`,
    ].join('\n');
    const files = {
      [file]: page,
      '/app/src/show.ts': `export const show = (label, message) => label() + message();\n`,
      [`${UI_OUTDIR}/messages.js`]: 'export {}',
    };
    const options = {
      outdirs: ['/app/src/paraglide', UI_OUTDIR],
      loadAll: true,
    };

    const usages = await analyzeProject(files, { ...options, entry: file });
    expect(
      usages.map(
        ({ name, kind, line, resolution }) =>
          `${name}:${kind} ${line} ${resolution.at(-1)}`
      )
    ).toEqual([
      'server:call 5 src/paraglide/messages.js',
      'client:call 9 packages/ui/paraglide/messages.js',
      'other:reference 15 src/paraglide/messages.js',
      'passed:reference 15 src/paraglide/messages.js',
    ]);

    // What a script passes to another module's function is followed, as from any module.
    const helper = await analyzeProject(files, {
      ...options,
      entry: '/app/src/show.ts',
    });
    expect(
      helper.map(
        ({ name, kind, resolution }) => `${name}:${kind} ${resolution[0]}`
      )
    ).toEqual([
      'other:call src/pages/index.astro',
      'passed:call src/pages/index.astro',
    ]);
  });

  test('an unclosed bracket loses only its own expression', async () => {
    const usages = await analyze(
      file,
      [
        `---`,
        `import { m } from "../paraglide/messages.js";`,
        `---`,
        `<p title={m.broken(}>{m.after_a()}</p>`,
        `<p>{m.after_b()}</p>`,
      ].join('\n')
    );
    expect(describeUsages(usages)).toEqual([
      'message:after_a:call 4 <p>',
      'message:after_b:call 5 <p>',
    ]);
  });

  test('without @astrojs/astro2tsx, @astrojs/compiler reads the same usages', async () => {
    const page = [
      `---`,
      `import { m } from "../paraglide/messages.js";`,
      `---`,
      `<h1 title={m.title()}>{m.greeting()}</h1>`,
      `<Card message={m.tos} />`,
      `<script>import { m } from "../paraglide/messages.js"; console.log(m.client());</script>`,
    ].join('\n');
    const withoutAstro2Tsx: LanguageContext = {
      load: (name) =>
        name === '@astrojs/astro2tsx'
          ? Promise.resolve(undefined)
          : REPO_PACKAGES.load(name),
    };
    const usages = await analyzeProject(
      { [file]: page },
      { entry: file, context: withoutAstro2Tsx }
    );
    expect(describeUsages(usages)).toEqual([
      'message:title:call 4 <h1 title>',
      'message:greeting:call 4 <h1>',
      'message:tos:reference 5 <Card message>',
      'message:client:call 6 <script>',
    ]);
    expect(usages).toEqual(await analyze(file, page));
  });

  test("without Astro's TSX tools in the project, files are skipped and astro2tsx is named", async () => {
    const parse: ParseFunction = (name, code, lang) =>
      parseSync(name, code, { lang }) as never;
    const result = await parseSource(
      file,
      `<p>{m.x()}</p>`,
      parse,
      [astroLanguage],
      NO_PACKAGES
    );
    expect(result).toMatchObject({ missing: ['@astrojs/astro2tsx'] });
  });
});

test('template usages report their element and the lines of the file', async () => {
  const code = `<script setup>\nimport { m } from "./paraglide/messages.js";\n</script>\n<template><p :title="m.a()" /></template>`;
  const usages = await analyze('/app/src/A.vue', code);
  expect(usages).toMatchObject([
    {
      line: 4,
      column: 22,
      scope: 'A',
      element: { element: 'p', attribute: ':title' },
    },
  ]);
  expect(sourceSnippet(code.split('\n'), usages[0]!, 1)).toEqual({
    before: '</script>',
    target: '<template><p :title="m.a()" /></template>',
    after: '',
  });
});
