// Props passed to Svelte, Vue and Astro components, imported or auto-imported,
// are followed into the component.
import { describe, expect, test } from 'vitest';
import type { GlobalBinding } from '../../src/compiler/analysis/module-graph.js';
import { analyzeProject, describeUsages } from '../helpers/project.js';

const imports = `import { m } from "./paraglide/messages.js";`;

/** The usages in `entry`, with every file loaded: e.g. `message:a:call 1 <em>`. */
async function usagesIn(
  entry: string,
  files: Record<string, string>,
  globals?: readonly GlobalBinding[]
): Promise<string[]> {
  const usages = await analyzeProject(files, { entry, loadAll: true, globals });
  return describeUsages(usages);
}

describe('Svelte', () => {
  const page = [
    `<script>`,
    `  ${imports}`,
    `  import Label from "./Label.svelte";`,
    `</script>`,
    `<Label message={m.flow_svelte_first} />`,
    `<Label message={m.flow_svelte_second} />`,
  ].join('\n');

  test('$props() holds what each call site passes', async () => {
    expect(
      await usagesIn('/app/src/Label.svelte', {
        '/app/src/Label.svelte': `<script>let { message } = $props();</script><em>{message()}</em>`,
        '/app/src/Page.svelte': page,
      })
    ).toEqual([
      'message:flow_svelte_first:call 1 <em>',
      'message:flow_svelte_second:call 1 <em>',
    ]);
  });

  test('a props object, shorthand props and spreads', async () => {
    expect(
      await usagesIn('/app/src/Label.svelte', {
        '/app/src/Label.svelte': [
          `<script>const props = $props();</script>`,
          `<em>{props.message()}</em>`,
          `<b>{props.title()}</b>`,
        ].join('\n'),
        '/app/src/Page.svelte': [
          `<script>`,
          `  ${imports}`,
          `  import Label from "./Label.svelte";`,
          `  const message = m.shorthand;`,
          `  const rest = { title: m.spread_title };`,
          `</script>`,
          `<Label {message} {...rest} />`,
        ].join('\n'),
      })
    ).toEqual([
      'message:shorthand:call 2 <em>',
      'message:spread_title:call 3 <b>',
    ]);
  });

  // The default is an alias, as in `let t = m.fallback`; its reads are the usages.
  test("Svelte 4's `export let`, with its default", async () => {
    expect(
      await usagesIn('/app/src/Label.svelte', {
        '/app/src/Label.svelte': [
          `<script>`,
          `  ${imports}`,
          `  export let message = m.fallback;`,
          `</script>`,
          `<em>{message()}</em>`,
        ].join('\n'),
        '/app/src/Page.svelte': page,
      })
    ).toEqual([
      'message:fallback:call 5 <em>',
      'message:flow_svelte_first:call 5 <em>',
      'message:flow_svelte_second:call 5 <em>',
    ]);
  });

  test('a test of the prop is not a usage of its own', async () => {
    expect(
      await usagesIn('/app/src/Label.svelte', {
        '/app/src/Label.svelte': `<script>let { message } = $props();</script>{#if message}<em>{message()}</em>{/if}`,
        '/app/src/Page.svelte': page,
      })
    ).toEqual([
      'message:flow_svelte_first:call 1 <em>',
      'message:flow_svelte_second:call 1 <em>',
    ]);
  });

  test('through a barrel in another directory', async () => {
    expect(
      await usagesIn('/app/src/ui/Label.svelte', {
        '/app/src/ui/Label.svelte': `<script>let { message } = $props();</script><em>{message()}</em>`,
        '/app/src/ui/index.ts': `export { default as Label } from "./Label.svelte";`,
        '/app/src/Page.svelte': [
          `<script>`,
          `  ${imports}`,
          `  import { Label } from "./ui/index.js";`,
          `</script>`,
          `<Label message={m.barrel} />`,
        ].join('\n'),
      })
    ).toEqual(['message:barrel:call 1 <em>']);
  });
});

describe('Vue', () => {
  const page = [
    `<script setup>`,
    imports,
    `import Label from "./Label.vue";`,
    `</script>`,
    `<template>`,
    `  <Label :message="m.flow_vue_first" />`,
    `  <Label v-bind:message="m.flow_vue_second">children</Label>`,
    `</template>`,
  ].join('\n');

  test('defineProps(), and the template reading a prop directly', async () => {
    expect(
      await usagesIn('/app/src/Label.vue', {
        '/app/src/Label.vue': [
          `<script setup>`,
          `const props = defineProps(["message"]);`,
          `</script>`,
          `<template><em>{{ props.message() }}</em><b>{{ message() }}</b></template>`,
        ].join('\n'),
        '/app/src/Page.vue': page,
      })
    ).toEqual([
      'message:flow_vue_first:call 4 <em>',
      'message:flow_vue_second:call 4 <em>',
      'message:flow_vue_first:call 4 <b>',
      'message:flow_vue_second:call 4 <b>',
    ]);
  });

  test('TypeScript props destructured, with a default', async () => {
    expect(
      await usagesIn('/app/src/Label.vue', {
        '/app/src/Label.vue': [
          `<script setup lang="ts">`,
          `const { message = () => "" } = defineProps<{ message?: () => string }>();`,
          `</script>`,
          `<template><em>{{ message() }}</em></template>`,
        ].join('\n'),
        '/app/src/Page.vue': page,
      })
    ).toEqual([
      'message:flow_vue_first:call 4 <em>',
      'message:flow_vue_second:call 4 <em>',
    ]);
  });

  test("the Options API's props, and kebab-case attributes", async () => {
    expect(
      await usagesIn('/app/src/Label.vue', {
        '/app/src/Label.vue': [
          `<script>`,
          `export default { props: ["myMessage"] };`,
          `</script>`,
          `<template><em>{{ myMessage() }}</em></template>`,
        ].join('\n'),
        '/app/src/Page.vue': [
          `<script setup lang="ts">`,
          imports,
          `import Label from "./Label.vue";`,
          `</script>`,
          `<template><Label :my-message="m.kebab" /></template>`,
        ].join('\n'),
      })
    ).toEqual(['message:kebab:call 4 <em>']);
  });

  // Nuxt, unplugin-vue-components: the page renders a component it does not import.
  test.each(['', ` lang="ts"`])(
    'an auto-imported component (<script%s>)',
    async (lang) => {
      expect(
        await usagesIn(
          '/app/src/components/MessageView.vue',
          {
            '/app/src/components/MessageView.vue': [
              `<script setup>`,
              `defineProps(["message"]);`,
              `</script>`,
              `<template><em>{{ message() }}</em></template>`,
            ].join('\n'),
            '/app/src/pages/about.vue': [
              `<script setup${lang}>`,
              `import { m } from "../paraglide/messages.js";`,
              `</script>`,
              `<template>`,
              `  <MessageView :message="m.auto_imported" />`,
              `  <message-view :message="m.auto_imported_kebab" />`,
              `</template>`,
            ].join('\n'),
          },
          [
            {
              name: 'MessageView',
              file: '/app/src/components/MessageView.vue',
              exportName: 'default',
            },
          ]
        )
      ).toEqual([
        'message:auto_imported:call 4 <em>',
        'message:auto_imported_kebab:call 4 <em>',
      ]);
    }
  );
});

describe('Astro', () => {
  test('Astro.props holds what each call site passes', async () => {
    expect(
      await usagesIn('/app/src/Label.astro', {
        '/app/src/Label.astro': [
          `---`,
          `const { message } = Astro.props;`,
          `---`,
          `<em>{message()}</em>`,
        ].join('\n'),
        '/app/src/Page.astro': [
          `---`,
          imports,
          `import Label from "./Label.astro";`,
          `---`,
          `<Label message={m.flow_astro_first} />`,
          `<Label message={m.flow_astro_second} />`,
        ].join('\n'),
      })
    ).toEqual([
      'message:flow_astro_first:call 4 <em>',
      'message:flow_astro_second:call 4 <em>',
    ]);
  });

  // The call sites are in load order, which differs between runs.
  test('from a JSX file, and a Svelte component rendered by Astro', async () => {
    const usages = await usagesIn('/app/src/Label.svelte', {
      '/app/src/Label.svelte': `<script>let { message } = $props();</script><em>{message()}</em>`,
      '/app/src/Page.astro': [
        `---`,
        imports,
        `import Label from "./Label.svelte";`,
        `---`,
        `<Label message={m.from_astro} />`,
      ].join('\n'),
      '/app/src/App.tsx': `${imports}\nimport Label from "./Label.svelte";\nexport const App = () => <Label message={m.from_tsx} />;`,
    });
    expect(usages.sort()).toEqual([
      'message:from_astro:call 1 <em>',
      'message:from_tsx:call 1 <em>',
    ]);
  });
});
