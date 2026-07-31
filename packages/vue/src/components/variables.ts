import { defineComponent, type PropType } from 'vue';
import { useGTState } from '../runtime/state';
import { getFormatLocales, readSlotText, withGTMetadata } from './utils';

type NumberFormatProps = {
  /** Locale preferences tried before the active GT locale. */
  locales?: string[];
  /** Options forwarded to `Intl.NumberFormat`. */
  options?: Intl.NumberFormatOptions;
};

type DateTimeProps = {
  /** Locale preferences tried before the active GT locale. */
  locales?: string[];
  /** Options forwarded to `Intl.DateTimeFormat`. */
  options?: Intl.DateTimeFormatOptions;
};

type CurrencyProps = NumberFormatProps & {
  /** ISO 4217 currency code. Defaults to `USD`. */
  currency?: string;
};

/**
 * Marks its default-slot child as an opaque runtime value inside {@link T}.
 * The child renders unchanged and is reinserted wherever the translated rich
 * tree references it.
 *
 * `Var` is intentionally child-only: it does not accept `name` or `value`
 * props.
 *
 * @example
 * ```vue
 * <Var>{{ accountName }}</Var>
 * ```
 */
export const Var = withGTMetadata(
  defineComponent({
    name: 'Var',
    setup(_props, { slots }) {
      return () => slots.default?.() ?? null;
    },
  }),
  'variable-variable'
);

/**
 * Formats numeric default-slot text with `Intl.NumberFormat` for the active
 * locale. Explicit `locales` are tried first. Slot text that
 * `Number.parseFloat` cannot parse is returned unchanged.
 */
export const Num = withGTMetadata<NumberFormatProps>(
  defineComponent({
    name: 'Num',
    props: {
      /** Locale preferences tried before the active GT locale. */
      locales: Array as PropType<string[]>,
      /** Options forwarded to `Intl.NumberFormat`. */
      options: Object as PropType<Intl.NumberFormatOptions>,
    },
    setup(props, { slots }) {
      const state = useGTState();
      return () => {
        const value = readSlotText(slots);
        if (!value) return null;
        const number = Number.parseFloat(value);
        return Number.isNaN(number)
          ? value
          : new Intl.NumberFormat(
              getFormatLocales(props.locales, state.locale.value),
              props.options
            ).format(number);
      };
    },
  }),
  'variable-number'
);

/**
 * Parses and formats default-slot text with `Intl.DateTimeFormat` for the
 * active locale. Explicit `locales` are tried first, and invalid dates are
 * returned unchanged.
 */
export const DateTime = withGTMetadata<DateTimeProps>(
  defineComponent({
    name: 'DateTime',
    props: {
      /** Locale preferences tried before the active GT locale. */
      locales: Array as PropType<string[]>,
      /** Options forwarded to `Intl.DateTimeFormat`. */
      options: Object as PropType<Intl.DateTimeFormatOptions>,
    },
    setup(props, { slots }) {
      const state = useGTState();
      return () => {
        const value = readSlotText(slots);
        if (!value) return null;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return new Intl.DateTimeFormat(
          getFormatLocales(props.locales, state.locale.value),
          props.options
        )
          .format(date)
          .replace(/[\u200F\u202B\u202E]/g, '');
      };
    },
  }),
  'variable-datetime'
);

/**
 * Formats numeric default-slot text as currency for the active locale.
 * `currency` defaults to `USD`. Slot text that `Number.parseFloat` cannot parse
 * is returned unchanged.
 */
export const Currency = withGTMetadata<CurrencyProps>(
  defineComponent({
    name: 'Currency',
    props: {
      /** ISO 4217 currency code. Defaults to `USD`. */
      currency: {
        default: 'USD',
        type: String,
      },
      /** Locale preferences tried before the active GT locale. */
      locales: Array as PropType<string[]>,
      /** Additional options forwarded to `Intl.NumberFormat`. */
      options: Object as PropType<Intl.NumberFormatOptions>,
    },
    setup(props, { slots }) {
      const state = useGTState();
      return () => {
        const value = readSlotText(slots);
        if (!value) return null;
        const number = Number.parseFloat(value);
        return Number.isNaN(number)
          ? value
          : new Intl.NumberFormat(
              getFormatLocales(props.locales, state.locale.value),
              {
                ...props.options,
                currency: props.currency,
                style: 'currency',
              }
            ).format(number);
      };
    },
  }),
  'variable-currency'
);
