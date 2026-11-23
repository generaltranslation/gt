import { expect, test } from 'vitest';
import { parseSync } from 'oxc-parser';
import { emberLanguage } from '../../src/compiler/languages/ember.js';
import {
  NO_PACKAGES,
  parseSource,
} from '../../src/compiler/languages/language.js';
import { analyzeProject, summarize } from '../helpers/project.js';

async function analyze(file: string, lines: string[]) {
  const usages = await analyzeProject(
    { [file]: lines.join('\n') },
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

test("a template Glint cannot parse skips the file, with Glint's error", async () => {
  await expect(
    analyze('/app/src/components/broken.gjs', [
      ...imports,
      `<template>`,
      `  <p title={{m.broken (}}>{{m.ok}}</p>`,
      `</template>`,
    ])
  ).rejects.toThrow('broken.gjs: Glint: Parse error on line 2:');
});

test('without Glint in the project, the file is skipped and Glint is named', async () => {
  const result = await parseSource(
    '/app/src/components/list.gjs',
    `<template>{{m.x}}</template>`,
    (file, code, lang) => parseSync(file, code, { lang }) as never,
    [emberLanguage],
    NO_PACKAGES
  );
  expect(result).toMatchObject({
    error: 'ember files need @glint/ember-tsc in the project',
    missing: ['@glint/ember-tsc'],
  });
});
