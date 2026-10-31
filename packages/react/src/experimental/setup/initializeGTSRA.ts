import {
  internalInitializeGTSRA,
  type LocaleTwinsInitializeGTParams,
} from '@generaltranslation/react-core/internal/experimental';
import { addRuntimeCredentials } from '../../setup/runtimeCredentials';

export type InitializeGTParams = LocaleTwinsInitializeGTParams;

/**
 * `initializeGT()` for server-rendered React runtimes with locale twins: the
 * server keeps loading whole locales to render each request's locale.
 */
export function initializeGTSRA(config: InitializeGTParams): void {
  internalInitializeGTSRA(addRuntimeCredentials(config));
}

/**
 * `initializeGT()` for the browser of a server-rendered app with locale
 * twins: a locale twin client's cache loads nothing.
 */
export function initializeGTSRAClient(config: InitializeGTParams): void {
  internalInitializeGTSRA(
    addRuntimeCredentials({ cacheExpiryTime: null, ...config })
  );
}
