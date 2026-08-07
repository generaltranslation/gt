import { describe, expect, it } from 'vitest';
import { isVueSfcSource } from '../project/inspectVueProject.js';

describe('isVueSfcSource', () => {
  it.each([
    ['root template', '<template><T>Message</T></template>'],
    ['root script', '<script setup>const message = 1;</script>'],
    ['same-line text', 'Copyright 2026 <template><T>Message</T></template>'],
    [
      'multiline text',
      'Copyright 2026\nAll rights reserved\n<template>Message</template>',
    ],
    [
      'text before script setup',
      'Generated file <script setup>const message = 1;</script>',
    ],
    [
      'text and custom block',
      'Metadata <i18n>{"locale":"en"}</i18n><template>Message</template>',
    ],
    [
      'comments and doctype',
      '<!-- license --><!DOCTYPE html>/* generated */<template>Message</template>',
    ],
  ])('recognizes an SFC with %s', (_name, source) => {
    expect(isVueSfcSource(source)).toBe(true);
  });

  it.each([
    [
      'an import and exported JSX',
      "import { T } from 'gt-react'; export const value = <T>Message</T>;",
    ],
    ['typed parenthesized JSX', 'const value: JSX.Element = (<T>Message</T>);'],
    ['a JSX fragment', 'const value = <><T>Message</T></>;'],
    [
      'a comment containing a standard tag',
      '/* <template>fake</template> */ <T>Message</T>;',
    ],
    [
      'a string containing a standard tag',
      "const fake = '<template>fake</template>'; const value = <T>Message</T>;",
    ],
    [
      'a template literal containing a standard tag',
      'const fake = `<script>fake</script>`; const value = <T>Message</T>;',
    ],
    ['a root custom element', '<T>Message</T>'],
    ['a root member element', '<GT.T>Message</GT.T>'],
    ['a hyphenated custom element', '<gt-widget>Message</gt-widget>'],
    [
      'custom and standard-named JSX expressions',
      '<T>Message</T>; <template><T>Nested</T></template>;',
    ],
    [
      'a parenthesized standard-named JSX expression',
      '(<template><T>Message</T></template>);',
    ],
  ])('preserves a legacy module with %s', (_name, source) => {
    expect(isVueSfcSource(source)).toBe(false);
  });
});
