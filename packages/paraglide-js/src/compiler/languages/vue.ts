import type { SourceLanguage } from './language.js';
import {
  generateVue,
  VUE_INSTALLED_WITH,
  VUE_REQUIRES,
  VUE_USES,
} from './vue/generate.js';

/**
 * Vue single-file components, read by `@vue/language-core`; `lang="pug"`
 * templates too when `@vue/language-plugin-pug` is installed.
 */
export const vueLanguage: SourceLanguage = {
  name: 'vue',
  extensions: ['.vue'],
  requires: VUE_REQUIRES,
  uses: VUE_USES,
  installedWith: VUE_INSTALLED_WITH,
  generate: (source, file, context) => generateVue(source, file, context),
};
