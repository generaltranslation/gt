import { nativeLanguage } from './native-language.js';

/** Ember's template tag format (`.gjs`, `.gts`): each `<template>` read as Glimmer. */
export const emberLanguage = nativeLanguage({
  name: 'ember',
  extensions: ['.gjs', '.gts'],
});
