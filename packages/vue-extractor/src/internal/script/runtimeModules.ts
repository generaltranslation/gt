/** Package roots that can expose GT-shaped names but never gt-vue values. */
const KNOWN_NON_VUE_GT_RUNTIME_PACKAGES = [
  '@generaltranslation/react-core',
  'gt-i18n',
  'gt-next',
  'gt-node',
  'gt-react',
  'gt-react-native',
  'gt-tanstack-start',
] as const;

/**
 * Identifies an official GT runtime whose exports are ordinary to gt-vue.
 *
 * Package subpaths retain the identity of their package root. Explicitly
 * classifying these imports prevents a mixed-framework scan from treating a
 * React or server API named `T`, `msg`, or `useGT` as an unresolved gt-vue
 * alias. Unknown packages and application aliases remain unresolved so the
 * analyzer can continue to fail closed for custom gt-vue reexports.
 */
export function isKnownNonVueGTRuntime(source: string): boolean {
  return KNOWN_NON_VUE_GT_RUNTIME_PACKAGES.some(
    (packageName) =>
      source === packageName || source.startsWith(`${packageName}/`)
  );
}
