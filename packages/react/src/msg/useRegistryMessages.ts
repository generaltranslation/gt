import { useCallback, useSyncExternalStore } from 'react';
import useGTContext from '../provider/GTContext';
<<<<<<< HEAD
import { _Message, _Messages } from '../internal';
import { messageRegistry } from './MessageRegistry';
=======
import { _Messages } from '../internal';
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
>>>>>>> 60d060dad7c8fc7730187e5f6881dd3e995114e6

// ----- HELPER HOOKS ---- //

/**
 * React hook to subscribe to the message registry and receive the Set of registered messages.
 * Returns undefined when disabled to avoid unnecessary subscriptions/renders.
 *
 * @returns {Set<string> | undefined} The set of registered message strings, or undefined if disabled.
 */
export function useRegistryMessages(): Set<string> | undefined {
  const { translationRequired, developmentApiEnabled } = useGTContext(
    `useMessages(): No context provided. You're trying to get the m() function from the useMessages() hook, which can be called within a <GTProvider>.`
  );

  const disabled = !developmentApiEnabled || !translationRequired;

  const get = useCallback<() => Set<string> | undefined>(
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
