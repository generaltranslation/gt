import { beforeEach, describe, expect, it, vi } from 'vitest';

const clack = vi.hoisted(() => ({
  text: vi.fn(),
  select: vi.fn(),
  confirm: vi.fn(),
  multiselect: vi.fn(),
  isCancel: vi.fn(() => false),
  cancel: vi.fn(),
  log: {
    message: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    step: vi.fn(),
  },
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    message: vi.fn(),
    isCancelled: false,
  })),
  progress: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    message: vi.fn(),
    advance: vi.fn(),
    isCancelled: false,
  })),
  intro: vi.fn(),
  outro: vi.fn(),
}));

vi.mock('@clack/prompts', () => clack);

describe('logging prompt fallback', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.GT_INK = '0';
  });

  it('uses clack and validates locale multi-select input when Ink is disabled', async () => {
    clack.text.mockResolvedValueOnce('es\tfr\n de');
    const { promptLocaleList } = await import('../logging.js');

    await expect(
      promptLocaleList({
        message: 'Locales?',
        defaultValue: ['es'],
      })
    ).resolves.toEqual(['es', 'fr', 'de']);

    const validate = clack.text.mock.calls[0]?.[0].validate;
    expect(validate('es fr')).toBeUndefined();
    expect(validate('es not_a_locale')).toBe(
      'Enter a valid locale (e.g., es fr de)'
    );
  });

  it('uses clack and validates default locale input when Ink is disabled', async () => {
    clack.text.mockResolvedValueOnce('en');
    const { promptLocale } = await import('../logging.js');

    await expect(
      promptLocale({
        message: 'Default locale?',
        defaultValue: 'en',
      })
    ).resolves.toBe('en');

    const validate = clack.text.mock.calls[0]?.[0].validate;
    expect(validate('en')).toBeUndefined();
    expect(validate('not_a_locale')).toBe('Enter a valid locale (e.g., en)');
  });
});
