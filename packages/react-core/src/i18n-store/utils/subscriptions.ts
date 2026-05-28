import type { Unsubscribe } from '../storeTypes';

export function subscribeToSet<T>(
  listenerSet: Set<T>,
  listener: T
): Unsubscribe {
  listenerSet.add(listener);
  return () => {
    listenerSet.delete(listener);
  };
}
