import { useCallback, useSyncExternalStore } from 'react';
import useGTContext from '../provider/GTContext';
import { _Message, _Messages } from '../internal';
import { messageRegistry, MessageEntry } from './MessageRegistry';

/**
 * The return type for useRegistryMessages, containing both messages and a hash map.
 */
export type RegistryMessagesResult =
  | {
      registryMessages: _Messages;
      hashMap: Map<string, MessageEntry>;
    }
  | undefined;

// ----- HELPER HOOKS ---- //

/**
 * React hook to subscribe to the message registry and receive both an array of _Message and a map of hashes to message data.
 * Returns undefined when disabled to avoid unnecessary subscriptions/renders.
 *
 * @returns {RegistryMessagesResult} An object with registryMessages and hashMap, or undefined if disabled.
 */
export function useRegistryMessages(): RegistryMessagesResult {
  const { translationRequired, developmentApiEnabled } = useGTContext(
    `useMessages(): No context provided. You're trying to get the m() function from the useMessages() hook, which can be called within a <GTProvider>.`
  );
  const disabled = !developmentApiEnabled || !translationRequired;

  const get = useCallback<() => RegistryMessagesResult>(
    () => (disabled ? undefined : messageRegistry.getSnapshot()),
    [disabled]
  );

  const subscribe = useCallback<(listener: () => void) => () => void>(
    (listener) => (disabled ? () => {} : messageRegistry.subscribe(listener)),
    [disabled]
  );

  // For SSR we can reuse the same getter.
  return useSyncExternalStore(subscribe, get, get);
}
