import React from 'react';
import { describe, expect, it } from 'vitest';
import { prepareT } from '../prepareT.shared';
import type { JsxChildren } from 'generaltranslation/types';

describe('prepareT', () => {
  it('uses a provided source JSX payload for hashed cache lookups', () => {
    const sourceJsxChildren = '' as JsxChildren;
    const prepared = prepareT({
      sourceChildren: <span>Source</span>,
      params: { _hash: 'cached-hash' },
      locale: 'fr',
      sourceJsxChildren,
    });

    expect(prepared.sourceJsxChildren).toBe(sourceJsxChildren);
    expect(prepared.targetOptions).toMatchObject({
      $format: 'JSX',
      $locale: 'fr',
      $_hash: 'cached-hash',
    });
  });
});
