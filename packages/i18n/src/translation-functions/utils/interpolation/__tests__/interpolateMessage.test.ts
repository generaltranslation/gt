import { describe, expect, it, vi } from 'vitest';
import { interpolateMessage } from '../interpolateMessage';
import { getI18nManager } from '../../../../i18n-manager/singleton-operations';

vi.mock('../../../../i18n-manager/singleton-operations', () => ({
  getI18nManager: vi.fn(),
}));

describe('interpolateMessage', () => {
  it('formats missing translation fallback with the source locale', () => {
    vi.mocked(getI18nManager).mockReturnValue({
      getDefaultLocale: () => 'en',
    } as ReturnType<typeof getI18nManager>);

    expect(
      interpolateMessage({
        source: 'Value {n, number}',
        target: undefined,
        options: {
          $format: 'ICU',
          $locale: 'fr',
          n: 1234.5,
        },
      })
    ).toBe('Value 1,234.5');
  });
});
