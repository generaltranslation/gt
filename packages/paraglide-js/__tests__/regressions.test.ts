// Regressions for the findings of the paraglide-tests apps (FINDINGS.md).
import { describe, expect, test } from 'vitest';
import {
  defaultTargets,
  packageTarget,
} from '../lib/compiler/paraglide/targets.js';
import { analyzeProject } from './helpers/project.js';

const targets = [
  ...defaultTargets,
  packageTarget('adapter', 'paraglide-adapter'),
];
const adapter = {
  '/app/node_modules/.pnpm/paraglide-adapter@1.0.0_abc/node_modules/paraglide-adapter/index.js':
    'export {}',
};

/** e.g. `void_child 5 <Link>` */
async function usages(file: string, code: string): Promise<string[]> {
  const found = await analyzeProject(
    { [file]: code, ...adapter },
    { entry: file, targets }
  );
  return found.map((usage) => {
    const element = usage.element
      ? ` <${usage.element.element}${usage.element.attribute ? ` ${usage.element.attribute}` : ''}>`
      : '';
    return `${usage.name} ${usage.line}${element}`;
  });
}

const script = (lang = '') =>
  `<script${lang}>\nimport { m } from "./paraglide/messages.js";\n</script>\n`;

describe('B1: components named like void elements have children', () => {
  test('Vue: v-for on <Link> scopes its children', async () => {
    expect(
      await usages(
        '/app/src/Page.vue',
        `${script(' setup')}<template>\n  <nav><Link v-for="m in links">{{ m.label }}</Link></nav>\n  <Input>{{ m.inside() }}</Input>\n</template>\n`
      )
    ).toEqual(['inside 6 <Input>']);
  });

  test('Svelte and Astro', async () => {
    expect(
      await usages(
        '/app/src/Page.svelte',
        `${script()}<form><Input>{m.void_child()}</Input></form>\n`
      )
    ).toEqual(['void_child 4 <Input>']);
    expect(
      await usages(
        '/app/src/Page.astro',
        `---\nimport { m } from "./paraglide/messages.js";\n---\n<nav><Link href="/">{m.void_child()}</Link><br>{m.after()}</nav>\n`
      )
    ).toEqual(['void_child 4 <Link>', 'after 4 <nav>']);
  });
});

test('B2: Vue v-pre content is not analyzed', async () => {
  expect(
    await usages(
      '/app/src/Page.vue',
      `${script(' setup')}<template>\n  <p v-pre :title="m.pre_attr()">{{ m.pre_text() }}<b>{{ m.nested() }}</b></p>\n  <p>{{ m.after() }}</p>\n</template>\n`
    )
  ).toEqual(['after 6 <p>']);
});

describe('B3: attribute-position braces are attributes', () => {
  test('Svelte shorthand, spread and {@attach}', async () => {
    expect(
      await usages(
        '/app/src/Page.svelte',
        `<script>\nimport { m } from "./paraglide/messages.js";\nconst message = m.tos;\n</script>\n<Message {message} />\n<button {...{ title: m.spread_title() }}>x</button>\n<p {@attach tip(m.attach_text())}>x</p>\n`
      )
    ).toEqual([
      'tos 5 <Message message>',
      'spread_title 6 <button {...}>',
      'attach_text 7 <p {@attach}>',
    ]);
  });

  test('Astro shorthand and spread, JSX spread', async () => {
    expect(
      await usages(
        '/app/src/Page.astro',
        `---\nimport { m } from "./paraglide/messages.js";\nconst { greeting: title } = m;\n---\n<p {title} {...{ alt: m.spread_alt() }}>x</p>\n`
      )
    ).toEqual(['greeting 5 <p title>', 'spread_alt 5 <p {...}>']);
    expect(
      await usages(
        '/app/src/Page.tsx',
        `import { m } from "./paraglide/messages.js";\nexport const Page = () => <div {...{ title: m.spread_title() }} />;\n`
      )
    ).toEqual(['spread_title 2 <div {...}>']);
  });
});

test('B4: an unclosed bracket loses only its own expression', async () => {
  const template = `<p title={m.broken(}>{m.after_a()}</p>\n<p>{m.after_b()}</p>\n`;
  expect(
    await usages('/app/src/Page.svelte', `${script()}${template}`)
  ).toEqual(['after_a 4 <p>', 'after_b 5 <p>']);
});

test('B4, Astro: an unclosed bracket loses only its own expression', async () => {
  // @astrojs/astro2tsx recovers; the unparsable expression is skipped.
  const template = `<p title={m.broken(}>{m.after_a()}</p>\n<p>{m.after_b()}</p>\n`;
  expect(
    await usages(
      '/app/src/Page.astro',
      `---\nimport { m } from "./paraglide/messages.js";\n---\n${template}`
    )
  ).toEqual(['after_a 4 <p>', 'after_b 5 <p>']);
});

test("G1: dependencies are shown from node_modules on, without pnpm's store path", async () => {
  const [usage] = await analyzeProject(
    {
      '/app/src/App.tsx': `import { ParaglideMessage } from "paraglide-adapter";\nexport const A = () => <ParaglideMessage />;\n`,
      ...adapter,
    },
    {
      targets,
      // As pnpm resolves it: the real path in the store.
      aliases: {
        'paraglide-adapter':
          '/app/node_modules/.pnpm/paraglide-adapter@1.0.0_abc/node_modules/paraglide-adapter/index.js',
      },
    }
  );
  expect(usage!.resolution).toEqual([
    'node_modules/paraglide-adapter/index.js',
  ]);
});
