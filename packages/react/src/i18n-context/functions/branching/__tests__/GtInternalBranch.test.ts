import { describe, expect, it } from 'vitest';
import { Branch } from '../GtInternalBranch';

describe('Branch', () => {
  it('renders the matching branch', () => {
    expect(
      Branch({
        children: 'fallback',
        branch: 'enabled',
        enabled: 'enabled branch',
      })
    ).toBe('enabled branch');
  });

  it('ignores data-* branch values', () => {
    expect(
      Branch({
        children: 'fallback',
        branch: 'data-_gt',
        'data-_gt': 'metadata',
      })
    ).toBe('fallback');
  });
});
