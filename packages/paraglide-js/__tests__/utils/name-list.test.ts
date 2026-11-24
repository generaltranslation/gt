import { expect, test } from 'vitest';
import {
  hasName,
  nameList,
  namesIn,
} from '../../src/compiler/utils/name-list.js';

test('has exactly the names it was made of', () => {
  const list = nameList(['show', 'Label', 'default']);

  expect(namesIn(list)).toEqual(['show', 'Label', 'default']);
  expect(hasName(list, 'show')).toBe(true);
  expect(hasName(list, 'default')).toBe(true);
  // Not a part of a name, nor names run together.
  expect(hasName(list, 'sho')).toBe(false);
  expect(hasName(list, 'howLabel')).toBe(false);
  expect(hasName(list, 'Label\0default')).toBe(false);
  expect(hasName(list, '')).toBe(false);
});

test('is empty without names', () => {
  const list = nameList([]);

  expect(namesIn(list)).toEqual([]);
  expect(hasName(list, '')).toBe(false);
});

test('leaves out a name that holds the separator', () => {
  const list = nameList(['a\0b', 'c']);

  expect(namesIn(list)).toEqual(['c']);
  expect(hasName(list, 'a')).toBe(false);
  expect(hasName(list, 'b')).toBe(false);
});
