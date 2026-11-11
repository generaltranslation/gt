// Regressions for the third round of paraglide-tests findings (FINDINGS.md: A1, B4, B7, B8, O1).
import { parseSync } from 'oxc-parser';
import { describe, expect, test } from 'vitest';
import { astroLanguage } from '../../lib/compiler/languages/astro.js';
import { svelteLanguage } from '../../lib/compiler/languages/svelte.js';
import { vueLanguage } from '../../lib/compiler/languages/vue.js';
import {
  parseSource,
  type LanguageContext,
  type ParseFunction,
  type SourceLanguage,
} from '../../lib/compiler/languages/language.js';
import {
  defaultTargets,
  defineTarget,
} from '../../lib/compiler/paraglide/targets.js';
import {
  analyzeProject,
  REPO_PACKAGES,
  summarize,
} from '../helpers/project.js';

const ui = defineTarget({
  name: 'ui',
  matches: ({ file }) => /\/src\/(Card|Link)\.(astro|vue|svelte)$/.test(file),
  exportSymbol: (name) =>
    name === 'default' ? { type: 'value', name: 'UI' } : undefined,
});
const targets = [...defaultTargets, ui];
const components = {
  '/app/src/Card.vue': '<template><slot /></template>\n',
  '/app/src/Card.svelte': '<slot />\n',
  '/app/src/Card.astro': '<slot />\n',
};

async function usages(file: string, code: string, context?: LanguageContext) {
  const found = await analyzeProject(
    { [file]: code, ...components },
    { entry: file, targets, context }
  );
  return found.map((usage) => {
    const element = usage.element
      ? ` <${usage.element.element}${usage.element.attribute ? ` ${usage.element.attribute}` : ''}>`
      : '';
    return `${summarize([usage])[0]} ${usage.line}:${usage.column}${element} ${usage.expression}`;
  });
}

const vueScript = `<script setup>\nimport { m } from "./paraglide/messages.js";\nimport Card from "./Card.vue";\n</script>\n`;
const svelteScript = `<script>\n  import { m } from "./paraglide/messages.js";\n  import Card from "./Card.svelte";\n</script>\n`;

describe('A1: Astro 7 through @astrojs/astro2tsx', () => {
  const page = [
    `---`,
    `import { m } from "./paraglide/messages.js";`,
    `import Card from "./Card.astro";`,
    `---`,
    `<h1 title={m.title()}>{m.greeting()}</h1>`,
    `<Card message={m.tos} />`,
    `<script>import { m } from "./paraglide/messages.js"; console.log(m.client());</script>`,
    ``,
  ].join('\n');

  test('reads templates, components and bundled scripts', async () => {
    expect(await usages('/app/src/Page.astro', page)).toEqual([
      'message:title:call 5:12 <h1 title> m.title()',
      'message:greeting:call 5:24 <h1> m.greeting()',
      `ui:UI:component 6:1 <Card message={m.tos} />`,
      'message:tos:reference 6:16 <Card message> m.tos',
      'message:client:call 7:66 <script> m.client()',
    ]);
  });

  test('without astro2tsx, @astrojs/compiler is used', async () => {
    const withoutAstro2Tsx: LanguageContext = {
      load: (name) =>
        name === '@astrojs/astro2tsx'
          ? Promise.resolve(undefined)
          : REPO_PACKAGES.load(name),
    };
    expect(await usages('/app/src/Page.astro', page, withoutAstro2Tsx)).toEqual(
      await usages('/app/src/Page.astro', page)
    );
  });

  test('without either, it names @astrojs/astro2tsx', async () => {
    const parse: ParseFunction = (file, code, lang) =>
      parseSync(file, code, { lang }) as unknown as ReturnType<ParseFunction>;
    const none: LanguageContext = { load: async () => undefined };
    expect(
      await parseSource(
        '/app/src/Page.astro',
        page,
        parse,
        [astroLanguage],
        none
      )
    ).toMatchObject({
      missing: ['@astrojs/astro2tsx'],
    });
  });

  test('B4: an unclosed bracket loses only its expression', async () => {
    const broken = `---\nimport { m } from "./paraglide/messages.js";\n---\n<p title={m.broken(}>{m.after_a()}</p>\n<p>{m.after_b()}</p>\n`;
    expect(await usages('/app/src/Page.astro', broken)).toEqual([
      'message:after_a:call 4:23 <p> m.after_a()',
      'message:after_b:call 5:5 <p> m.after_b()',
    ]);
  });
});

test('B8: Vue v-if, v-else-if and v-for values are attributes', async () => {
  const page = `${vueScript}<template>\n  <p v-if="m.dir_if() !== ''">a</p>\n  <p v-else-if="m.dir_else_if() !== ''">b</p>\n  <li v-for="label in [m.dir_for()]">{{ label }}</li>\n  <p v-show="m.dir_show() !== ''">c</p>\n</template>\n`;
  expect(await usages('/app/src/Page.vue', page)).toEqual([
    'message:dir_if:call 6:12 <p v-if> m.dir_if()',
    'message:dir_else_if:call 7:17 <p v-else-if> m.dir_else_if()',
    'message:dir_for:call 8:24 <li v-for> m.dir_for()',
    'message:dir_show:call 9:14 <p v-show> m.dir_show()',
  ]);
});

describe('B7: a component tag is one usage, not one per tag', () => {
  test('Vue', async () => {
    const page = `${vueScript}<template>\n  <Card>x</Card>\n  <card title="t">x</card>\n  <Card />\n</template>\n`;
    expect(await usages('/app/src/Page.vue', page)).toEqual([
      'ui:UI:component 6:3 <Card>',
      'ui:UI:component 7:3 <card title="t">',
      'ui:UI:component 8:3 <Card />',
    ]);
  });

  test('Svelte', async () => {
    const page = `${svelteScript}<Card>x</Card>\n<Card title="t" />\n`;
    expect(await usages('/app/src/Page.svelte', page)).toEqual([
      'ui:UI:component 5:1 <Card>',
      'ui:UI:component 6:1 <Card title="t" />',
    ]);
  });
});

describe('O1: every language reports where an opening tag ends (`openEnd`)', () => {
  const openingTags = async (
    language: SourceLanguage,
    file: string,
    code: string
  ) => {
    const generated = await language.generate(code, file, REPO_PACKAGES);
    return (generated?.elements ?? [])
      .filter((element) => element.component)
      .map((element) => code.slice(element.nameStart - 1, element.openEnd));
  };

  test.each([
    [
      vueLanguage,
      '/app/src/Page.vue',
      `${vueScript}<template>\n  <Card :a="x > 1" b="c">x</Card>\n  <Card />\n</template>\n`,
    ],
    [
      svelteLanguage,
      '/app/src/Page.svelte',
      `${svelteScript}<Card a={x > 1} b="c">x</Card>\n<Card />\n`,
    ],
    [
      astroLanguage,
      '/app/src/Page.astro',
      `---\nimport Card from "./Card.astro";\n---\n<Card a={x > 1} b="c">x</Card>\n<Card />\n`,
    ],
  ])('%#', async (language, file, code) => {
    expect(await openingTags(language, file, code)).toEqual([
      expect.stringMatching(/^<Card .*b="c">$/),
      '<Card />',
    ]);
  });
});

test('B4: a Svelte expression that does not parse loses only itself', async () => {
  const page = [
    `<script>`,
    `  import { m } from "./paraglide/messages.js";`,
    `</script>`,
    ``,
    `<p title={m.never_unparsable(1 +)}>{m.after_unparsable()}</p>`,
    `{#if m.neighbor_if()}<p>{m.never_unparsable_too(:)}</p>{/if}`,
    `<p>{m.last()}</p>`,
    ``,
  ].join('\n');
  const found = await usages('/app/src/Page.svelte', page);
  expect(found.map((usage) => usage.split(' ')[0])).toEqual([
    'message:after_unparsable:call',
    'message:neighbor_if:call',
    'message:last:call',
  ]);
});
