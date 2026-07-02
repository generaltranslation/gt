import { describe, it, expect, vi, afterEach } from 'vitest';
import { createFallbackTranslationLoader } from '../createFallbackTranslationLoader';

describe('createFallbackTranslationLoader', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns loader function', () => {
    const loader = createFallbackTranslationLoader();
    expect(typeof loader).toBe('function');
  });

  it('loader returns empty translations', async () => {
    const loader = createFallbackTranslationLoader();
    const result = await loader('en');
    expect(result).toEqual({});
  });

  it('does not warn when no warning is provided', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const loader = createFallbackTranslationLoader();
    await loader('en');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warns once on first invocation when a warning is provided', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const loader = createFallbackTranslationLoader('missing projectId');

    // Warning is deferred until the loader is actually invoked
    expect(warnSpy).not.toHaveBeenCalled();

    await loader('en');
    await loader('fr');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith('missing projectId');
  });
});
