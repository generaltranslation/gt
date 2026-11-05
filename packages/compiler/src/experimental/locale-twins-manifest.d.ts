/**
 * Types for `virtual:gt-locale-twins-manifest`, provided by the experimental
 * compiler plugin for Vite (`@generaltranslation/compiler/experimental`).
 * Reference them from a server entry:
 *
 * ```ts
 * /// <reference types="@generaltranslation/compiler/experimental/locale-twins-manifest" />
 * import { manifest } from 'virtual:gt-locale-twins-manifest';
 * ```
 */
declare module 'virtual:gt-locale-twins-manifest' {
  import type { LocaleTwinManifest } from 'generaltranslation/internal/experimental';

  /**
   * The client build's locale twin manifest, bundled into server builds.
   * `null` in client environments, in dev, and when locale twins are off.
   */
  export const manifest: LocaleTwinManifest | null;
}
