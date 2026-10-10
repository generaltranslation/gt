// A lock only one holder can take at a time, on any database Payload uses.
import type { Payload } from 'payload';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { acquireLock, releaseLock, renewLock } from '../locks';
import { gtPlugin } from '../plugin';
import { createTestPayload } from './support/createTestPayload';
import { FakeGt } from './support/fakeGt';

let payload: Payload;

beforeAll(async () => {
  payload = await createTestPayload([gtPlugin({ client: new FakeGt() })]);
});

afterAll(async () => {
  await payload.destroy();
});

describe('locks', () => {
  it('gives the lock to exactly one of many takers at once', async () => {
    const tokens = await Promise.all(
      Array.from({ length: 10 }, () => acquireLock(payload, 'run:a', 60_000))
    );

    expect(tokens.filter(Boolean)).toHaveLength(1);
  });

  it('lets the lock be taken again once released', async () => {
    const token = await acquireLock(payload, 'run:b', 60_000);
    expect(await acquireLock(payload, 'run:b', 60_000)).toBeNull();
    await releaseLock(payload, 'run:b', token!);

    expect(await acquireLock(payload, 'run:b', 60_000)).toBeTruthy();
  });

  it('lets an expired lock be taken over by one taker', async () => {
    await acquireLock(payload, 'run:c', 1_000);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 5_000);
    const tokens = await Promise.all(
      Array.from({ length: 5 }, () => acquireLock(payload, 'run:c', 60_000))
    );
    vi.useRealTimers();

    expect(tokens.filter(Boolean)).toHaveLength(1);
  });

  it('does not let a holder release a lock it no longer holds', async () => {
    const stale = await acquireLock(payload, 'run:d', 1_000);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 5_000);
    const current = await acquireLock(payload, 'run:d', 60_000);
    await releaseLock(payload, 'run:d', stale!);
    vi.useRealTimers();

    expect(current).toBeTruthy();
    expect(await acquireLock(payload, 'run:d', 60_000)).toBeNull();
  });

  it('does not renew a lock another taker holds now', async () => {
    const stale = await acquireLock(payload, 'run:e', 1_000);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 5_000);
    expect(await acquireLock(payload, 'run:e', 60_000)).toBeTruthy();
    vi.useRealTimers();

    expect(await renewLock(payload, 'run:e', stale!, 60_000)).toBe(false);
  });

  it('does not count an update that found no row as a renewal', async () => {
    const token = await acquireLock(payload, 'run:f', 60_000);
    await releaseLock(payload, 'run:f', token!);
    await acquireLock(payload, 'run:f', 60_000);
    const updateMany = vi
      .spyOn(payload.db, 'updateMany')
      .mockResolvedValueOnce([null as never]);

    expect(await renewLock(payload, 'run:f', token!, 60_000)).toBe(false);
    updateMany.mockRestore();
  });

  it('renews a lock the token still holds', async () => {
    const token = await acquireLock(payload, 'run:g', 60_000);

    expect(await renewLock(payload, 'run:g', token!, 60_000)).toBe(true);
  });
});
