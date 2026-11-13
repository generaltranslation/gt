import { createRequire } from 'node:module';
import type * as Binding from '@generaltranslation/paraglide-js/native';

export type {
  NativeAnalysis,
  NativeGeneratedCode,
  NativeGeneratedSource,
  NativeGraphOptions,
  NativeLoadResult,
  NativeTarget,
} from '@generaltranslation/paraglide-js/native';

export type NativeGraph = Binding.NativeGraph;

const require = createRequire(import.meta.url);

/**
 * The analysis itself: a Node addon written in Rust (`native/`). Loaded by the
 * package's own name, so that the source and the built files find it alike.
 */
export const native: typeof Binding = load();

function load(): typeof Binding {
  try {
    return require('@generaltranslation/paraglide-js/native');
  } catch (error) {
    throw new Error(
      `@generaltranslation/paraglide-js could not load its analysis, a native addon, on ${process.platform}-${process.arch}. ` +
        'In its repository, build it with `pnpm build:native` (it needs Rust).',
      { cause: error }
    );
  }
}
