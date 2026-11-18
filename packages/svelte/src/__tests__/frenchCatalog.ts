import { hashStringMessage } from 'gt-i18n/internal/string';
import type { JsxChildren } from 'generaltranslation/types';
import type { TranslationCatalog } from '../lib/runtime/GT.svelte';
import { prepareSvelteComponent } from '../lib/vite/component';
import greetingSource from './fixtures/Greeting.svelte?raw';

const strings: Record<string, string> = {
  'Greeting title': 'Titre',
  Welcome: 'Bienvenue',
};

const richContent: [marker: string, translation: JsxChildren][] = [
  [
    'wonderful',
    ['Bonjour ', { i: 1, c: [{ i: 2, c: 'monde' }, ' merveilleux'] }, ' !'],
  ],
  [
    'messages',
    [{ k: '_gt_value_1' }, ', vous avez ', { k: '_gt_n_2' }, ' messages.'],
  ],
  ['Click', ['Cliquez ', { i: 1, c: 'ici' }, ' pour continuer.']],
];

/** French translations for every entry the plugin extracts from the fixtures. */
export function frenchCatalog(): TranslationCatalog {
  const { entries } = prepareSvelteComponent(
    greetingSource,
    'Greeting.svelte',
    'Greeting.svelte'
  ).compile(new Set(['gt-svelte']))!;
  const catalog: TranslationCatalog = {
    [hashStringMessage('Documentation', { $context: 'navigation' })]:
      'Documentation (fr)',
  };
  for (const entry of entries) {
    catalog[entry.metadata.hash] =
      entry.dataFormat === 'STRING'
        ? strings[entry.source]!
        : richContent.find(([marker]) =>
            JSON.stringify(entry.source).includes(marker)
          )![1];
  }
  return catalog;
}
