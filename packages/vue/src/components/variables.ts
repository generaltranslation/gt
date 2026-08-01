import { defineComponent, type PropType } from 'vue';
import { useGTState } from '../runtime/state';
import { getFormatLocales, readSlotText, withGTMetadata } from './utils';

type NumberFormatProps = {
  /** Locale preferences tried before the active GT locale. */
  locales?: string[];
  /** Options forwarded to `Intl.NumberFormat`. */
  options?: Intl.NumberFormatOptions;
  /** Runtime value. When provided, this takes precedence over slot text. */
  value?: number | string | null;
};

type DateTimeProps = {
  /** Locale preferences tried before the active GT locale. */
  locales?: string[];
  /** Options forwarded to `Intl.DateTimeFormat`. */
  options?: Intl.DateTimeFormatOptions;
  /** Runtime value. When provided, this takes precedence over slot text. */
  value?: Date | number | string | null;
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
    inheritAttrs: false,
    name: 'Var',
    setup(_props, { slots }) {
      return () => slots.default?.() ?? null;
    },
  }),
  'variable-variable'
);

/**
 * Formats a number with `Intl.NumberFormat` for the active locale. Pass
 * runtime values through `value`; static default-slot text remains supported.
 * Explicit `locales` are tried first, and text that is not an entire numeric
 * value is returned unchanged.
 */
export const Num = withGTMetadata<NumberFormatProps>(
  defineComponent({
    inheritAttrs: false,
    name: 'Num',
    props: {
      /** Locale preferences tried before the active GT locale. */
      locales: Array as PropType<string[]>,
      /** Options forwarded to `Intl.NumberFormat`. */
      options: Object as PropType<Intl.NumberFormatOptions>,
      /** Runtime value. When provided, this takes precedence over slot text. */
      value: [Number, String] as PropType<number | string | null>,
    },
    setup(props, { slots }) {
      const state = useGTState();
      return () => {
        const value =
          props.value !== undefined ? props.value : readSlotText(slots);
        if (
          value == null ||
          (typeof value === 'string' && value.trim() === '')
        ) {
          return null;
        }
        const number = typeof value === 'number' ? value : Number(value);
        return Number.isNaN(number)
          ? String(value)
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
 * Formats a date with `Intl.DateTimeFormat` for the active locale. Pass
 * `Date` objects and epoch numbers through `value`; static default-slot text
 * remains supported. Explicit `locales` are tried first, and invalid values
 * are returned unchanged.
 */
export const DateTime = withGTMetadata<DateTimeProps>(
  defineComponent({
    inheritAttrs: false,
    name: 'DateTime',
    props: {
      /** Locale preferences tried before the active GT locale. */
      locales: Array as PropType<string[]>,
      /** Options forwarded to `Intl.DateTimeFormat`. */
      options: Object as PropType<Intl.DateTimeFormatOptions>,
      /** Runtime value. When provided, this takes precedence over slot text. */
      value: [Date, Number, String] as PropType<Date | number | string | null>,
    },
    setup(props, { slots }) {
      const state = useGTState();
      return () => {
        const value =
          props.value !== undefined ? props.value : readSlotText(slots);
        if (
          value == null ||
          (typeof value === 'string' && value.trim() === '')
        ) {
          return null;
        }
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
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
 * Formats a number as currency for the active locale. Pass runtime values
 * through `value`; static default-slot text remains supported. `currency`
 * defaults to `USD`, and text that is not an entire numeric value is returned
 * unchanged.
 */
export const Currency = withGTMetadata<CurrencyProps>(
  defineComponent({
    inheritAttrs: false,
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
      /** Runtime value. When provided, this takes precedence over slot text. */
      value: [Number, String] as PropType<number | string | null>,
    },
    setup(props, { slots }) {
      const state = useGTState();
      return () => {
        const value =
          props.value !== undefined ? props.value : readSlotText(slots);
        if (
          value == null ||
          (typeof value === 'string' && value.trim() === '')
        ) {
          return null;
        }
        const number = typeof value === 'number' ? value : Number(value);
        return Number.isNaN(number)
          ? String(value)
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
