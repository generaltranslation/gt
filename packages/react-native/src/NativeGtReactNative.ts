import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
export interface Spec extends TurboModule {
  multiply(a: number, b: number): number;
  getNativeLocales(): string[];
  nativeStoreGet(key: string): string | null;
  nativeStoreSet(key: string, value: string): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('GtReactNative');
