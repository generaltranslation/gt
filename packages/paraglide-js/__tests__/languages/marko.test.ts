import { expect, test } from 'vitest';
import { parseSync } from 'oxc-parser';
import {
  NO_PACKAGES,
  parseSource,
} from '../../src/compiler/languages/language.js';
import { markoLanguage } from '../../src/compiler/languages/marko.js';
import { analyzeProject, summarize } from '../helpers/project.js';

const file = '/app/src/components/cart.marko';

async function analyze(lines: string[]) {
  const usages = await analyzeProject(
    { [file]: lines.join('\n') },
    { entry: file, languages: [markoLanguage] }
  );
  return usages.map(
    (usage) => `${summarize([usage])[0]} ${usage.line}:${usage.column}`
  );
}

const imports = [
  `import { m } from "../paraglide/messages.js";`,
  `import { setLocale } from "../paraglide/runtime.js";`,
  `import { ParaglideMessage } from "paraglide-adapter";`,
];

test('placeholders, attributes, scriptlets and components', async () => {
  expect(
    await analyze([
      ...imports,
      `static const title = m.title();`,
      ``,
      `class {`,
      `  onCreate() { this.label = m.label(); }`,
      `}`,
      ``,
      `$ const count = 2;`,
      `<h1 title=m.tip({ count }) class="big">\${m.heading()}</h1>`,
      `<p class="a \${m.css()}">$!{m.html()}</p>`,
      `<button onClick() { setLocale("de") } on-click("save")>DE</button>`,
      `<ParaglideMessage message=m.tos/>`,
      `<if=m.enabled()>`,
      `  <span>\${m.inside()}</span>`,
      `</if>`,
      `<!-- \${m.commented()} -->`,
      `<script>\${m.script()}</script>`,
    ])
  ).toEqual([
    'message:title:call 4:22',
    'message:label:call 7:29',
    'message:tip:call 11:11',
    'message:heading:call 11:42',
    // The tooling writes `class="a ${…}"` as a plain string, so `m.css()` is not read.
    'message:html:call 12:28',
    'message:tos:reference 14:27',
    'message:enabled:call 15:5',
    'message:inside:call 16:11',
    // Placeholders in `<script>` are expressions to the tooling.
    'message:script:call 19:11',
  ]);
});

test('tag parameters scope their names', async () => {
  expect(
    await analyze([
      ...imports,
      `<for|m, index| of=lists>`,
      `  <li>\${m.label}</li>`,
      `</for>`,
      `<for|item| of=items>\${m.row({ item })}</for>`,
      `<p>\${m.after()}</p>`,
    ])
  ).toEqual(['message:row:call 7:23', 'message:after:call 8:6']);
});

test('tag variables are hoisted: one named `m` shadows the import in the whole template', async () => {
  expect(
    await analyze([
      ...imports,
      `<p>\${m.before()}</p>`,
      `<div>`,
      `  <let/m=0/>`,
      `</div>`,
      `<p>\${m.after()}</p>`,
    ])
  ).toEqual([]);
});

test('an expression that does not parse skips the file', async () => {
  await expect(
    analyze([
      ...imports,
      `<p title=m.broken(,)>\${m.ok()}</p>`,
      `<p>\${m.after()}</p>`,
    ])
  ).rejects.toThrow('cart.marko: marko tooling produced unparsable code');
});

test("without Marko's tooling in the project, the file is skipped and the packages are named", async () => {
  const result = await parseSource(
    file,
    `<p>\${m.x()}</p>`,
    (file, code, lang) => parseSync(file, code, { lang }) as never,
    [markoLanguage],
    NO_PACKAGES
  );
  expect(result).toMatchObject({
    error:
      'marko files need @marko/language-tools and @marko/compiler in the project',
    missing: ['@marko/language-tools', '@marko/compiler'],
  });
});
