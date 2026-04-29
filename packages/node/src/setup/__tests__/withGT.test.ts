import { describe, expect, it, beforeEach } from 'vitest';
import { getLocale } from '../../helpers';
import { initializeGT } from '../initializeGT';
import { withGT } from '../withGT';

describe('withGT', () => {
  beforeEach(() => {
    initializeGT({
      defaultLocale: 'en-US',
      locales: ['en-US', 'fr', 'es'],
    });
  });

  it('sets the current locale for the callback context', () => {
    const locale = withGT('fr', () => getLocale());

    expect(locale).toBe('fr');
  });

  it('preserves the current locale through async work', async () => {
    const locale = await withGT('es', async () => {
      await Promise.resolve();
      return getLocale();
    });

    expect(locale).toBe('es');
  });
});
