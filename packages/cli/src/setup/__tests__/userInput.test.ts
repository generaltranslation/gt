import { beforeEach, describe, expect, it, vi } from 'vitest';
import { promptLocale, promptLocaleList } from '../../console/logging.js';
import { getDesiredLocales } from '../userInput.js';

vi.mock('../../console/logging.js', () => ({
  promptLocale: vi.fn(),
  promptLocaleList: vi.fn(),
}));

describe('getDesiredLocales', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preserves configured locales without prompting', async () => {
    await expect(
      getDesiredLocales({ defaultLocale: 'es', locales: ['fr', 'de'] })
    ).resolves.toEqual({ defaultLocale: 'es', locales: ['fr', 'de'] });
    expect(promptLocale).not.toHaveBeenCalled();
    expect(promptLocaleList).not.toHaveBeenCalled();
  });
});
