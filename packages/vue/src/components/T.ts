import { defineComponent } from 'vue';
import type { VNodeChild } from 'vue';
import {
  createLookupOptions,
  getI18nCache,
  getI18nConfig,
} from 'gt-i18n/internal';
import type { JsxChildren } from 'generaltranslation/types';
import { getConditionStore } from '../condition-store';
import { getShouldTranslate } from '../internal/getFormatLocales';
import {
  queueRuntimeTranslation,
  trackTranslations,
} from '../internal/reactivity';
import { renderDefaultChildren } from '../internal/renderDefaultChildren';
import { renderTranslatedChildren } from '../internal/renderTranslatedChildren';
import { tagChildren } from '../internal/tagChildren';
import { writeChildrenAsObjects } from '../internal/writeChildrenAsObjects';

/**
 * The `<T>` component translates its slot content, including nested elements,
 * variable components, and branching components.
 *
 * ```html
 * <T>
 *   <p>Hello, <Var>{{ name }}</Var>!</p>
 * </T>
 * ```
 */
export const T = defineComponent({
  name: 'T',
  props: {
    id: { type: String, required: false },
    context: { type: String, required: false },
    _hash: { type: String, required: false },
  },
  inheritAttrs: false,
  setup(props, { slots }) {
    // Dev hot reload: render the previous translation while a new one loads
    let previous: VNodeChild | null = null;

    return (): VNodeChild => {
      trackTranslations();

      const sourceChildren = slots.default ? slots.default() : null;
      const conditionStore = getConditionStore();
      const config = getI18nConfig();
      const locale = conditionStore.getLocale();
      const enableI18n = conditionStore.getEnableI18n();
      const defaultLocale = config.getDefaultLocale();
      const shouldTranslate = getShouldTranslate({ locale, enableI18n });

      // Tag + serialize the source children
      const taggedSourceChildren = tagChildren(sourceChildren);
      const sourceJsxChildren = writeChildrenAsObjects(taggedSourceChildren);
      const targetOptions = {
        ...createLookupOptions<'JSX'>(locale, {}, 'JSX'),
        ...(props.context && { $context: props.context }),
        ...(props.id && { $id: props.id }),
        ...(props._hash && { $_hash: props._hash }),
      };

      // Look up the translation in the cache
      let targetJsxChildren: JsxChildren | undefined | null = null;
      if (shouldTranslate) {
        targetJsxChildren = getI18nCache().lookupTranslation<JsxChildren>(
          locale,
          sourceJsxChildren,
          targetOptions
        );

        // Dev hot reload: translate on the fly when the lookup misses
        if (targetJsxChildren == null && config.isDevHotReloadEnabled()) {
          queueRuntimeTranslation({
            locale,
            message: sourceJsxChildren,
            options: targetOptions,
          });
          if (previous != null) return previous;
        }
      }

      const result =
        !shouldTranslate || targetJsxChildren == null
          ? renderDefaultChildren({
              children: taggedSourceChildren,
              defaultLocale,
              enableI18n,
            })
          : renderTranslatedChildren({
              source: taggedSourceChildren,
              target: targetJsxChildren,
              locales: [locale, defaultLocale],
              enableI18n,
            });

      previous = result;
      return result;
    };
  },
});

(T as unknown as { _gtt: string })._gtt = 'translate-client';
