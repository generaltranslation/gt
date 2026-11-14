import { nativeLanguage } from './native-language.js';

/** Vue single-file components, `<template lang="pug">` templates included. */
export const vueLanguage = nativeLanguage({
  name: 'vue',
  extensions: ['.vue'],
});
