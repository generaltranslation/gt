import { nativeLanguage } from './native-language.js';

/**
 * VitePress Markdown: `<script setup>`, `{{ … }}` and Vue components in a `.md`
 * file, read as VitePress compiles it.
 */
export const markdownLanguage = nativeLanguage({
  name: 'markdown',
  extensions: ['.md'],
});
