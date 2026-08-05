import {
  extractFromVueSource,
  type VueCompiler,
} from '@generaltranslation/vue-extractor';
import * as compiler from 'vue/compiler-sfc';

const exactCompiler: VueCompiler = compiler;

void extractFromVueSource(
  '<template><div /></template>',
  '/virtual/TypeProbe.vue',
  { compiler: exactCompiler }
);
