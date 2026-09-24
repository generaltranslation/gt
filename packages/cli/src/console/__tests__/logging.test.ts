import { beforeEach, describe, expect, it, vi } from 'vitest';

const clack = vi.hoisted(() => ({
  text: vi.fn(),
  select: vi.fn(),
  confirm: vi.fn(),
  multiselect: vi.fn(),
  autocomplete: vi.fn(),
  autocompleteMultiselect: vi.fn(),
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

describe('logging prompts', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('searches locales through Clack autocomplete, ranking exact codes first', async () => {
    clack.autocompleteMultiselect.mockResolvedValueOnce(['es', 'fr']);
    const { promptLocaleList } = await import('../logging.js');

    await expect(
      promptLocaleList({ message: 'Locales?', defaultValue: ['es'] })
    ).resolves.toEqual(['es', 'fr']);

    const prompt = clack.autocompleteMultiselect.mock.calls[0]?.[0];
    expect(prompt).toMatchObject({ initialValues: ['es'], required: true });
    const options = prompt.options.call({
      userInput: 'fr',
      selectedValues: [],
    });
    expect(options[0]).toMatchObject({ value: 'fr' });
    expect(
      prompt.options
        .call({ userInput: 'fren', selectedValues: [] })
        .some((option: { value: string }) => option.value === 'fr')
    ).toBe(true);
  });

  it('keeps customMapping aliases and typed or selected locale tags selectable', async () => {
    clack.autocomplete.mockResolvedValueOnce('french');
    const { promptLocale, getLocalePromptOptions } =
      await import('../logging.js');
    const customMapping = { french: { code: 'fr' } };

    await expect(
      promptLocale({ message: 'Default?', defaultValue: 'en', customMapping })
    ).resolves.toBe('french');

    const prompt = clack.autocomplete.mock.calls[0]?.[0];
    expect(prompt.initialValue).toBe('en');
    expect(prompt.options.call({ userInput: 'fren' })[0]).toMatchObject({
      value: 'french',
    });
    const values = (query: string, selected: string[] = []) =>
      getLocalePromptOptions(query, selected, customMapping).map(
        (option) => option.value
      );
    expect(values('zh-Hans-CN')).toContain('zh-Hans-CN');
    expect(values('not_a_locale')).not.toContain('not_a_locale');
    expect(values('', ['zh-Hans-CN'])).toContain('zh-Hans-CN');
  });

  it('refuses to prompt once prompts are disabled', async () => {
    const { setPromptsDisabled, promptConfirm, promptLocale } =
      await import('../logging.js');
    setPromptsDisabled(true);

    await expect(promptConfirm({ message: 'Continue?' })).rejects.toThrow(
      'prompts are disabled'
    );
    await expect(promptLocale({ message: 'Default?' })).rejects.toThrow(
      'prompts are disabled'
    );
    expect(clack.confirm).not.toHaveBeenCalled();
    expect(clack.autocomplete).not.toHaveBeenCalled();
  });

  it('labels Vue and React inline catalogs without conflating frameworks', async () => {
    const { logCollectedFiles } = await import('../logging.js');

    logCollectedFiles(
      [{ fileName: '__INTERNAL_GT_TEMPLATE_NAME__' }],
      2,
      'gt-vue'
    );
    expect(clack.log.message).toHaveBeenLastCalledWith(
      expect.stringContaining('<Vue Elements> (2)'),
      undefined
    );

    logCollectedFiles(
      [{ fileName: '__INTERNAL_GT_TEMPLATE_NAME__' }],
      3,
      'gt-react'
    );
    expect(clack.log.message).toHaveBeenLastCalledWith(
      expect.stringContaining('<React Elements> (3)'),
      undefined
    );
  });
});
