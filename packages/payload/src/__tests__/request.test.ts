import type { Payload, TypedUser } from 'payload';
import { afterEach, describe, expect, it, vi } from 'vitest';

const payload = {} as Payload;
const user = { id: 'editor', collection: 'users' } as TypedUser;

afterEach(() => {
  vi.doUnmock('payload');
  vi.resetModules();
});

describe('Payload request compatibility', () => {
  it('loads with only the v4 helper and preserves the signed-in user', async () => {
    const req = { payload, user };
    const createPayloadRequest = vi.fn().mockResolvedValue(req);
    vi.doMock('payload', () => ({ createPayloadRequest }));
    const { createRequest } = await import('../request');
    expect(await createRequest(payload, user)).toBe(req);
    expect(createPayloadRequest).toHaveBeenCalledWith({ payload, user });
  });

  it('prefers the local helper when v3 also exposes its HTTP request helper', async () => {
    const req = { payload, user };
    const createLocalReq = vi.fn().mockResolvedValue(req);
    const createPayloadRequest = vi.fn();
    vi.doMock('payload', () => ({ createLocalReq, createPayloadRequest }));
    const { createRequest } = await import('../request');
    expect(await createRequest(payload, user)).toBe(req);
    expect(createLocalReq).toHaveBeenCalledWith({ user }, payload);
    expect(createPayloadRequest).not.toHaveBeenCalled();
  });

  it('loads with only the v3 helper and preserves the signed-in user', async () => {
    const req = { payload, user };
    const createLocalReq = vi.fn().mockResolvedValue(req);
    vi.doMock('payload', () => ({ createLocalReq }));
    const { createRequest } = await import('../request');
    expect(await createRequest(payload, user)).toBe(req);
    expect(createLocalReq).toHaveBeenCalledWith({ user }, payload);
  });
});
