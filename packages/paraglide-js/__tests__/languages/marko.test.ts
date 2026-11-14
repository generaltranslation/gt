import { describe, expect, test } from 'vitest';
import { native } from '../../src/compiler/analysis/native.js';
import { NO_PACKAGES } from '../../src/compiler/languages/language.js';
import { markoLanguage } from '../../src/compiler/languages/marko.js';
import {
  analyzeProject,
  describeUsages,
  skippedFile,
  summarize,
} from '../helpers/project.js';

const file = '/app/src/components/cart.marko';

/** Whether the analysis reads Marko itself, rather than `@marko/language-tools`. */
const isNative = native.nativeLanguages().includes('marko');

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
    // An attribute's string is a string, as Marko compiles it: `m.css()` is not read.
    'message:html:call 12:28',
    'message:tos:reference 14:27',
    'message:enabled:call 15:5',
    'message:inside:call 16:11',
    // A placeholder in `<script>` is an expression.
    'message:script:call 19:11',
  ]);
});

test('concise mode', async () => {
  expect(
    await analyze([
      ...imports,
      `div.card`,
      `  h2 title=m.concise_title() -- \${m.concise_text()}`,
      `  ul [`,
      `    class=m.concise_class()`,
      `  ]`,
      `    for|item| of=items`,
      `      li -- \${m.concise_item({ item })}`,
    ])
  ).toEqual([
    'message:concise_title:call 5:12',
    'message:concise_text:call 5:35',
    'message:concise_class:call 7:11',
    'message:concise_item:call 10:15',
  ]);
});

test('a script of text only is code', async () => {
  expect(
    await analyze([
      ...imports,
      `<script>document.title = m.script_title();</script>`,
      `<script type="text/plain">m.not_code();</script>`,
    ])
  ).toEqual(['message:script_title:call 4:26']);
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

describe.runIf(isNative)('read natively', () => {
  test('an expression that does not parse is left out, and the rest of the file is analyzed', async () => {
    expect(
      await analyze([
        ...imports,
        `<p title=m.broken(,)>\${m.ok()}</p>`,
        `<p>\${m.after()}</p>`,
      ])
    ).toEqual(['message:ok:call 4:24', 'message:after:call 5:6']);
  });

  test("Marko's tooling need not be in the project", async () => {
    expect(
      await skippedFile(file, `<p>\${m.x()}</p>`, [markoLanguage], NO_PACKAGES)
    ).toBeUndefined();
  });

  test('a component reads the input of each tag that renders it, and of JSX', async () => {
    const card = '/app/src/components/card.marko';
    const usages = await analyzeProject(
      {
        [card]: [
          `<h2>\${input.title()}</h2>`,
          `$ const { label } = input;`,
          `<p>\${label()}</p>`,
          `<for|item| of=input.items>\${item.text}</for>`,
        ].join('\n'),
        [file]: [
          ...imports,
          `import Card from "./card.marko";`,
          `<Card title=m.card_title label=m.card_label/>`,
          `<\${Card} title=m.dynamic_title>`,
          `  <@items text=m.attribute_tag/>`,
          `</>`,
        ].join('\n'),
        '/app/src/App.tsx': [
          `import { m } from "./paraglide/messages.js";`,
          `import Card from "./components/card.marko";`,
          `export const App = () => <Card title={m.jsx_title} />;`,
        ].join('\n'),
      },
      { entry: card, loadAll: true }
    );

    expect(describeUsages(usages)).toEqual([
      'message:card_title:call 1',
      'message:dynamic_title:call 1',
      'message:jsx_title:call 1',
      'message:card_label:call 3',
    ]);
  });
});

describe.skipIf(isNative)("read by Marko's tooling", () => {
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
    const result = await skippedFile(
      file,
      `<p>\${m.x()}</p>`,
      [markoLanguage],
      NO_PACKAGES
    );
    expect(result).toMatchObject({
      error:
        'marko files need @marko/language-tools and @marko/compiler in the project',
      missing: ['@marko/language-tools', '@marko/compiler'],
    });
  });
});
