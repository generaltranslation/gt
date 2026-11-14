import type { SourceLanguage } from './language.js';
import {
  generateVue,
  VUE_INSTALLED_WITH,
  VUE_REQUIRES,
  VUE_USES,
} from './vue/generate.js';

/**
 * VitePress Markdown: `<script setup>`, `{{ … }}` and Vue components in a `.md`
 * file, read by `@vue/language-core` as VitePress does.
 */
export const markdownLanguage: SourceLanguage = {
  name: 'markdown',
  extensions: ['.md'],
  requires: VUE_REQUIRES,
  uses: VUE_USES,
  installedWith: VUE_INSTALLED_WITH,
  generate: (source, file, context) =>
    generateVue(source, file, context, { vitePress: true }),
};
