import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeSvelteSource } from '@generaltranslation/svelte-extractor';
import type { Content } from '@generaltranslation/format';
import { parse } from 'svelte/compiler';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  loadTranslations,
  type GTTranslationsData,
} from '../src/runtime/config';
import { setupRuntimeTranslation, withoutComments } from './helpers';
import { createServerRenderer, type ServerRenderer } from './ssr';

const [greeting] = analyzeSvelteSource(
  readFileSync(
    join(process.cwd(), '__tests__/fixtures/Greeting.svelte'),
    'utf8'
  ),
  { parse }
).translations;

const translate = (source: Content): Content =>
  typeof source === 'string'
    ? `[fr] ${source}`
    : ['Bonjour ', { t: 'b', i: 1, c: [{ i: 2, k: '_gt_value_2', v: 'v' }] }];

let server: ServerRenderer;
beforeAll(async () => {
  // gtPreprocess() and the runtime both read NODE_ENV.
  vi.stubEnv('NODE_ENV', 'development');
  server = await createServerRenderer();
});
afterAll(async () => {
  await server?.close();
  vi.unstubAllEnvs();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.stubEnv('NODE_ENV', 'development');
});

// Like a SvelteKit load function: each render gets freshly loaded translations.
const render = async (
  fixture: string,
  props: Record<string, unknown> = {},
  gt?: GTTranslationsData
) =>
  withoutComments(
    await server.render(fixture, {
      props,
      ...(gt ?? (await loadTranslations('fr'))),
    })
  ).trim();

describe('dev hot reload', () => {
  it('requests a missing <T> translation once, with its source', async () => {
    const requests = setupRuntimeTranslation(translate);
    const source = 'Hello <b class="x" title="Bold">dear Ada</b>!';

    expect(await render('Greeting.svelte', { name: 'Ada' })).toBe(source);
    expect(await render('Greeting.svelte', { name: 'Ada' })).toBe(source);

    await vi.waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]).toEqual({
      source: greeting.source,
      metadata: {
        hash: greeting.hash,
        context: 'greeting',
        dataFormat: 'JSX',
      },
    });
    await vi.waitFor(async () =>
      expect(await render('Greeting.svelte', { name: 'Ada' })).toBe(
        'Bonjour <b class="x" title="Bold">Ada</b>'
      )
    );
  });

  it('renders only the loaded translations, not one that arrived after loading', async () => {
    setupRuntimeTranslation(translate);
    const gt = await loadTranslations('fr');

    await render('Greeting.svelte', { name: 'Ada' });
    await vi.waitFor(async () =>
      expect(await render('Greeting.svelte', { name: 'Ada' })).toBe(
        'Bonjour <b class="x" title="Bold">Ada</b>'
      )
    );

    expect(await render('Greeting.svelte', { name: 'Ada' }, gt)).toBe(
      'Hello <b class="x" title="Bold">dear Ada</b>!'
    );
  });

  it('keeps the source and logs a failed request once, then retries', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setupRuntimeTranslation(translate);
    const answer = globalThis.fetch;
    let failures = 0;
    vi.stubGlobal('fetch', async () => {
      failures += 1;
      throw new Error('offline');
    });
    const source = 'Hello <b class="x" title="Bold">dear Ada</b>!';

    for (const attempt of [1, 2]) {
      expect(await render('Greeting.svelte', { name: 'Ada' })).toBe(source);
      await vi.waitFor(() => expect(failures).toBe(attempt));
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toContain('offline');

    vi.stubGlobal('fetch', answer);
    expect(await render('Greeting.svelte', { name: 'Ada' })).toBe(source);
    await vi.waitFor(async () =>
      expect(await render('Greeting.svelte', { name: 'Ada' })).toBe(
        'Bonjour <b class="x" title="Bold">Ada</b>'
      )
    );
    warn.mockRestore();
  });

  it('requests missing strings', async () => {
    const requests = setupRuntimeTranslation(translate);

    expect(await render('Strings.svelte')).toContain('Hello, Ada!');

    await vi.waitFor(() =>
      expect(requests.map((request) => request.source)).toEqual([
        'Hello, {name}!',
        'Saved',
      ])
    );
    await vi.waitFor(async () => {
      const html = await render('Strings.svelte');
      expect(html).toContain('[fr] Hello, Ada!');
      expect(html).toContain('[fr] Saved');
    });
  });

  it('requests nothing in production', async () => {
    const requests = setupRuntimeTranslation(translate);
    vi.stubEnv('NODE_ENV', 'production');

    await render('Greeting.svelte', { name: 'Ada' });
    await render('Strings.svelte');
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(requests).toEqual([]);
  });
});
