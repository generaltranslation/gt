import { defineComponent, getCurrentInstance } from 'vue';
import {
  createTranslationIdentityCache,
  readRawTChildren,
  translateVueChildren,
} from '../rendering/translateVueChildren';
import { useGTState } from '../runtime/state';
import { asFragmentRoot, withGTMetadata } from './utils';

type TProps = {
  /** @internal Compile-time hash inserted by GT tooling. */
  _hash?: string;
  /** @internal React-compatible alias accepted for compiler output. */
  $context?: string;
  /** Translation context using a Vue-template-friendly prop name. */
  context?: string;
};

/**
 * Translates rich content from its default slot with the active locale's
 * catalog. Missing entries render the source slot, and loaded catalogs or
 * locale changes trigger a reactive rerender.
 *
 * Wrap runtime values in {@link Var}; `T` does not interpolate string
 * placeholders or process ICU syntax.
 *
 * @example
 * ```vue
 * <T context="welcome">
 *   Hello, <Var>{{ name }}</Var>!
 * </T>
 * ```
 */
export const T = withGTMetadata<TProps>(
  defineComponent({
    inheritAttrs: false,
    name: 'T',
    props: {
      /** @internal Compile-time hash inserted by GT tooling. */
      _hash: String,
      /** Translation context used to disambiguate identical source content. */
      context: String,
    },
    setup(props, { attrs, slots }) {
      const state = useGTState();
      const instance = getCurrentInstance();
      // Translation IDs can reorder or repeat source VNodes. Stable Symbols
      // preserve component identity without colliding with user-provided keys.
      const identityCache = createTranslationIdentityCache();
      return () =>
        asFragmentRoot(
          translateVueChildren(
            instance
              ? readRawTChildren(instance.vnode, slots)
              : slots.default?.(),
            state,
            {
              ...props,
              ...(typeof attrs.$context === 'string' && {
                $context: attrs.$context,
              }),
            },
            identityCache
          )
        );
    },
  }),
  'translate-client'
);
