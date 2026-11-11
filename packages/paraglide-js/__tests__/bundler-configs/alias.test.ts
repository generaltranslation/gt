import { expect, test } from 'vitest';
import {
  aliasEntries,
  applyAliases,
} from '../../src/compiler/bundler-configs/alias.js';

test('a string alias matches the import itself and paths below it', () => {
  const aliases = [{ find: '@', replacement: '/app/src' }];
  expect(applyAliases('@', aliases)).toBe('/app/src');
  expect(applyAliases('@/i18n/index.js', aliases)).toBe(
    '/app/src/i18n/index.js'
  );
  expect(applyAliases('@scope/package', aliases)).toBe('@scope/package');
  expect(applyAliases('./@/a.js', aliases)).toBe('./@/a.js');
});

test('an exact alias matches only the import itself', () => {
  const aliases = [{ find: 'i18n', replacement: '/app/i18n.ts', exact: true }];
  expect(applyAliases('i18n', aliases)).toBe('/app/i18n.ts');
  expect(applyAliases('i18n/messages.js', aliases)).toBe('i18n/messages.js');
});

test('a RegExp alias replaces what it matches, with its groups', () => {
  const aliases = [{ find: /^~msg\/(.*)$/, replacement: '/app/paraglide/$1' }];
  expect(applyAliases('~msg/messages.js', aliases)).toBe(
    '/app/paraglide/messages.js'
  );
  expect(applyAliases('./~msg/messages.js', aliases)).toBe(
    './~msg/messages.js'
  );
});

test('the first alias that matches wins', () => {
  const aliases = [
    { find: '@/i18n', replacement: '/app/translations' },
    { find: '@', replacement: '/app/src' },
  ];
  expect(applyAliases('@/i18n/a.js', aliases)).toBe('/app/translations/a.js');
  expect(applyAliases('@/b.js', aliases)).toBe('/app/src/b.js');
});

test('aliasEntries takes a record or a list', () => {
  expect(aliasEntries({ '~': '/app/src' })).toEqual([
    { find: '~', replacement: '/app/src' },
  ]);
  const list = [{ find: /^~/, replacement: '/app/src' }];
  expect(aliasEntries(list)).toEqual(list);
  expect(aliasEntries()).toEqual([]);
});
