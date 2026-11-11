import { describe, it, expect } from 'vitest';
import { CutoffFormatConstructor } from '../CutoffFormat';
import type { CutoffFormatOptions } from '../types';

describe('CutoffFormatConstructor', () => {
  it.each<[string, string, CutoffFormatOptions, string, string[]]>([
    // positive maxChars cuts the end
    [
      'truncates with an ellipsis',
      'en',
      { maxChars: 5 },
      'Hello, world!',
      ['Hell', '…'],
    ],
    ['keeps a shorter string', 'en', { maxChars: 20 }, 'Short', ['Short']],
    [
      'keeps a string of exactly maxChars',
      'en',
      { maxChars: 5 },
      'Hello',
      ['Hello'],
    ],
    ['keeps an empty string', 'en', { maxChars: 5 }, '', ['']],
    // negative maxChars cuts the start
    [
      'keeps the end for a negative maxChars',
      'en',
      { maxChars: -3 },
      'Hello, world!',
      ['…', 'd!'],
    ],
    [
      'keeps a string of exactly -maxChars',
      'en',
      { maxChars: -5 },
      'Hello',
      ['Hello'],
    ],
    [
      'keeps a shorter string for a negative maxChars',
      'en',
      { maxChars: -10000 },
      'Short string',
      ['Short string'],
    ],
    // no cutoff
    [
      'returns an empty string for maxChars 0',
      'en',
      { maxChars: 0 },
      'Hello, world!',
      [''],
    ],
    [
      'keeps the value without maxChars',
      'en',
      {},
      'Hello, world!',
      ['Hello, world!'],
    ],
    [
      'keeps the value for an undefined maxChars',
      'en',
      { maxChars: undefined },
      'Hello, world!',
      ['Hello, world!'],
    ],
    // style none
    [
      'truncates without a terminator',
      'en',
      { maxChars: 5, style: 'none' },
      'Hello, world!',
      ['Hello'],
    ],
    [
      'ignores the separator without a terminator',
      'en',
      { maxChars: 5, style: 'none', separator: ' ' },
      'Hello, world!',
      ['Hello'],
    ],
    // locale-specific terminators
    [
      'uses the French separator',
      'fr',
      { maxChars: 7 },
      'Bonjour le monde',
      ['Bonjo', ' ', '…'],
    ],
    [
      'uses the Chinese terminator',
      'zh',
      { maxChars: 5 },
      '这是一个测试字符串',
      ['这是一', '……'],
    ],
    [
      'uses the Japanese terminator',
      'ja',
      { maxChars: 4 },
      'こんにちは',
      ['こん', '……'],
    ],
    [
      'looks the terminator up by language',
      'zh-CN',
      { maxChars: 5 },
      '这是一个测试字符串',
      ['这是一', '……'],
    ],
    [
      'uses the default terminator for other languages',
      'de',
      { maxChars: 6 },
      'Hallo Welt',
      ['Hallo', '…'],
    ],
    [
      'uses the default terminator for a regional locale',
      'es-ES',
      { maxChars: 6 },
      'Hola mundo',
      ['Hola ', '…'],
    ],
    // custom terminator and separator
    [
      'uses a custom terminator',
      'en',
      { maxChars: 8, terminator: '...' },
      'Hello, world!',
      ['Hello', '...'],
    ],
    [
      'uses a custom separator',
      'en',
      { maxChars: 9, terminator: '...', separator: ' ' },
      'Hello, world!',
      ['Hello', ' ', '...'],
    ],
    [
      'overrides the locale separator',
      'fr',
      { maxChars: -3, separator: ' ' },
      'Bonjour',
      ['…', ' ', 'r'],
    ],
    [
      'uses a long custom terminator',
      'en',
      { maxChars: 25, terminator: '... (truncated) ...' },
      'This is a very long string',
      ['This i', '... (truncated) ...'],
    ],
    [
      'keeps one character before the terminator',
      'en',
      { maxChars: 4, terminator: '...' },
      'Hello',
      ['H', '...'],
    ],
    [
      'keeps one character after a prepended terminator',
      'en',
      { maxChars: -4, terminator: '...' },
      'Hello',
      ['...', 'o'],
    ],
    // the terminator and separator leave no room for the value
    [
      'returns an empty string when the terminator fills maxChars',
      'en',
      { maxChars: 1, terminator: '…' },
      'Hello',
      [''],
    ],
    [
      'returns an empty string when the terminator fills -maxChars',
      'en',
      { maxChars: -1, terminator: '…' },
      'Hello',
      [''],
    ],
    [
      'returns an empty string when the terminator equals maxChars',
      'en',
      { maxChars: 3, terminator: '...' },
      'Hello',
      [''],
    ],
    [
      'returns an empty string when the terminator exceeds maxChars',
      'en',
      { maxChars: 2, terminator: '...' },
      'Hello',
      [''],
    ],
    [
      'returns an empty string when the terminator and separator fill maxChars',
      'en',
      { maxChars: 4, terminator: '...', separator: ' ' },
      'Hello',
      [''],
    ],
    // maxChars counts UTF-16 code units
    [
      'counts mixed scripts',
      'en',
      { maxChars: 6 },
      'Hello 世界',
      ['Hello', '…'],
    ],
    [
      'counts newlines and tabs',
      'en',
      { maxChars: 8 },
      'Line1\nLine2\tTab',
      ['Line1\nL', '…'],
    ],
    [
      'counts zero-width characters',
      'en',
      { maxChars: 6 },
      'He​llo‌Wor‍ld',
      ['He​ll', '…'],
    ],
  ])('%s', (_label, locale, options, value, parts) => {
    const formatter = new CutoffFormatConstructor(locale, options);
    expect(formatter.formatToParts(value)).toEqual(parts);
    expect(formatter.format(value)).toBe(parts.join(''));
  });

  it.each<[string, Intl.LocalesArgument, CutoffFormatOptions, object]>([
    [
      'no options',
      'en',
      {},
      {
        maxChars: undefined,
        style: undefined,
        terminator: undefined,
        separator: undefined,
      },
    ],
    [
      'a style without maxChars',
      ['fr', 'en'],
      { style: 'none' },
      {
        maxChars: undefined,
        style: undefined,
        terminator: undefined,
        separator: undefined,
      },
    ],
    [
      'the locale preset once maxChars is set',
      'fr',
      { maxChars: 5 },
      { maxChars: 5, style: 'ellipsis', terminator: '…', separator: ' ' },
    ],
    [
      'explicit options',
      'en',
      { maxChars: 10, style: 'ellipsis', terminator: '...', separator: ' ' },
      { maxChars: 10, style: 'ellipsis', terminator: '...', separator: ' ' },
    ],
  ])('resolves %s', (_label, locales, options, expected) => {
    expect(
      new CutoffFormatConstructor(locales, options).resolvedOptions()
    ).toEqual(expected);
  });

  it.each<[string, Intl.LocalesArgument]>([
    ['an empty locale list', []],
    ['a malformed locale', 'not a locale'],
  ])('falls back to the default locale for %s', (_label, locales) => {
    const formatter = new CutoffFormatConstructor(locales, { maxChars: 5 });
    expect(formatter.format('Hello, world!')).toBe('Hell…');
  });

  it('throws for an invalid style', () => {
    expect(() => {
      // @ts-expect-error testing runtime validation for invalid options
      new CutoffFormatConstructor('en', { style: 'invalid' });
    }).toThrow('Invalid cutoff style: invalid');
  });
});
