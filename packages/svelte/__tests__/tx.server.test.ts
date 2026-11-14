import { render } from 'svelte/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadTranslations } from '../src/runtime/config';
import { tx } from '../src/runtime/tx';
import Harness from './fixtures/Harness.svelte';
import Strings from './fixtures/Strings.svelte';
import { setupRuntimeTranslation, withoutComments } from './helpers';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('tx', () => {
  it('translates at runtime in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const requests = setupRuntimeTranslation((source) => `[fr] ${source}`);

    expect(
      await tx('Hello, {name}!', { $locale: 'fr', $format: 'ICU', name: 'Ada' })
    ).toBe('[fr] Hello, Ada!');
    expect(requests).toMatchObject([
      { source: 'Hello, {name}!', metadata: { dataFormat: 'ICU' } },
    ]);
  });

  it('returns the message for an unsupported locale without a request', async () => {
    const requests = setupRuntimeTranslation((source) => `[fr] ${source}`);

    expect(await tx('Saved', { $locale: 'de' })).toBe('Saved');
    expect(requests).toEqual([]);
  });

  it('leaves the server render to the translations loaded before it', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    setupRuntimeTranslation((source) => `[fr] ${source}`);
    const gt = await loadTranslations('fr');

    await tx('Saved', { $locale: 'fr', $format: 'ICU' });

    expect(
      withoutComments(
        render(Harness, { props: { component: Strings, ...gt } }).body
      )
    ).toContain('<p class="msg">Saved</p>');
  });
});
