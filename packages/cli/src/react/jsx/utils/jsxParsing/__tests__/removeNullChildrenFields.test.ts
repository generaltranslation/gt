import { describe, it, expect } from 'vitest';
import { removeNullChildrenFields } from '../removeNullChildrenFields.js';
import type { JsxChildren } from '@generaltranslation/format/types';

describe('removeNullChildrenFields', () => {
  // Inputs include null/undefined fields that the JsxChildren type forbids
  it.each<[string, unknown, unknown]>([
    ['keeps a string', 'Hello world', 'Hello world'],
    ['keeps an empty string', '', ''],
    ['keeps false', false, false],
    ['keeps true', true, true],
    ['keeps null', null, null],
    [
      'keeps an array of strings',
      ['Hello', ' ', 'world'],
      ['Hello', ' ', 'world'],
    ],
    ['keeps an empty array', [], []],
    ['drops null entries of an array', ['a', null, undefined, 'b'], ['a', 'b']],
    ['keeps a variable', { k: 'count' }, { k: 'count' }],
    ['removes a null c', { t: 'div', c: null }, { t: 'div' }],
    ['removes an undefined c', { t: 'div', c: undefined }, { t: 'div' }],
    ['removes a null d', { t: 'div', d: null }, { t: 'div' }],
    [
      'keeps every non-null field',
      { t: 'div', i: 123, d: { pl: 'Enter text' }, c: 'Hello world' },
      { t: 'div', i: 123, d: { pl: 'Enter text' }, c: 'Hello world' },
    ],
    [
      'removes only the null fields',
      { t: 'div', i: null, d: { pl: 'Enter text' }, c: undefined },
      { t: 'div', d: { pl: 'Enter text' } },
    ],
    [
      'keeps falsy values that are not null',
      { t: '', i: 0, c: '' },
      { t: '', i: 0, c: '' },
    ],
    [
      'empties an element with only null fields',
      { t: null, i: null, d: null, c: null },
      {},
    ],
    ['keeps an empty element', {}, {}],
    [
      'keeps branches and the branch type',
      {
        t: 'div',
        d: { b: { case1: 'First case', case2: 'Second case' }, t: 'b' },
      },
      {
        t: 'div',
        d: { b: { case1: 'First case', case2: 'Second case' }, t: 'b' },
      },
    ],
    [
      'cleans elements inside branches',
      {
        t: 'div',
        d: {
          b: {
            case1: { t: 'span', c: null },
            case2: { t: 'strong', c: 'text' },
          },
        },
      },
      {
        t: 'div',
        d: { b: { case1: { t: 'span' }, case2: { t: 'strong', c: 'text' } } },
      },
    ],
    [
      'keeps HTML content props',
      {
        t: 'input',
        d: { pl: 'Enter your name', ti: 'Name field', alt: 'Name input' },
      },
      {
        t: 'input',
        d: { pl: 'Enter your name', ti: 'Name field', alt: 'Name input' },
      },
    ],
    [
      'cleans nested children',
      {
        t: 'div',
        c: [
          { t: 'span', c: null },
          { t: 'p', c: 'text' },
          { t: 'div', c: [{ t: 'strong', c: undefined }] },
        ],
      },
      {
        t: 'div',
        c: [
          { t: 'span' },
          { t: 'p', c: 'text' },
          { t: 'div', c: [{ t: 'strong' }] },
        ],
      },
    ],
    [
      'cleans a chain of single children',
      { t: 'div', c: { t: 'section', c: { t: 'article', c: null } } },
      { t: 'div', c: { t: 'section', c: { t: 'article' } } },
    ],
    [
      'cleans children, branches and content props together',
      [
        'Text before',
        {
          t: 'div',
          i: 1,
          d: {
            b: { case1: [{ t: 'span', c: null }, 'text'] },
            pl: { t: 'input', c: undefined },
          },
          c: [
            { t: 'p', c: null },
            'Some text',
            { t: 'strong', c: 'bold text' },
          ],
        },
        'Text after',
      ],
      [
        'Text before',
        {
          t: 'div',
          i: 1,
          d: {
            b: { case1: [{ t: 'span' }, 'text'] },
            pl: { t: 'input', c: undefined },
          },
          c: [{ t: 'p' }, 'Some text', { t: 'strong', c: 'bold text' }],
        },
        'Text after',
      ],
    ],
  ])('%s', (_name, input, expected) => {
    expect(removeNullChildrenFields(input as JsxChildren)).toStrictEqual(
      expected
    );
  });
});
