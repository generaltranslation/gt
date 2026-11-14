import {
  internalInitializeGTSRA,
  type ReactInitializeGTParams,
} from '@generaltranslation/react-core/pure';
import { addRuntimeCredentials } from './runtimeCredentials';

/**
 * Initialize GT for server-rendered React runtimes.
 */
export function initializeGTSRA(config: ReactInitializeGTParams): void {
  internalInitializeGTSRA(addRuntimeCredentials(config));
}
