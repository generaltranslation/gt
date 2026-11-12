import type { GeneratedSource, SourceLanguage } from './language.js';
import {
  generateVue,
  hasVueTools,
  VUE_INSTALLED_WITH,
  VUE_REQUIRES,
} from './vue/generate.js';

const SCRIPT_BLOCK = /<script\b/i;
const NO_CODE: GeneratedSource = { code: '', lang: 'js', mappings: [] };

/**
 * VitePress Markdown: `<script setup>`, `{{ … }}` and Vue components in a `.md`
 * file, read by `@vue/language-core` as VitePress does.
 */
export const markdownLanguage: SourceLanguage = {
  name: 'markdown',
  extensions: ['.md'],
  requires: VUE_REQUIRES,
  installedWith: VUE_INSTALLED_WITH,
  async generate(source, file, context) {
    // Most projects have Markdown that is no Vue page, like a README: without
    // the tools, only a file with a script is reported as skipped.
    const isPlainText = !SCRIPT_BLOCK.test(source);
    if (isPlainText && !(await hasVueTools(context))) return NO_CODE;

    return generateVue(source, file, context, { vitePress: true });
  },
};
