import type { TurboModule } from 'react-native';
import { Platform, TurboModuleRegistry } from 'react-native';
export interface Spec extends TurboModule {
  multiply(a: number, b: number): number;
  getNativeLocales(): string[];
  nativeStoreGet(key: string): string | null;
  nativeStoreSet(key: string, value: string): void;
}

// On web (react-native-web / Expo web) the native module is never registered, so
// calling getEnforcing at module load throws and crashes the whole bundle before
// any Platform.OS guard in the sibling utilities can run. Resolve to null on web:
// its only importers, utils/getNativeLocales.ts and utils/nativeStore.ts, never
// reach it there, because each serves its web fallback (navigator.languages,
// localStorage) behind its own Platform.OS === 'web' branch first. On native
// platforms getEnforcing is kept unchanged, so a misconfigured native build
// still fails loudly at import as before.
export const GtReactNative: Spec | null =
  Platform.OS === 'web'
    ? null
    : TurboModuleRegistry.getEnforcing<Spec>('GtReactNative');
