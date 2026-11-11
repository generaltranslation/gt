import { expect, test } from 'vitest';
import { parseAutoImportDeclarations } from '../../lib/compiler/project/auto-imports.js';

test('declarations of unimport, unplugin-auto-import and Nuxt', () => {
  const code = [
    'export {}',
    'declare global {',
    "  const m: typeof import('./src/paraglide/messages').m",
    "  const getLocale: typeof import('./src/paraglide/runtime')['getLocale']",
    "  const i18n: typeof import('./src/i18n')",
    "  const json: typeof import('./data.json', { with: { type: 'json' } }).default",
    '}',
    "export { m as t, type Locale, default as greet } from '../app/paraglide/messages';",
  ].join('\n');
  expect(
    parseAutoImportDeclarations(code, '/app/auto-imports.d.ts').map(
      ({ name, specifier, exportName }) => `${name} ${specifier} ${exportName}`
    )
  ).toEqual([
    'm ./src/paraglide/messages m',
    'getLocale ./src/paraglide/runtime getLocale',
    'i18n ./src/i18n *',
    'json ./data.json default',
    't ../app/paraglide/messages m',
    'greet ../app/paraglide/messages default',
  ]);
});

test('component declarations of unplugin-vue-components and Nuxt', () => {
  const code = [
    "declare module 'vue' {",
    '  export interface GlobalComponents {',
    "    HelloWorld: typeof import('./src/components/HelloWorld.vue')['default']",
    "    'paraglide-message': typeof import('paraglide-adapter')['ParaglideMessage']",
    '  }',
    '}',
    `export const MessageView: typeof import("../app/components/MessageView.vue")['default']`,
    `export const LazyMessageView: LazyComponent<typeof import("../app/components/MessageView.vue")['default']>`,
  ].join('\n');
  expect(
    parseAutoImportDeclarations(code, '/app/components.d.ts').map(
      ({ name, specifier, exportName }) => `${name} ${specifier} ${exportName}`
    )
  ).toEqual([
    'HelloWorld ./src/components/HelloWorld.vue default',
    'paraglide-message paraglide-adapter ParaglideMessage',
    'MessageView ../app/components/MessageView.vue default',
    'LazyMessageView ../app/components/MessageView.vue default',
  ]);
});
