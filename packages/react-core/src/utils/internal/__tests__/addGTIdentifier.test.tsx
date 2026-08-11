import { describe, expect, it } from 'vitest';
import {
  GtInternalRelativeTime,
  RelativeTime,
} from '../../../components/variables/RelativeTime';
import { addGTIdentifier } from '../addGTIdentifier';
import type { TaggedElement } from '../../types';

describe('addGTIdentifier', () => {
  it.each([
    ['manual', <RelativeTime name='offset' value={3} unit='day' />],
    [
      'automatic',
      <GtInternalRelativeTime name='offset' value={3} unit='day' />,
    ],
  ])(
    'preserves the hyphenated relative-time variable type for %s JSX',
    (injectionType, element) => {
      const tagged = addGTIdentifier(element) as TaggedElement;

      expect(tagged.props['data-_gt']).toMatchObject({
        injectionType,
        transformation: 'variable',
        variableType: 'relative-time',
      });
    }
  );
});
