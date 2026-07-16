export const GtReactNative = {
  getNativeLocales(): string[] {
    return [...navigator.languages];
  },
  nativeStoreGet(key: string): string | null {
    return localStorage.getItem(key);
  },
  nativeStoreSet(key: string, value: string): void {
    localStorage.setItem(key, value);
  },
};
