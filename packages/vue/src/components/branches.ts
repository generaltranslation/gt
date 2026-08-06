import {
  getPluralForm,
  isAcceptedPluralForm,
} from 'generaltranslation/internal';
import { defineComponent, type PropType } from 'vue';
import { useGTState } from '../runtime/state';
import {
  asFragmentRoot,
  getBranchContent,
  getBranchNames,
  getFormatLocales,
  withGTMetadata,
} from './utils';

type PluralProps = {
  /** Locale preferences tried before active and default locales in translation. */
  locales?: string[];
  /** Numeric value used to select a plural category. */
  n: number;
};

type BranchProps = {
  /** Named branch to render after conversion to a string. */
  branch?: string | number | boolean;
};

/**
 * Selects a named plural slot such as `one` or `other` from `n` and the active
 * locale's plural rules. Missing categories fall back to the default slot.
 *
 * At the default locale, explicit `locales` are ignored. Otherwise, they are
 * tried before the active and default GT locales.
 */
export const Plural = withGTMetadata<PluralProps>(
  defineComponent({
    inheritAttrs: false,
    name: 'Plural',
    props: {
      /** Locale preferences tried before active and default locales in translation. */
      locales: Array as PropType<string[]>,
      /** Numeric value used to select a plural category. */
      n: {
        required: true,
        type: Number,
      },
    },
    setup(props, { attrs, slots }) {
      const state = useGTState();
      return () => {
        const branches = getBranchNames(attrs, slots).filter(
          isAcceptedPluralForm
        );
        const branch = getPluralForm(
          props.n,
          branches,
          getFormatLocales(
            props.locales,
            state.getLocale(),
            state.defaultLocale
          )
        );
        return asFragmentRoot(getBranchContent(branch, attrs, slots));
      };
    },
  }),
  'plural'
);

/**
 * Selects an arbitrary named slot or attribute from `branch`. Missing branch
 * keys render the default slot.
 *
 * When used inside {@link T}, every named branch is extracted for translation
 * while only the active branch is rendered.
 */
export const Branch = withGTMetadata<BranchProps>(
  defineComponent({
    inheritAttrs: false,
    name: 'Branch',
    props: {
      /** Named branch to render after conversion to a string. */
      branch: [String, Number, Boolean] as PropType<string | number | boolean>,
    },
    setup(props, { attrs, slots }) {
      return () => {
        const branch = props.branch?.toString();
        return asFragmentRoot(getBranchContent(branch, attrs, slots));
      };
    },
  }),
  'branch'
);
