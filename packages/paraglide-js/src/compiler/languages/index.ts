import type { SourceLanguage } from './language.js';
import {
  analogLanguage,
  angularComponentLanguage,
  angularTemplateLanguage,
} from './angular.js';
import { astroLanguage } from './astro.js';
import { emberLanguage } from './ember.js';
import { markdownLanguage } from './markdown.js';
import { markoLanguage } from './marko.js';
import { mdxLanguage } from './mdx.js';
import { svelteLanguage } from './svelte.js';
import { vueLanguage } from './vue.js';

export {
  analogLanguage,
  angularComponentLanguage,
  angularTemplateLanguage,
  astroLanguage,
  emberLanguage,
  markdownLanguage,
  markoLanguage,
  mdxLanguage,
  svelteLanguage,
  vueLanguage,
};

export const defaultLanguages: readonly SourceLanguage[] = [
  vueLanguage,
  svelteLanguage,
  astroLanguage,
  mdxLanguage,
  markdownLanguage,
  angularComponentLanguage,
  angularTemplateLanguage,
  analogLanguage,
  markoLanguage,
  emberLanguage,
];
