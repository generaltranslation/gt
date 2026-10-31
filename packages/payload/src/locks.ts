// Locks only one holder can take at a time, on any database Payload uses:
// a lock is a document with a unique key, so of several takers creating it
// at once only one succeeds.
import { randomUUID } from 'node:crypto';
import { ValidationError } from 'payload';
import type { CollectionConfig, Payload, Where } from 'payload';

const LOCKS_SLUG = 'gt-translation-locks';

export const locksCollection: CollectionConfig = {
  slug: LOCKS_SLUG,
  admin: { hidden: true },
  // Read and written only through acquireLock and releaseLock.
  access: {
    read: () => false,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'key', type: 'text', required: true, unique: true, index: true },
    { name: 'token', type: 'text', required: true },
    { name: 'expiresAt', type: 'date', required: true },
  ],
};

// Takes the lock named key for ttlMs and returns its token, or returns null
// while someone else holds it. An expired lock is free to take.
export async function acquireLock(
  payload: Payload,
  key: string,
  ttlMs: number
): Promise<string | null> {
  const now = Date.now();
  // One DELETE statement, so it cannot remove a lock taken after it read.
  await payload.db.deleteMany({
    collection: LOCKS_SLUG,
    where: {
      and: [
        { key: { equals: key } },
        { expiresAt: { less_than: new Date(now).toISOString() } },
      ],
    },
  });
  const token = randomUUID();
  try {
    await payload.create({
      collection: LOCKS_SLUG,
      data: { key, token, expiresAt: new Date(now + ttlMs).toISOString() },
      depth: 0,
    });
    return token;
  } catch (error) {
    // The unique key is taken: someone else holds the lock.
    if (error instanceof ValidationError) return null;
    throw error;
  }
}

// Gives up the lock if the token still holds it.
export async function releaseLock(
  payload: Payload,
  key: string,
  token: string
): Promise<void> {
  await payload.db.deleteMany({
    collection: LOCKS_SLUG,
    where: {
      and: [{ key: { equals: key } }, { token: { equals: token } }],
    },
  });
}

// Extends the lock for ttlMs while the token holds it, and returns whether it
// does. An expired lock is still held until someone else takes it over.
export async function renewLock(
  payload: Payload,
  key: string,
  token: string,
  ttlMs: number
): Promise<boolean> {
  const held: Where = {
    and: [{ key: { equals: key } }, { token: { equals: token } }],
  };
  // Payload's SQL adapters select the rows and then update them, so the
  // result is no proof the token still holds the lock; the count is.
  await payload.db.updateMany({
    collection: LOCKS_SLUG,
    where: held,
    data: { expiresAt: new Date(Date.now() + ttlMs).toISOString() },
  });
  const { totalDocs } = await payload.db.count({
    collection: LOCKS_SLUG,
    where: held,
  });
  return totalDocs > 0;
}
