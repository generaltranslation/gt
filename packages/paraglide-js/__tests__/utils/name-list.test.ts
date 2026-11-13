import { expect, test } from 'vitest';
import {
  completeNameList,
  hasName,
  nameList,
  namesIn,
  shareNameLists,
  SharedNames,
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

test('a complete list is undefined if it would leave a name out', () => {
  expect(completeNameList(['a\0b', 'c'])).toBeUndefined();
  expect(namesIn(completeNameList(['a', 'c'])!)).toEqual(['a', 'c']);
});

test('has no name that holds the separator', () => {
  expect(hasName(nameList(['a', 'b']), 'a\0b')).toBe(false);
});

test('shared lists have the names of their own list only', () => {
  const lists = [
    nameList(['show', 'Label']),
    nameList([]),
    nameList(['größe', '名前', 'default']),
  ];
  const { bytes, places } = shareNameLists(lists);
  const names = new SharedNames(Buffer.from(bytes));

  expect(places.map((place) => names.names(place))).toEqual(lists.map(namesIn));
  expect(names.has(places[0]!, 'Label')).toBe(true);
  expect(names.has(places[2]!, '名前')).toBe(true);
  // Not in a list next to it, nor names run together across lists.
  expect(names.has(places[2]!, 'show')).toBe(false);
  expect(names.has(places[1]!, 'Label')).toBe(false);
  expect(names.has(places[0]!, 'Label\0größe')).toBe(false);
  // A list kept as a string reads the same.
  expect(names.has(lists[0]!, 'show')).toBe(true);
  expect(names.names(lists[2]!)).toEqual(['größe', '名前', 'default']);
});
