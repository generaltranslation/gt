import { describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';

const mockParseLocale = vi.hoisted(() => vi.fn());

vi.mock('../../functions/parseLocale', () => ({
  parseLocale: (...args: unknown[]) => mockParseLocale(...args),
}));

import { GTProvider } from '../GTProvider.server';

describe('GTProvider', () => {
  it('uses the server request locale for SSR provider state', () => {
    mockParseLocale.mockReturnValue('fr');

    const element = GTProvider({
      locale: 'en',
      translations: {},
      dictionaries: {},
      children: 'content',
    }) as ReactElement<{ locale: string }>;

    expect(element.props.locale).toBe('fr');
  });
});
