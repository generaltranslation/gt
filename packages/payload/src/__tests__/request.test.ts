import type { PayloadUser } from '../user';
import type { Payload } from 'payload';
import { afterEach, describe, expect, it, vi } from 'vitest';

const payload = {} as Payload;
const user = { id: 'editor', collection: 'users' } as PayloadUser;

afterEach(() => {
  vi.doUnmock('payload');
  vi.resetModules();
});

describe('Payload request compatibility', () => {
  it('loads with only the v4 helper and preserves the signed-in user', async () => {
    const req = { payload, user };
    const createPayloadRequest = vi.fn().mockResolvedValue(req);
    vi.doMock('payload', () => ({ createPayloadRequest }));
    const { createRequest, translationsView } = await import('../request');
    expect(await createRequest(payload, user)).toBe(req);
    expect(createPayloadRequest).toHaveBeenCalledWith({ payload, user });
    expect(translationsView).toBe('gt-payload/rsc-v4#GtTranslationsView');
  });

  it('prefers the local helper when v3 also exposes its HTTP request helper', async () => {
    const req = { payload, user };
    const createLocalReq = vi.fn().mockResolvedValue(req);
    const createPayloadRequest = vi.fn();
    vi.doMock('payload', () => ({ createLocalReq, createPayloadRequest }));
    const { createRequest, translationsView } = await import('../request');
    expect(await createRequest(payload, user)).toBe(req);
    expect(createLocalReq).toHaveBeenCalledWith({ user }, payload);
    expect(translationsView).toBe('gt-payload/rsc#GtTranslationsView');
    expect(createPayloadRequest).not.toHaveBeenCalled();
  });

  it('loads with only the v3 helper and preserves the signed-in user', async () => {
    const req = { payload, user };
    const createLocalReq = vi.fn().mockResolvedValue(req);
    vi.doMock('payload', () => ({ createLocalReq }));
    const { createRequest, translationsView } = await import('../request');
    expect(await createRequest(payload, user)).toBe(req);
    expect(createLocalReq).toHaveBeenCalledWith({ user }, payload);
    expect(translationsView).toBe('gt-payload/rsc#GtTranslationsView');
  });
});
