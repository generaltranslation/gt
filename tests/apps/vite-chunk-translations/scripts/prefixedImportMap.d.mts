import type { Plugin } from 'vite';

/** `late`: the import map gets the prefixed specifiers only after the compiler has read it. */
export function prefixedImportMap(options?: { late?: boolean }): Plugin[];
