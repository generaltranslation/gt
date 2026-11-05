import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    vi.stubEnv('GT_LOG_FORMAT', 'default');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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
    // Clack hides options whose label does not match the search.
    expect(
      options.find((option: { label: string }) => option.label.includes('fr'))
    ).toMatchObject({ value: 'fr' });
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

  // Drives the real Clack prompt through injected streams.
  async function withRealClack(
    prompt: 'text' | 'autocomplete' | 'autocompleteMultiselect',
    size?: { columns: number; rows: number }
  ) {
    const actual =
      await vi.importActual<typeof import('@clack/prompts')>('@clack/prompts');
    const input = new PassThrough();
    const output = Object.assign(new PassThrough(), size);
    let rendered = '';
    output.on('data', (chunk) => (rendered += chunk));
    clack[prompt].mockImplementationOnce((options: never) =>
      (actual[prompt] as (options: object) => unknown)({
        ...(options as object),
        input,
        output,
      })
    );
    const type = async (keys: string) => {
      input.write(keys);
      await new Promise((resolve) => setTimeout(resolve, 20));
    };
    return { type, rendered: () => rendered };
  }

  it('keeps the real single-locale prompt open until a locale is selected', async () => {
    const { type, rendered } = await withRealClack('autocomplete');
    const { promptLocale } = await import('../logging.js');
    let submitted: unknown = 'pending';
    const answer = promptLocale({ message: 'Default?' }).then((value) => {
      submitted = value;
      return value;
    });

    // No option matches, so Enter submits nothing.
    await type('not_a_locale');
    await type('\r');
    expect(submitted).toBe('pending');
    expect(rendered()).toContain('No locale matches the search.');

    await type('\x15'); // Ctrl+U clears the search
    await type('french');
    await type('\r');
    await expect(answer).resolves.toBe('fr');
  });

  it('focuses the exact locale code after the search changes', async () => {
    // `af  Afrikaans` is focused first and also matches `f` and `fr`.
    const single = await withRealClack('autocomplete');
    const { promptLocale, promptLocaleList } = await import('../logging.js');
    const locale = promptLocale({ message: 'Default?' });
    await single.type('fr');
    await single.type('\r');
    await expect(locale).resolves.toBe('fr');

    const multi = await withRealClack('autocompleteMultiselect');
    const locales = promptLocaleList({ message: 'Locales?' });
    await multi.type('fr');
    await multi.type('\t');
    await multi.type('\r');
    await expect(locales).resolves.toEqual(['fr']);
  });

  it.each([undefined, { french: { code: 'fr' } }])(
    'prioritizes exact codes over overlapping custom defaults and aliases %j',
    async (customMapping) => {
      const { type } = await withRealClack('autocompleteMultiselect');
      const { promptLocaleList } = await import('../logging.js');
      const locales = promptLocaleList({
        message: 'Locales?',
        defaultValue: ['es', 'fr-MX'],
        customMapping,
      });
      await type('f');
      await type('r');
      await type('\t');
      await type('\r');
      await expect(locales).resolves.toEqual(['es', 'fr-MX', 'fr']);
    }
  );

  it.each(['fr-MX', 'french'])(
    'allows intentionally deselecting the exact custom option %s',
    async (value) => {
      const { type } = await withRealClack('autocompleteMultiselect');
      const { promptLocaleList } = await import('../logging.js');
      const locales = promptLocaleList({
        message: 'Locales?',
        defaultValue: ['es', value],
        customMapping: { french: { code: 'fr' } },
      });
      await type(value);
      await type('\t');
      await type('\r');
      await expect(locales).resolves.toEqual(['es']);
    }
  );

  it('preserves arrow navigation after an exact search', async () => {
    const { type } = await withRealClack('autocomplete');
    const { promptLocale } = await import('../logging.js');
    const locale = promptLocale({
      message: 'Default?',
      customMapping: { french: { code: 'fr' } },
    });
    await type('fr');
    await type('\x1b[B');
    await type('\r');
    await expect(locale).resolves.toBe('french');
  });

  it('submits existing multiselect choices with an unmatched search', async () => {
    const { type } = await withRealClack('autocompleteMultiselect');
    const { promptLocaleList } = await import('../logging.js');
    const locales = promptLocaleList({
      message: 'Locales?',
      defaultValue: ['es'],
    });
    await type('not_a_locale');
    await type('\r');
    await expect(locales).resolves.toEqual(['es']);
  });

  it('preselects custom locale defaults in the real multiselect', async () => {
    const { type } = await withRealClack('autocompleteMultiselect');
    const { promptLocaleList } = await import('../logging.js');
    const locales = promptLocaleList({
      message: 'Locales?',
      defaultValue: ['es', 'zh-Hans-CN'],
    });
    await type('\r');
    await expect(locales).resolves.toEqual(['es', 'zh-Hans-CN']);
  });

  describe.each([
    { columns: 100, rows: 30 },
    { columns: 60, rows: 24 },
  ])('in a $columns x $rows terminal', (size) => {
    const stdoutSize = Object.getOwnPropertyDescriptors(process.stdout);
    beforeEach(() => {
      // Clack wraps each frame to process.stdout, whatever the output stream.
      Object.defineProperty(process.stdout, 'columns', {
        configurable: true,
        value: size.columns,
      });
      Object.defineProperty(process.stdout, 'rows', {
        configurable: true,
        value: size.rows,
      });
    });
    afterEach(() => {
      for (const key of ['columns', 'rows'] as const) {
        if (stdoutSize[key]) {
          Object.defineProperty(process.stdout, key, stdoutSize[key]);
        } else {
          delete (process.stdout as { [key: string]: unknown })[key];
        }
      }
    });

    it.each(['autocomplete', 'autocompleteMultiselect'] as const)(
      'redraws the %s locale prompt in place while searching',
      async (kind) => {
        const { type, rendered } = await withRealClack(kind, size);
        const { promptLocale, promptLocaleList } =
          await import('../logging.js');
        const answer =
          kind === 'autocomplete'
            ? promptLocale({
                message: 'What is the default locale for your project?',
              })
            : promptLocaleList({
                message:
                  'Which languages would you like to translate your project into?',
              });

        for (const keys of ['', 'e', 's', '\x7f', '\x7f', 'fr', '\x15unidos']) {
          await type(keys);
          const { scrollback, screen } = replayTerminal(rendered(), size);
          // A frame taller than the terminal scrolls, and Clack then redraws
          // below stale copies of earlier frames.
          expect(scrollback).toEqual([]);
          expect(
            screen.filter((line) => line.includes('Search:'))
          ).toHaveLength(1);
          expect(screen.length).toBeLessThanOrEqual(size.rows);
        }

        await type('\t');
        await type('\r');
        await expect(answer).resolves.toEqual(
          kind === 'autocomplete' ? 'es-US' : ['es-US']
        );
      }
    );
  });

  it('accepts the suggested text default when Enter is pressed', async () => {
    const { type } = await withRealClack('text');
    const { promptText } = await import('../logging.js');
    const name = promptText({
      message: 'Project name?',
      defaultValue: 'my-app',
      validate: (value) => (value.trim() ? true : 'Enter a project name'),
    });
    await type('\r');
    await expect(name).resolves.toBe('my-app');
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

/**
 * Replays prompt output on a terminal of the given size, handling the cursor
 * and erase sequences Clack writes. Like a real terminal, the cursor cannot
 * move above the top row and writing past the bottom row scrolls lines away.
 */
function replayTerminal(
  output: string,
  { columns, rows }: { columns: number; rows: number }
) {
  const lines: string[][] = [[]];
  let top = 0;
  let y = 0;
  let x = 0;
  const lineFeed = () => {
    y++;
    x = 0;
    lines[y] ??= [];
    if (y - top >= rows) top = y - rows + 1;
  };
  // eslint-disable-next-line no-control-regex
  const tokens = output.match(/\u001b\[[?0-9;]*[A-Za-z]|\r?\n|\r|[^]/gu) ?? [];
  for (const token of tokens) {
    // eslint-disable-next-line no-control-regex
    const csi = /^\u001b\[([?0-9;]*)([A-Za-z])$/.exec(token);
    if (csi) {
      const count = Number(csi[1]) || 1;
      if (csi[2] === 'A') y = Math.max(top, y - count);
      if (csi[2] === 'B') {
        y = Math.min(top + rows - 1, y + count);
        for (let i = 0; i <= y; i++) lines[i] ??= [];
      }
      if (csi[2] === 'C') x += count;
      if (csi[2] === 'D') x = Math.max(0, x - count);
      if (csi[2] === 'G') x = 0;
      if (csi[2] === 'K') lines[y] = [];
      if (csi[2] === 'J') {
        lines[y] = lines[y].slice(0, x);
        lines.length = y + 1;
      }
    } else if (token === '\n' || token === '\r\n') {
      lineFeed();
    } else if (token === '\r') {
      x = 0;
    } else {
      if (x >= columns) lineFeed();
      lines[y][x++] = token;
    }
  }
  const text = lines.map((line) => Array.from(line, (c) => c ?? ' ').join(''));
  while (text.length > top + 1 && text[text.length - 1].trim() === '') {
    text.pop();
  }
  return { scrollback: text.slice(0, top), screen: text.slice(top) };
}
