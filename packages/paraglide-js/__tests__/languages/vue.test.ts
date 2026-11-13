import { expect, test } from 'vitest';
import type { LanguageContext } from '../../src/compiler/languages/language.js';
import { generateVue } from '../../src/compiler/languages/vue/generate.js';
import { REPO_PACKAGES } from '../helpers/project.js';

type Plugin = {
  createVirtualCode?(id: string, ...rest: unknown[]): unknown;
  disposeVirtualCode?(id: string, code: unknown): void;
};
type Core = { createVueLanguagePlugin(...args: unknown[]): Plugin };

const VUE = `<script setup>\nimport { m } from "./paraglide/messages.js";\n</script>\n<template><p>{{ m.greeting() }}</p></template>\n`;

test('disposes each virtual code it creates, which @vue/language-core keeps until then', async () => {
  const created: string[] = [];
  const disposed: string[] = [];

  // The plugin of a module it has not seen: generate.ts keeps one per module.
  const context: LanguageContext = {
    async load(specifier) {
      const loaded = await REPO_PACKAGES.load(specifier);
      if (specifier !== '@vue/language-core') return loaded as never;

      const core = loaded as Core;
      const watched: Core = {
        ...core,
        createVueLanguagePlugin(...args) {
          const plugin = core.createVueLanguagePlugin(...args);

          return {
            ...plugin,
            createVirtualCode(id, ...rest) {
              created.push(id);
              return plugin.createVirtualCode?.(id, ...rest);
            },
            disposeVirtualCode(id, code) {
              disposed.push(id);
              plugin.disposeVirtualCode?.(id, code);
            },
          };
        },
      };

      return watched as never;
    },
  };

  const first = await generateVue(VUE, '/app/src/A.vue', context);
  await generateVue(VUE, '/app/src/B.vue', context);

  expect(first?.code).toContain('m.greeting()');
  expect(created).toEqual(['/app/src/A.vue', '/app/src/B.vue']);
  expect(disposed).toEqual(created);
});
