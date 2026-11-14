import { describe, expect, test } from 'vitest';
import { defaultLanguages } from '../../src/compiler/languages/index.js';
import {
  generateSource,
  NO_PACKAGES,
} from '../../src/compiler/languages/language.js';
import { mdxLanguage } from '../../src/compiler/languages/mdx.js';
import { analyzeProject, describeUsages } from '../helpers/project.js';

const file = '/app/src/pages/guide.mdx';
const imports = `import { m } from "../paraglide/messages.js";`;

async function analyze(lines: string[]) {
  return analyzeProject(
    { [file]: lines.join('\n') },
    {
      entry: file,
      languages: [...defaultLanguages, mdxLanguage],
    }
  );
}

describe('MDX', () => {
  test('ESM, expressions, JSX attributes and component tags', async () => {
    const usages = await analyze([
      imports,
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
      imports,
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
      `- A list item`,
      ``,
      '      ```js',
      `      {m.in_list_fence()}`,
      '      ```',
      ``,
      `> {m.quoted()}`,
      '> ```',
      `> {m.in_quote_fence()}`,
      '> ```',
      ``,
      `{m.after()}`,
    ]);
    expect(describeUsages(usages)).toEqual([
      'message:quoted:call 19',
      'message:after:call 24',
    ]);
  });

  test('indented lines are not code: MDX has no indented code', async () => {
    const usages = await analyze([imports, ``, `    {m.indented()}`]);
    expect(describeUsages(usages)).toEqual(['message:indented:call 3']);
  });

  test('a multi-line export, and text that starts with `import`', async () => {
    const usages = await analyze([
      imports,
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

  test('an export that a blank line splits goes on, as MDX compiles it', async () => {
    const usages = await analyze([
      imports,
      `export const meta = {`,
      `  title: m.meta_title(),`,
      ``,
      `  description: m.meta_description(),`,
      `};`,
      ``,
      `{meta.title}`,
    ]);
    expect(describeUsages(usages)).toEqual([
      'message:meta_title:call 3',
      'message:meta_description:call 5',
    ]);
  });

  test('positions after non-ASCII text', async () => {
    const usages = await analyze([
      imports,
      ``,
      `Grüße 👋 aus Köln: {m.greeting()} <b title={m.bold()}>ß</b>`,
    ]);
    expect(usages.map(({ name, column }) => `${name} ${column}`)).toEqual([
      // 👋 is two UTF-16 units.
      'greeting 21',
      'bold 45',
    ]);
  });

  test('front matter is not MDX', async () => {
    const usages = await analyze([
      `---`,
      `title: { not: "an expression" }`,
      `---`,
      imports,
      ``,
      `{m.after()}`,
    ]);
    expect(describeUsages(usages)).toEqual(['message:after:call 6']);
  });

  test('escapes, link destinations and autolink literals are not code', async () => {
    const usages = await analyze([
      imports,
      ``,
      `\\{m.escaped()} [a {m.label()}](https://example.com/{m.destination()})`,
      `GET https://api.example.com/users/{id} and {m.after()}`,
    ]);
    expect(describeUsages(usages)).toEqual([
      'message:label:call 3',
      'message:after:call 4',
    ]);
  });

  test('an expression that does not parse is left out, and the rest is analyzed', async () => {
    const usages = await analyze([
      imports,
      ``,
      `{m.broken(1 +)}`,
      ``,
      `<Note kind={m.kind(}>{m.inside()}</Note>`,
    ]);
    expect(describeUsages(usages)).toEqual(['message:inside:call 5']);
  });

  test("a file MDX rejects is skipped, with MDX's reason", async () => {
    const rejected = (lines: string[]) =>
      expect(analyze(lines)).rejects.toThrow(/MDX/);
    // Autolinks: MDX reads `<` as JSX.
    await rejected([`See <https://example.com>.`]);
    // HTML comments too.
    await rejected([`<!-- a comment -->`]);
    // An expression that never closes.
    await rejected([imports, ``, `{m.unclosed(`]);
    // Tags that do not match.
    await rejected([`<Note>`, ``, `<Other>`, `</Note>`]);
    await rejected([`<Note>`, ``, `Text`]);
    // An export that the file ends in.
    await rejected([`export const meta = {`, `  a: 1,`]);
  });

  test('`props` are what the files that render it pass', async () => {
    const usages = await analyzeProject(
      {
        [file]: `# {props.title()}\n`,
        '/app/src/App.tsx': [
          `import { m } from "./paraglide/messages.js";`,
          `import Guide from "./pages/guide.mdx";`,
          `export const App = () => <Guide title={m.guide_title} />;`,
        ].join('\n'),
      },
      { entry: file, loadAll: true }
    );
    expect(describeUsages(usages)).toEqual(['message:guide_title:call 1']);
  });

  test('without the language service in the project, files are skipped and it is named', async () => {
    const result = await generateSource(
      file,
      `# {m.x()}`,
      [mdxLanguage],
      NO_PACKAGES
    );
    expect(result).toMatchObject({
      missing: ['@mdx-js/language-service', 'typescript'],
    });
  });
});
