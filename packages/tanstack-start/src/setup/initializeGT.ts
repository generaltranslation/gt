import { ReactI18nManagerParams } from "@generaltranslation/react-core/context";
import { internalInitializeGTSSR } from "@generaltranslation/react-core/context";

/**
 * Configure GT for TanStack Start. This must be called to setup GT for TanStack Start.
 * @param {InitializeGTParams} config - The configuration for the GT instance
 */
export function initializeGT(params: ReactI18nManagerParams): void {
  internalInitializeGTSSR(params);
}
