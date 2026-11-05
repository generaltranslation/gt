import type { LocaleTwinsOptions } from '@generaltranslation/compiler/experimental';
import type {
  GTTanstackStartCompilerOptions as RegularCompilerOptions,
  GTTanstackStartPluginOptions as RegularPluginOptions,
} from '../../plugin/types';

/** The compiler options, with the locale twins build options. */
export type GTTanstackStartCompilerOptions = RegularCompilerOptions & {
  /**
   * Build options for locale twins (`experimental.splitting:
   * "locale-twins"` in gt.config.json), which need the compiler.
   */
  localeTwins?: LocaleTwinsOptions;
};

export type GTTanstackStartPluginOptions = Omit<
  RegularPluginOptions,
  'experimentalCompilerOptions'
> & {
  /** The experimental GT compiler, with locale twins. */
  experimentalCompilerOptions?: GTTanstackStartCompilerOptions;
};
