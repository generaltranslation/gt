import { defineComponent, h } from 'vue';
import { getLocaleProperties } from 'generaltranslation';
import type { CustomMapping } from 'generaltranslation/types';
import { getI18nConfig } from 'gt-i18n/internal';
import { useLocale, useLocales } from '../locale-composables';

function capitalizeName(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + (str.length > 1 ? str.slice(1) : '');
}

/**
 * A dropdown that switches the app's locale in place (no page reload).
 * Renders the locales from the GT config with their native display names.
 */
export const LocaleSelector = defineComponent({
  name: 'LocaleSelector',
  props: {
    locales: { type: Array as () => string[], required: false },
    customMapping: {
      type: Object as () => CustomMapping,
      required: false,
    },
  },
  setup(props, { attrs }) {
    const locale = useLocale();
    const customMapping =
      props.customMapping ?? getI18nConfig().getCustomMapping();

    const getDisplayName = (locale: string): string => {
      const mapped = customMapping?.[locale];
      if (typeof mapped === 'string') return mapped;
      if (mapped?.name) return mapped.name;
      return capitalizeName(
        getLocaleProperties(locale, locale, customMapping)
          .nativeNameWithRegionCode
      );
    };

    const collator = new Intl.Collator();
    const locales = [...(props.locales ?? useLocales())].sort((a, b) =>
      collator.compare(getDisplayName(a), getDisplayName(b))
    );

    return () => {
      if (!locales.length) return null;
      return h(
        'select',
        {
          name: 'generaltranslation-locale',
          'aria-label': 'General Translation locale selector',
          ...attrs,
          value: locale.value,
          onChange: (event: Event) => {
            locale.value = (event.target as HTMLSelectElement).value;
          },
        },
        locales.map((value) =>
          h('option', { key: value, value }, getDisplayName(value))
        )
      );
    };
  },
});
