import { expect, test } from 'vitest';
import { native } from '../../src/compiler/analysis/native.js';
import { emberLanguage } from '../../src/compiler/languages/ember.js';
import { NO_PACKAGES } from '../../src/compiler/languages/language.js';
import { analyzeProject, skippedFile, summarize } from '../helpers/project.js';

/** The analysis writes Ember's files itself, without Glint, when the addon is built with it. */
const isNative = native.nativeLanguages().includes('ember');

async function analyze(
  file: string,
  lines: string[],
  others: Record<string, string> = {}
) {
  const usages = await analyzeProject(
    { [file]: lines.join('\n'), ...others },
    { entry: file, languages: [emberLanguage] }
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

test('mustaches, helpers, arguments and modifiers in a class component (.gts)', async () => {
  expect(
    await analyze('/app/src/components/cart.gts', [
      ...imports,
      `import Component from "@glimmer/component";`,
      `import { on } from "@ember/modifier";`,
      `import { fn } from "@ember/helper";`,
      ``,
      `export default class Cart extends Component<{ Args: { count: number } }> {`,
      `  label = m.label();`,
      ``,
      `  <template>`,
      `    <h1 title={{m.title}}>{{m.heading}}</h1>`,
      `    <p class="a {{m.css}}">{{m.items count=@count}}</p>`,
      `    <button {{on "click" (fn setLocale "de")}}>DE</button>`,
      `    <ParaglideMessage @message={{m.tos}} />`,
      `    {{! {{m.commented}} }}`,
      `    {{#if (m.enabled)}}{{m.yes}}{{else if @other}}{{m.other}}{{else}}{{m.no}}{{/if}}`,
      `    {{yield (m.yielded)}}`,
      `  </template>`,
      `}`,
    ])
  ).toEqual([
    'message:label:call 9:11',
    'message:title:call 12:17',
    'message:heading:call 12:29',
    'message:css:call 13:19',
    'message:items:call 13:30',
    'message:tos:reference 15:34',
    'message:enabled:call 17:12',
    'message:yes:call 17:26',
    'message:other:call 17:53',
    'message:no:call 17:72',
    'message:yielded:call 18:14',
  ]);
});

test('template-only components and block params (.gjs)', async () => {
  expect(
    await analyze('/app/src/components/list.gjs', [
      ...imports,
      `const Row = <template><li>{{m.row}}</li></template>;`,
      `const re = /<template>/;`,
      ``,
      `<template>`,
      `  {{#each @lists as |m index|}}{{m.label}}{{/each}}`,
      `  {{#let (m.short) as |label|}}{{label}}{{/let}}`,
      `  <List as |m|>{{m.label}}</List>`,
      `  <p>{{m.after}}</p>`,
      `</template>`,
    ])
  ).toEqual([
    'message:row:call 4:29',
    'message:short:call 9:11',
    'message:after:call 11:8',
  ]);
});

test("class members in the template: `this.label` is the class's field or getter", async () => {
  expect(
    await analyze('/app/src/components/members.gts', [
      ...imports,
      `import Component from "@glimmer/component";`,
      ``,
      `export default class Members extends Component {`,
      `  label = m.label;`,
      `  get heading() { return m.heading; }`,
      `  <template><p title={{this.label}}>{{this.heading}}</p></template>`,
      `}`,
    ])
  ).toEqual([
    'message:label:reference 7:11',
    'message:heading:reference 8:26',
    'message:label:call 9:24',
    'message:heading:call 9:39',
  ]);
});

test("`this` in a template that is a class field's value, or a method's, is the class", async () => {
  expect(
    await analyze('/app/src/components/fields.gts', [
      ...imports,
      `import Component from "@glimmer/component";`,
      ``,
      `export default class Fields extends Component {`,
      `  label = m.field`,
      `  render = <template>{{this.label}}</template>;`,
      `  method() { return <template>{{this.label}}</template>; }`,
      `}`,
      `const Outside = <template>{{this.label}}</template>;`,
    ])
  ).toEqual([
    'message:field:reference 7:11',
    'message:field:call 8:24',
    'message:field:call 9:33',
  ]);
});

test('arguments are passed, other paths are called; keywords and arguments are not the module', async () => {
  expect(
    await analyze('/app/src/components/positions.gjs', [
      ...imports,
      `import Foo from "./foo.gjs";`,
      `<template>`,
      `  {{if @x m.a m.b}} {{#if m.cond}}{{/if}} {{yield m.yielded}}`,
      `  <Foo @ref={{m.ref}} @call={{m.call 1}} @concat="a {{m.concat}}" class={{m.attr}} {{mod m.modified}}>`,
      `    <:header as |m|>{{m.shadowed}}</:header>`,
      `    <:body>{{m.body}}</:body>`,
      `  </Foo>`,
      `  {{#let (hash a=m.hashed) as |h|}}{{h.a}}{{/let}}`,
      `  {{m.multi`,
      `    count=@count}}`,
      `</template>`,
    ])
  ).toEqual([
    'message:a:reference 6:11',
    'message:b:reference 6:15',
    'message:cond:reference 6:27',
    'message:yielded:reference 6:51',
    'message:ref:reference 7:15',
    'message:call:call 7:31',
    'message:concat:call 7:55',
    'message:attr:call 7:75',
    'message:modified:reference 7:90',
    'message:body:call 9:14',
    'message:hashed:reference 11:18',
    'message:multi:call 12:5',
  ]);
});

test("a value the template passes to the module's own functions is followed into them", async () => {
  expect(
    await analyze('/app/src/components/flows.gjs', [
      ...imports,
      `const render = (label) => label();`,
      `const pick = (key) => m[key]();`,
      `function Local(args) { return args.label(); }`,
      `<template>{{render m.passed}}{{pick "picked"}}<Local @label={{m.prop}} /></template>`,
    ])
  ).toEqual([
    'message:passed:call 4:27',
    'message:picked:call 5:23',
    'message:prop:call 6:31',
    'message:passed:reference 7:20',
    'message:prop:reference 7:63',
  ]);
});

test('comments, escaped mustaches, and text are not read', async () => {
  expect(
    await analyze('/app/src/components/text.gjs', [
      ...imports,
      `<template>`,
      `  <!-- {{m.html_comment}} --> {{!-- {{m.comment}} --}} \\{{m.escaped}}`,
      `  <style>.a { color: red; } a < b</style> {{m.read}}`,
      `</template>`,
    ])
  ).toEqual(['message:read:call 6:45']);
});

test.runIf(isNative)(
  "a template that does not parse skips the file, with Glimmer's error",
  async () => {
    await expect(
      analyze('/app/src/components/broken.gjs', [
        ...imports,
        `<template>`,
        `  <p title={{m.broken (}}>{{m.ok}}</p>`,
        `</template>`,
      ])
    ).rejects.toThrow('broken.gjs: Glimmer: Parse error on line 5:');

    await expect(
      analyze('/app/src/components/unclosed.gjs', [
        ...imports,
        `<template>`,
        `  <div><p>{{m.ok}}</div>`,
        `</template>`,
      ])
    ).rejects.toThrow(
      'unclosed.gjs: Glimmer: Closing tag </div> did not match last open tag <p> (on line 5)'
    );
  }
);

test.runIf(isNative)(
  'the file is read without Glint in the project',
  async () => {
    const result = await skippedFile(
      '/app/src/components/list.gjs',
      `<template>{{m.x}}</template>`,
      [emberLanguage],
      NO_PACKAGES
    );
    expect(result).toBeUndefined();
  }
);

test.skipIf(isNative)(
  "a template Glint cannot parse skips the file, with Glint's error",
  async () => {
    await expect(
      analyze('/app/src/components/broken.gjs', [
        ...imports,
        `<template>`,
        `  <p title={{m.broken (}}>{{m.ok}}</p>`,
        `</template>`,
      ])
    ).rejects.toThrow('broken.gjs: Glint: Parse error on line 2:');
  }
);

test.skipIf(isNative)(
  'without Glint in the project, the file is skipped and Glint is named',
  async () => {
    const result = await skippedFile(
      '/app/src/components/list.gjs',
      `<template>{{m.x}}</template>`,
      [emberLanguage],
      NO_PACKAGES
    );
    expect(result).toMatchObject({
      error: 'ember files need @glint/ember-tsc in the project',
      missing: ['@glint/ember-tsc'],
    });
  }
);
