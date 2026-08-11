import { defineComponent, type PropType } from 'vue';
import { useGTState } from '../runtime/state';
import { asFragmentRoot, getFormatLocales, withGTMetadata } from './utils';

type NumberFormatProps = {
  /** Locale preferences tried before active and default locales in translation. */
  locales?: string[];
  /** Options forwarded to `Intl.NumberFormat`. */
  options?: Intl.NumberFormatOptions;
  /** Runtime value to format. */
  value: number | string | null;
};

type DateTimeProps = {
  /** Locale preferences tried before active and default locales in translation. */
  locales?: string[];
  /** Options forwarded to `Intl.DateTimeFormat`. */
  options?: Intl.DateTimeFormatOptions;
  /** Runtime value to format. */
  value: Date | number | string | null;
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
export const Var = /* @__PURE__ */ withGTMetadata(
  /* @__PURE__ */ defineComponent({
    inheritAttrs: false,
    name: 'Var',
    setup(_props, { slots }) {
      return () => asFragmentRoot(slots.default?.() ?? null);
    },
  }),
  'variable-variable'
);

/**
 * Formats the required `value` prop with `Intl.NumberFormat`. When rendered
 * outside {@link T}, explicit `locales` are tried before the
 * active and default GT locales while translating. Text that is not an entire
 * numeric value is returned unchanged.
 */
export const Num = /* @__PURE__ */ withGTMetadata<NumberFormatProps>(
  /* @__PURE__ */ defineComponent({
    inheritAttrs: false,
    name: 'Num',
    props: {
      /** @internal Locale selected by an owning rich translation pipeline. */
      _locale: String,
      /** Locale preferences tried before active and default locales in translation. */
      locales: Array as PropType<string[]>,
      /** Options forwarded to `Intl.NumberFormat`. */
      options: Object as PropType<Intl.NumberFormatOptions>,
      /** Runtime value to format. */
      value: {
        required: true,
        type: [Number, String, null] as unknown as PropType<
          number | string | null
        >,
      },
    },
    setup(props) {
      const state = useGTState();
      return () => {
        const value = props.value;
        if (
          value == null ||
          (typeof value === 'string' && value.trim() === '')
        ) {
          return asFragmentRoot(null);
        }
        const number = typeof value === 'number' ? value : Number(value);
        const formatted = Number.isNaN(number)
          ? String(value)
          : new Intl.NumberFormat(
              getVariableFormatLocales(props, state),
              props.options
            ).format(number);
        return asFragmentRoot(formatted);
      };
    },
  }),
  'variable-number'
);

/**
 * Formats the required `value` prop with `Intl.DateTimeFormat`. `Date`
 * objects, epoch numbers, and date strings are supported. When rendered
 * outside {@link T}, explicit `locales` are tried before the active and
 * default GT locales while translating. Invalid values are returned
 * unchanged.
 */
export const DateTime = /* @__PURE__ */ withGTMetadata<DateTimeProps>(
  /* @__PURE__ */ defineComponent({
    inheritAttrs: false,
    name: 'DateTime',
    props: {
      /** @internal Locale selected by an owning rich translation pipeline. */
      _locale: String,
      /** Locale preferences tried before active and default locales in translation. */
      locales: Array as PropType<string[]>,
      /** Options forwarded to `Intl.DateTimeFormat`. */
      options: Object as PropType<Intl.DateTimeFormatOptions>,
      /** Runtime value to format. */
      value: {
        required: true,
        type: [Date, Number, String, null] as unknown as PropType<
          Date | number | string | null
        >,
      },
    },
    setup(props) {
      const state = useGTState();
      return () => {
        const value = props.value;
        if (
          value == null ||
          (typeof value === 'string' && value.trim() === '')
        ) {
          return asFragmentRoot(null);
        }
        const date = value instanceof Date ? value : new Date(value);
        const formatted = Number.isNaN(date.getTime())
          ? String(value)
          : new Intl.DateTimeFormat(
              getVariableFormatLocales(props, state),
              props.options
            )
              .format(date)
              .replace(/[\u200F\u202B\u202E]/g, '');
        return asFragmentRoot(formatted);
      };
    },
  }),
  'variable-datetime'
);

/**
 * Formats the required `value` prop as currency. `currency` defaults to
 * `USD`. When rendered outside {@link T}, explicit `locales` are tried before
 * the active and default GT locales while translating. Text that is not an
 * entire numeric value is returned unchanged.
 */
export const Currency = /* @__PURE__ */ withGTMetadata<CurrencyProps>(
  /* @__PURE__ */ defineComponent({
    inheritAttrs: false,
    name: 'Currency',
    props: {
      /** @internal Locale selected by an owning rich translation pipeline. */
      _locale: String,
      /** ISO 4217 currency code. Defaults to `USD`. */
      currency: {
        default: 'USD',
        type: String,
      },
      /** Locale preferences tried before active and default locales in translation. */
      locales: Array as PropType<string[]>,
      /** Additional options forwarded to `Intl.NumberFormat`. */
      options: Object as PropType<Intl.NumberFormatOptions>,
      /** Runtime value to format. */
      value: {
        required: true,
        type: [Number, String, null] as unknown as PropType<
          number | string | null
        >,
      },
    },
    setup(props) {
      const state = useGTState();
      return () => {
        const value = props.value;
        if (
          value == null ||
          (typeof value === 'string' && value.trim() === '')
        ) {
          return asFragmentRoot(null);
        }
        const number = typeof value === 'number' ? value : Number(value);
        const formatted = Number.isNaN(number)
          ? String(value)
          : new Intl.NumberFormat(getVariableFormatLocales(props, state), {
              ...props.options,
              currency: props.currency,
              style: 'currency',
            }).format(number);
        return asFragmentRoot(formatted);
      };
    },
  }),
  'variable-currency'
);

/** Uses a rich pipeline override without changing standalone locale options. */
function getVariableFormatLocales(
  props: { _locale?: string; locales?: string[] },
  state: ReturnType<typeof useGTState>
): string[] {
  return props._locale === undefined
    ? getFormatLocales(props.locales, state.getLocale(), state.defaultLocale)
    : getFormatLocales(undefined, props._locale, state.defaultLocale);
}
