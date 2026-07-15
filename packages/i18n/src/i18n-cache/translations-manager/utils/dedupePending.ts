/**
 * Share one in-flight promise per key: concurrent callers for the same key
 * await the same promise, and the pending entry is cleared once it settles.
 */
export async function dedupePending<Key, Value>(
  pending: Map<Key, Promise<Value>>,
  key: Key,
  create: () => Promise<Value>
): Promise<Value> {
  let promise = pending.get(key);
  if (!promise) {
    promise = create();
    pending.set(key, promise);
  }

  try {
    return await promise;
  } finally {
    pending.delete(key);
  }
}
