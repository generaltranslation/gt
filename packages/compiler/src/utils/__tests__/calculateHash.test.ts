import { describe, it, expect } from 'vitest';
import { hashSource as sharedHashSource } from 'generaltranslation/id';
import type { JsxChildren } from '@generaltranslation/format';
import hashSource from '../calculateHash';

describe('calculateHash', () => {
  it.each(['ICU', 'I18NEXT'] as const)(
    'delegates %s strings to the shared hasher with every hashed option',
    (dataFormat) => {
      const params = {
        source: 'Hello world',
        context: 'greeting',
        maxChars: 20,
        requiresReview: true,
        dataFormat,
      };
      expect(hashSource(params)).toBe(sharedHashSource(params));
      for (const option of ['context', 'maxChars', 'requiresReview']) {
        expect(hashSource({ ...params, [option]: undefined })).not.toBe(
          hashSource(params)
        );
      }
    }
  );

  // it.each spreads array rows, so each source is wrapped in a { source } case
  const cases = (sources: JsxChildren[]) =>
    sources.map((source) => ({ source }));

  it.each(
    cases([
      false,
      true,
      null,
      'Hello world',
      [],
      { t: 'span', c: false },
      { t: 'Branch', d: { t: 'b', b: { active: false } } },
      [{ t: 'br' }],
      [{ k: 'name' }],
      [{ k: 'name', i: 1 }],
      [{ k: 'name', v: 'v' }],
      [{ k: 'name', v: 'v', i: 1 }],
      [{ t: 'div', c: [{ t: 'span', c: ['Hello ', { k: 'name' }] }, '!'] }],
    ] as JsxChildren[])
  )(
    'delegates JSX $source without static variables to the shared hasher',
    ({ source }) => {
      const params = {
        source,
        context: 'greeting',
        dataFormat: 'JSX' as const,
      };
      expect(hashSource(params)).toBe(sharedHashSource(params));
      expect(hashSource(params)).not.toBe('');
    }
  );

  // A static (derive) variable means the CLI resolves the variants, so no
  // single hash exists at compile time.
  it.each(
    cases([
      [{ k: 'staticVar', v: 's' }],
      [{ k: 'staticVar', v: 's', i: 1 }],
      ['Hello ', { k: 'staticVar', v: 's' }, '!'],
      [
        {
          t: 'div',
          c: [{ t: 'span', c: ['Text ', { k: 'staticVar', v: 's' }] }],
        },
      ],
      [
        {
          t: 'div',
          d: {
            t: 'p',
            b: {
              one: ['One item'],
              other: ['Multiple ', { k: 'staticVar', v: 's' }],
            },
          },
        },
      ],
    ] as JsxChildren[])
  )('returns an empty hash for JSX $source', ({ source }) => {
    expect(hashSource({ source, dataFormat: 'JSX' })).toBe('');
  });
});
