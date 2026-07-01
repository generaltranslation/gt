import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResourceCache } from '../ResourceCache';

describe('ResourceCache', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ttl 0 expires immediately without reading the current time', async () => {
    const nowSpy = vi.spyOn(Date, 'now');
    const cache = new ResourceCache({
      ttl: 0,
      load: async () => 'loaded',
    });

    await expect(cache.getOrLoad('key')).resolves.toBe('loaded');
    expect(cache.get('key')).toBeUndefined();
    expect(nowSpy).not.toHaveBeenCalled();
  });
});
