import {
  internalInitializeGTSRA,
  type ReactInitializeGTParams,
} from '@generaltranslation/react-core/pure';
import { addRuntimeCredentials } from './runtimeCredentials';

export type InitializeGTParams = ReactInitializeGTParams;

/**
 * Initialize GT for server-rendered React runtimes.
 */
export function initializeGTSRA(config: InitializeGTParams): void {
  internalInitializeGTSRA(addRuntimeCredentials(config));
}
