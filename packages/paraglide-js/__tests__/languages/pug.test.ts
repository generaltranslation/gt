import { expect, test } from 'vitest';
import {
  defaultTargets,
  packageTarget,
} from '../../lib/compiler/paraglide/targets.js';
import { analyzeProject, summarize } from '../helpers/project.js';

const targets = [
  ...defaultTargets,
  packageTarget('adapter', 'paraglide-adapter'),
];
const adapter = { '/app/node_modules/paraglide-adapter/index.js': 'export {}' };
const file = '/app/src/components/Cart.vue';

async function analyze(lines: string[]) {
  const usages = await analyzeProject(
    { [file]: lines.join('\n'), ...adapter },
    { entry: file, targets }
  );
  return usages.map((usage) => {
    const element = usage.element
      ? ` <${usage.element.element}${usage.element.attribute ? ` ${usage.element.attribute}` : ''}>`
      : '';
    return `${summarize([usage])[0]} ${usage.line}:${usage.column}${element}`;
  });
}

const script = [
  `<script setup lang="ts">`,
  `import { m } from "../paraglide/messages.js";`,
  `import { setLocale } from "../paraglide/runtime.js";`,
  `import { ParaglideMessage } from "paraglide-adapter";`,
  `</script>`,
];

test('interpolation, directives and components', async () => {
  expect(
    await analyze([
      ...script,
      `<template lang="pug">`,
      `div.cart#main`,
      `  h1(:title="m.title()" class="big") {{ m.heading() }}`,
      `  p Total: #{m.total()}`,
      `  span= m.buffered()`,
      `  button(`,
      `    type="button",`,
      `    @click="setLocale('de'); track()"`,
      `  ) DE`,
      `  | piped {{ m.piped() }}`,
      `  ParaglideMessage(:message="m.tos")`,
      `  paraglide-message(:message="m.tos")/`,
      `  ul: li {{ m.nested() }}`,
      `  // {{ m.commented() }}`,
      `    p {{ m.commented_child() }}`,
      `  p.`,
      `    A text block {{ m.block() }}`,
      `</template>`,
    ])
  ).toEqual([
    'message:title:call 8:14 <h1 :title>',
    'message:heading:call 8:41 <h1>',
    // Not `#{m.total()}` or `span= m.buffered()`: pug runs those when it
    // compiles the template, not Vue in the component.
    'runtime:setLocale:call 13:13 <button @click>',
    'message:piped:call 15:14 <div>',
    // A tag's own usage is in its parent element.
    'adapter:ParaglideMessage:component 16:3 <div>',
    'message:tos:reference 16:30 <ParaglideMessage :message>',
    'adapter:ParaglideMessage:component 17:3 <div>',
    'message:tos:reference 17:31 <paraglide-message :message>',
    'message:nested:call 18:13 <li>',
    'message:block:call 22:21 <p>',
  ]);
});

test("v-for and slot props shadow imports for their element's children", async () => {
  expect(
    await analyze([
      ...script,
      `<template lang="pug">`,
      `ul`,
      `  li(v-for="m in lists" :key="m.id") {{ m.label }}`,
      `    span {{ m.child }}`,
      `  li {{ m.after() }}`,
      `List`,
      `  template(#row="{ m }")`,
      `    p {{ m.label }}`,
      `  p {{ m.footer() }}`,
      `</template>`,
    ])
  ).toEqual(['message:after:call 10:9 <li>', 'message:footer:call 14:8 <p>']);
});

test('an expression that does not parse is skipped, not the file', async () => {
  expect(
    await analyze([
      ...script,
      `<template lang="pug">`,
      `p(:title="m.broken(") {{ m.ok() }}`,
      `</template>`,
    ])
  ).toEqual(['message:ok:call 7:26 <p>']);
});
