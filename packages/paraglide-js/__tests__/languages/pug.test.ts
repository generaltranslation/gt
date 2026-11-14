import { expect, test } from 'vitest';
import { analyzeProject, summarize } from '../helpers/project.js';

const file = '/app/src/components/Cart.vue';

async function analyze(lines: string[]) {
  const usages = await analyzeProject(
    { [file]: lines.join('\n') },
    { entry: file }
  );
  return usages.map(
    (usage) => `${summarize([usage])[0]} ${usage.line}:${usage.column}`
  );
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
    'message:title:call 8:14',
    'message:heading:call 8:41',
    // Not `#{m.total()}` or `span= m.buffered()`: pug runs those when it
    // compiles the template, not Vue in the component.
    'message:piped:call 15:14',
    'message:tos:reference 16:30',
    'message:tos:reference 17:31',
    'message:nested:call 18:13',
    'message:block:call 22:21',
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
  ).toEqual(['message:after:call 10:9', 'message:footer:call 14:8']);
});

test('tag interpolations, mixins, block expansion and inline HTML', async () => {
  expect(
    await analyze([
      ...script,
      `<template lang="pug">`,
      `mixin row`,
      `  p {{ m.in_mixin() }}`,
      `+row`,
      `  p {{ m.in_call() }}`,
      `p #[strong(:title="m.tag_title()") {{ m.tag_text() }}] after`,
      `p: span: b {{ m.expanded() }}`,
      `if cond`,
      `  p {{ m.conditional() }}`,
      `script.`,
      `  {{ m.script() }}`,
      `<span :title="m.html()">{{ m.html_text() }}</span>`,
      `List`,
      `  template(#row="{ m }")`,
      `    | {{ m.slot }}`,
      `</template>`,
    ])
  ).toEqual([
    'message:in_mixin:call 8:8',
    'message:in_call:call 10:8',
    'message:tag_title:call 11:20',
    'message:tag_text:call 11:39',
    'message:expanded:call 12:15',
    'message:html:call 17:15',
    'message:html_text:call 17:28',
  ]);
});

test('an indented template, with tabs', async () => {
  expect(
    await analyze([
      ...script,
      `<template lang="pug">`,
      `\tdiv`,
      `\t\tp {{ m.a() }}`,
      `\t\tp(:title='m.b()') {{ m.c() }}`,
      `\tp {{ m.d() }}`,
      `</template>`,
    ])
  ).toEqual([
    'message:a:call 8:8',
    'message:b:call 9:13',
    'message:c:call 9:24',
    'message:d:call 10:7',
  ]);
});

test('an expression that does not parse is skipped, not the file', async () => {
  expect(
    await analyze([
      ...script,
      `<template lang="pug">`,
      `p(:title="m.broken(") {{ m.ok() }}`,
      `</template>`,
    ])
  ).toEqual(['message:ok:call 7:26']);
});
