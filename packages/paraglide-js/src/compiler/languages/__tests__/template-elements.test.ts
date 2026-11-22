// Which element and attribute a template usage is reported in.
import { describe, expect, test } from 'vitest';
import {
  ADAPTER_FILES,
  ADAPTER_TARGETS,
  analyzeProject,
  elementLabel,
} from '../helpers/project.js';

/** e.g. `void_child 5 <Link>` */
async function usages(file: string, code: string): Promise<string[]> {
  const found = await analyzeProject(
    { [file]: code, ...ADAPTER_FILES },
    { entry: file, targets: ADAPTER_TARGETS }
  );
  return found.map(
    (usage) => `${usage.name} ${usage.line}${elementLabel(usage)}`
  );
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

describe('Vue directives', () => {
  test('v-pre content is not analyzed', async () => {
    expect(
      await usages(
        '/app/src/Page.vue',
        `${script(' setup')}<template>\n  <p v-pre :title="m.pre_attr()">{{ m.pre_text() }}<b>{{ m.nested() }}</b></p>\n  <p>{{ m.after() }}</p>\n</template>\n`
      )
    ).toEqual(['after 6 <p>']);
  });

  test('v-if, v-else-if, v-for and v-show values are attributes', async () => {
    expect(
      await usages(
        '/app/src/Page.vue',
        `${script(' setup')}<template>\n  <p v-if="m.dir_if() !== ''">a</p>\n  <p v-else-if="m.dir_else_if() !== ''">b</p>\n  <li v-for="label in [m.dir_for()]">{{ label }}</li>\n  <p v-show="m.dir_show() !== ''">c</p>\n</template>\n`
      )
    ).toEqual([
      'dir_if 5 <p v-if>',
      'dir_else_if 6 <p v-else-if>',
      'dir_for 7 <li v-for>',
      'dir_show 8 <p v-show>',
    ]);
  });
});

describe('attribute-position braces are attributes', () => {
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
