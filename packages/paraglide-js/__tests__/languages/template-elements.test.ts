// Usages in markup that framework parsers read in unusual ways.
import { describe, expect, test } from 'vitest';
import { analyzeProject } from '../helpers/project.js';

/** e.g. `void_child 5` */
async function usages(file: string, code: string): Promise<string[]> {
  const found = await analyzeProject({ [file]: code }, { entry: file });
  return found.map((usage) => `${usage.name} ${usage.line}`);
}

const script = (lang = '') =>
  `<script${lang}>\nimport { m } from "./paraglide/messages.js";\n</script>\n`;

describe('components named like void elements have children', () => {
  test('Vue: v-for on <Link> scopes its children', async () => {
    expect(
      await usages(
        '/app/src/Page.vue',
        `${script(' setup')}<template>\n  <nav><Link v-for="m in links">{{ m.label }}</Link></nav>\n  <Input>{{ m.inside() }}</Input>\n</template>\n`
      )
    ).toEqual(['inside 6']);
  });

  test('Svelte and Astro', async () => {
    expect(
      await usages(
        '/app/src/Page.svelte',
        `${script()}<form><Input>{m.void_child()}</Input></form>\n`
      )
    ).toEqual(['void_child 4']);
    expect(
      await usages(
        '/app/src/Page.astro',
        `---\nimport { m } from "./paraglide/messages.js";\n---\n<nav><Link href="/">{m.void_child()}</Link><br>{m.after()}</nav>\n`
      )
    ).toEqual(['void_child 4', 'after 4']);
  });
});

describe('Vue directives', () => {
  test('v-pre content is not analyzed', async () => {
    expect(
      await usages(
        '/app/src/Page.vue',
        `${script(' setup')}<template>\n  <p v-pre :title="m.pre_attr()">{{ m.pre_text() }}<b>{{ m.nested() }}</b></p>\n  <p>{{ m.after() }}</p>\n</template>\n`
      )
    ).toEqual(['after 6']);
  });

  test('v-if, v-else-if, v-for and v-show values are analyzed', async () => {
    expect(
      await usages(
        '/app/src/Page.vue',
        `${script(' setup')}<template>\n  <p v-if="m.dir_if() !== ''">a</p>\n  <p v-else-if="m.dir_else_if() !== ''">b</p>\n  <li v-for="label in [m.dir_for()]">{{ label }}</li>\n  <p v-show="m.dir_show() !== ''">c</p>\n</template>\n`
      )
    ).toEqual(['dir_if 5', 'dir_else_if 6', 'dir_for 7', 'dir_show 8']);
  });
});

describe('attribute-position braces are analyzed', () => {
  test('Svelte shorthand, spread and {@attach}', async () => {
    expect(
      await usages(
        '/app/src/Page.svelte',
        `<script>\nimport { m } from "./paraglide/messages.js";\nconst message = m.tos;\n</script>\n<Message {message} />\n<button {...{ title: m.spread_title() }}>x</button>\n<p {@attach tip(m.attach_text())}>x</p>\n`
      )
    ).toEqual(['tos 5', 'spread_title 6', 'attach_text 7']);
  });

  test('Astro shorthand and spread, JSX spread', async () => {
    expect(
      await usages(
        '/app/src/Page.astro',
        `---\nimport { m } from "./paraglide/messages.js";\nconst { greeting: title } = m;\n---\n<p {title} {...{ alt: m.spread_alt() }}>x</p>\n`
      )
    ).toEqual(['greeting 5', 'spread_alt 5']);
    expect(
      await usages(
        '/app/src/Page.tsx',
        `import { m } from "./paraglide/messages.js";\nexport const Page = () => <div {...{ title: m.spread_title() }} />;\n`
      )
    ).toEqual(['spread_title 2']);
  });
});
