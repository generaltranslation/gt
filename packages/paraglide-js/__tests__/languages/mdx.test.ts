import { parseSync } from 'oxc-parser';
import { describe, expect, test } from 'vitest';
import { defaultLanguages } from '../../src/compiler/languages/index.js';
import {
  NO_PACKAGES,
  parseSource,
  type ParseFunction,
} from '../../src/compiler/languages/language.js';
import { mdxLanguage } from '../../src/compiler/languages/mdx.js';
import { analyzeProject, describeUsages } from '../helpers/project.js';

const file = '/app/src/pages/guide.mdx';

async function analyze(lines: string[]) {
  return analyzeProject(
    { [file]: lines.join('\n') },
    {
      entry: file,
      languages: [...defaultLanguages, mdxLanguage],
    }
  );
}

describe('MDX, through @mdx-js/language-service', () => {
  test('ESM, expressions, JSX attributes and component tags', async () => {
    const usages = await analyze([
      `import { m } from "../paraglide/messages.js";`,
      `import { ParaglideMessage } from "paraglide-adapter";`,
      `export const title = m.title();`,
      ``,
      `# {m.heading()}`,
      ``,
      `Some text with {m.inline()} and **bold**.`,
      ``,
      `<Note kind={m.kind()}>`,
      `  {m.inside()}`,
      `</Note>`,
      ``,
      `<ParaglideMessage message={m.tos} />`,
      ``,
      `{[1, 2].map((n) => <li title={m.item({ n })}>{n}</li>)}`,
      `{/* a comment {m.ignored()} */}`,
    ]);
    expect(describeUsages(usages)).toEqual([
      'message:title:call 3',
      'message:heading:call 5',
      'message:inline:call 7',
      'message:kind:call 9',
      'message:inside:call 10',
      'message:tos:reference 13',
      'message:item:call 15',
    ]);
    expect(usages[2]).toMatchObject({
      line: 7,
      column: 17,
      targetFile: '/app/src/paraglide/messages.js',
    });
  });

  test('code fences and inline code are not code', async () => {
    const usages = await analyze([
      `import { m } from "../paraglide/messages.js";`,
      ``,
      '```tsx',
      `<p>{m.in_fence()}</p>`,
      '```',
      ``,
      '~~~',
      `{m.in_tilde_fence()}`,
      '~~~',
      ``,
      'Use `{m.in_code()}` or ``a ` {m.double()}`` inline.',
      ``,
      `{m.after()}`,
    ]);
    expect(describeUsages(usages)).toEqual(['message:after:call 13']);
  });

  test('a multi-line export, and text that starts with `import`', async () => {
    const usages = await analyze([
      `import { m } from "../paraglide/messages.js";`,
      `export const meta = {`,
      `  title: m.meta_title(),`,
      `  description: m.meta_description(),`,
      `};`,
      ``,
      `A paragraph,`,
      `import inside it is text {m.text()}`,
    ]);
    expect(describeUsages(usages)).toEqual([
      'message:meta_title:call 3',
      'message:meta_description:call 4',
      'message:text:call 8',
    ]);
  });

  test('positions after non-ASCII text', async () => {
    const usages = await analyze([
      `import { m } from "../paraglide/messages.js";`,
      ``,
      `Grüße 👋 aus Köln: {m.greeting()} <b title={m.bold()}>ß</b>`,
    ]);
    expect(usages.map(({ name, column }) => `${name} ${column}`)).toEqual([
      // 👋 is two UTF-16 units.
      'greeting 21',
      'bold 45',
    ]);
  });

  test("a file MDX rejects is skipped, with MDX's reason", async () => {
    const rejected = (lines: string[]) =>
      expect(analyze(lines)).rejects.toThrow(/MDX|mdx/);
    // An expression that doesn't parse.
    await rejected([
      `import { m } from "../paraglide/messages.js";`,
      ``,
      `{m.broken(1 +)}`,
    ]);
    // Autolinks: MDX reads `<` as JSX.
    await rejected([`See <https://example.com>.`]);
    // A blank line ends an ESM block, leaving the export incomplete.
    await rejected([`export const meta = {`, `  a: 1,`, ``, `  b: 2,`, `};`]);
    // Front matter needs `remark-frontmatter` in the project; without it, YAML
    // braces are expressions.
    await rejected([`---`, `title: { not: "an expression" }`, `---`]);
  });

  test('without the language service in the project, files are skipped and it is named', async () => {
    const parse: ParseFunction = (name, code, lang) =>
      parseSync(name, code, { lang }) as never;
    const result = await parseSource(
      file,
      `# {m.x()}`,
      parse,
      [mdxLanguage],
      NO_PACKAGES
    );
    expect(result).toMatchObject({
      missing: ['@mdx-js/language-service', 'typescript'],
    });
  });
});
