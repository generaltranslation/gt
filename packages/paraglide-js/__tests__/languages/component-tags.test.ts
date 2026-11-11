// A component that is a target: each of its tags is one usage, from the tag's
// name to the end of its opening tag.
import { describe, expect, test } from 'vitest';
import { astroLanguage } from '../../lib/compiler/languages/astro.js';
import { svelteLanguage } from '../../lib/compiler/languages/svelte.js';
import { vueLanguage } from '../../lib/compiler/languages/vue.js';
import type { SourceLanguage } from '../../lib/compiler/languages/language.js';
import {
  defaultTargets,
  defineTarget,
} from '../../lib/compiler/paraglide/targets.js';
import { analyzeProject, REPO_PACKAGES } from '../helpers/project.js';

const card = defineTarget({
  name: 'ui',
  matches: ({ file }) => /\/src\/Card\.(astro|vue|svelte)$/.test(file),
  exportSymbol: (name) =>
    name === 'default' ? { type: 'value', name: 'Card' } : undefined,
});
const components = {
  '/app/src/Card.vue': '<template><slot /></template>\n',
  '/app/src/Card.svelte': '<slot />\n',
  '/app/src/Card.astro': '<slot />\n',
};

const vueScript = `<script setup>\nimport Card from "./Card.vue";\n</script>\n`;
const svelteScript = `<script>\n  import Card from "./Card.svelte";\n</script>\n`;

/** e.g. `4:3 <Card title="t">` */
async function tags(file: string, code: string): Promise<string[]> {
  const usages = await analyzeProject(
    { [file]: code, ...components },
    { entry: file, targets: [...defaultTargets, card] }
  );
  return usages.map(
    ({ line, column, expression }) => `${line}:${column} ${expression}`
  );
}

describe('a component tag is one usage, not one per tag', () => {
  test('Vue', async () => {
    expect(
      await tags(
        '/app/src/Page.vue',
        `${vueScript}<template>\n  <Card>x</Card>\n  <card title="t">x</card>\n  <Card />\n</template>\n`
      )
    ).toEqual(['5:3 <Card>', '6:3 <card title="t">', '7:3 <Card />']);
  });

  test('Svelte', async () => {
    expect(
      await tags(
        '/app/src/Page.svelte',
        `${svelteScript}<Card>x</Card>\n<Card title="t" />\n`
      )
    ).toEqual(['4:1 <Card>', '5:1 <Card title="t" />']);
  });
});

describe('every language reports where an opening tag ends', () => {
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
      'Vue',
      vueLanguage,
      '/app/src/Page.vue',
      `${vueScript}<template>\n  <Card :a="x > 1" b="c">x</Card>\n  <Card />\n</template>\n`,
    ],
    [
      'Svelte',
      svelteLanguage,
      '/app/src/Page.svelte',
      `${svelteScript}<Card a={x > 1} b="c">x</Card>\n<Card />\n`,
    ],
    [
      'Astro',
      astroLanguage,
      '/app/src/Page.astro',
      `---\nimport Card from "./Card.astro";\n---\n<Card a={x > 1} b="c">x</Card>\n<Card />\n`,
    ],
  ])('%s', async (_name, language, file, code) => {
    expect(await openingTags(language, file, code)).toEqual([
      expect.stringMatching(/^<Card .*b="c">$/),
      '<Card />',
    ]);
  });
});
