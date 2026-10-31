import type { LocaleTwinCollector } from '../state/LocaleTwinCollector';

/** The locale twins pass's state for one module transform. */
export type LocaleTwinTransform = {
  /** The module's entries, recorded during the collection pass. */
  collector: LocaleTwinCollector;
  /** Remove attributed source text (client production builds). */
  stripSourceText: boolean;
  /** Whether a registration call with a placeholder was inserted. */
  registered: boolean;
  /** Whether a registration call without a placeholder was inserted. */
  runtimeRegistered: boolean;
};
