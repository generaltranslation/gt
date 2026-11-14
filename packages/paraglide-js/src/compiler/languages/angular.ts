import { nativeLanguage } from './native-language.js';

/** Components with an inline `template` in a `.ts` file. */
export const angularComponentLanguage = nativeLanguage({
  name: 'angular-component',
  extensions: ['.ts'],
  detect: (source) =>
    /@Component\s*\(/.test(source) && /\btemplate\s*:/.test(source),
  mayContain: ['@Component', 'template'],
});

/** A component's `templateUrl` file; plain HTML pages with inline module scripts. */
export const angularTemplateLanguage = nativeLanguage({
  name: 'angular-template',
  extensions: ['.html'],
});

/** Analog single-file components: `<script lang="ts">`, `<template>`, `<style>`. */
export const analogLanguage = nativeLanguage({
  name: 'analog',
  extensions: ['.ag', '.analog'],
});
