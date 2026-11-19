import { defineComponent, type PropType } from 'vue';
import {
  formatCurrency,
  formatDateTime,
  formatNum,
  withDefaultDateStyle,
} from 'generaltranslation/internal';
import { useGTState } from '../runtime/state';
import { asFragmentRoot, getFormatLocales, withGTMetadata } from './utils';

type NumberFormatProps = {
  /** Options forwarded to `Intl.NumberFormat`. */
  options?: Intl.NumberFormatOptions;
  /** Runtime value to format. */
  value: number | bigint | null;
};

type DateTimeProps = {
  /** Options forwarded to `Intl.DateTimeFormat`. */
  options?: Intl.DateTimeFormatOptions;
  /** Runtime value to format. */
  value: Date | number | null;
};

type CurrencyProps = NumberFormatProps & {
  /** ISO 4217 currency code. */
  currency: string;
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
 * Formats the required `value` prop with `Intl.NumberFormat`.
 */
export const Num = /* @__PURE__ */ withGTMetadata<NumberFormatProps>(
  /* @__PURE__ */ defineComponent({
    inheritAttrs: false,
    name: 'Num',
    props: {
      /** @internal Locale selected by an owning rich translation pipeline. */
      _locale: String,
      /** Options forwarded to `Intl.NumberFormat`. */
      options: Object as PropType<Intl.NumberFormatOptions>,
      /** Runtime value to format. */
      value: {
        required: true,
        type: [Number, BigInt, null] as unknown as PropType<
          number | bigint | null
        >,
      },
    },
    setup(props) {
      const state = useGTState();
      return () => {
        if (props.value == null) return asFragmentRoot(null);
        return asFragmentRoot(
          formatNum(props.value, {
            locales: getVariableFormatLocales(props, state),
            ...props.options,
          })
        );
      };
    },
  }),
  'variable-number'
);

/**
 * Formats the required `value` prop, a `Date` or a timestamp, with
 * `Intl.DateTimeFormat`: in the medium date style unless `options` sets a
 * style or a date or time field. Invalid dates are returned unchanged.
 */
export const DateTime = /* @__PURE__ */ withGTMetadata<DateTimeProps>(
  /* @__PURE__ */ defineComponent({
    inheritAttrs: false,
    name: 'DateTime',
    props: {
      /** @internal Locale selected by an owning rich translation pipeline. */
      _locale: String,
      /** Options forwarded to `Intl.DateTimeFormat`. */
      options: Object as PropType<Intl.DateTimeFormatOptions>,
      /** Runtime value to format. */
      value: {
        required: true,
        type: [Date, Number, null] as unknown as PropType<Date | number | null>,
      },
    },
    setup(props) {
      const state = useGTState();
      return () => {
        const value = props.value;
        if (value == null) return asFragmentRoot(null);
        const formatted = Number.isNaN(new Date(value).getTime())
          ? String(value)
          : formatDateTime(value, {
              locales: getVariableFormatLocales(props, state),
              ...withDefaultDateStyle(props.options),
            });
        return asFragmentRoot(formatted);
      };
    },
  }),
  'variable-datetime'
);

/**
 * Formats the required `value` prop as an amount of the required `currency`.
 */
export const Currency = /* @__PURE__ */ withGTMetadata<CurrencyProps>(
  /* @__PURE__ */ defineComponent({
    inheritAttrs: false,
    name: 'Currency',
    props: {
      /** @internal Locale selected by an owning rich translation pipeline. */
      _locale: String,
      /** ISO 4217 currency code. */
      currency: {
        required: true,
        type: String,
      },
      /** Additional options forwarded to `Intl.NumberFormat`. */
      options: Object as PropType<Intl.NumberFormatOptions>,
      /** Runtime value to format. */
      value: {
        required: true,
        type: [Number, BigInt, null] as unknown as PropType<
          number | bigint | null
        >,
      },
    },
    setup(props) {
      const state = useGTState();
      return () => {
        if (props.value == null) return asFragmentRoot(null);
        return asFragmentRoot(
          formatCurrency(props.value, props.currency, {
            locales: getVariableFormatLocales(props, state),
            ...props.options,
            // The props say it is a currency, and which; options do not.
            currency: props.currency,
            style: 'currency',
          })
        );
      };
    },
  }),
  'variable-currency'
);

/** The locale of an owning rich translation pipeline, or the active one. */
function getVariableFormatLocales(
  props: { _locale?: string },
  state: ReturnType<typeof useGTState>
): string[] {
  return getFormatLocales(
    undefined,
    props._locale ?? state.getLocale(),
    state.defaultLocale,
    state.resolveFormattingLocale
  );
}
