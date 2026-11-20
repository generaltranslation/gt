import {
  getPluralBranchKey,
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
  isBranchAttribute,
  withGTMetadata,
} from './utils';

type PluralProps = {
  /** Number used to select a plural branch. */
  n: number | bigint;
};

type SelectProps = {
  /** Names the branch to render, after conversion to a string. */
  value?: string | number | boolean;
};

function definePlural(name: string, type: Intl.PluralRuleType) {
  return defineComponent({
    inheritAttrs: false,
    name,
    props: {
      /** Number used to select a plural branch. */
      n: {
        required: true,
        type: [Number, BigInt] as PropType<number | bigint>,
      },
    },
    setup(props, { attrs, slots }) {
      const state = useGTState();
      return () => {
        const branches = getBranchNames(attrs, slots).filter(
          isAcceptedPluralForm
        );
        const form = getPluralForm(
          props.n,
          // The default slot is the fallback: ICU's `other`.
          [
            ...branches.map(getPluralBranchKey),
            ...(slots.default ? ['other'] : []),
          ],
          getFormatLocales(
            state.getLocale(),
            state.defaultLocale,
            state.resolveFormattingLocale
          ),
          type
        );
        const branch = branches.find(
          (name) => getPluralBranchKey(name) === form
        );
        return asFragmentRoot(
          branch
            ? getBranchContent(branch, attrs, slots)
            : form === 'other'
              ? slots.default?.()
              : null
        );
      };
    },
  });
}

/**
 * Selects a plural slot or attribute for `n` as ICU does: an exact number such
 * as `_0`, then the active locale's plural category such as `one`, then the
 * default slot.
 */
export const Plural = /* @__PURE__ */ withGTMetadata<PluralProps>(
  /* @__PURE__ */ definePlural('Plural', 'cardinal'),
  'plural'
);

/**
 * `Plural` for ordinals such as 1st, 2nd and 3rd: it selects among the active
 * locale's ordinal categories.
 */
export const Ordinal = /* @__PURE__ */ withGTMetadata<PluralProps>(
  /* @__PURE__ */ definePlural('Ordinal', 'ordinal'),
  'plural-ordinal'
);

/**
 * Selects an arbitrary named slot or attribute from `value`. A value with no
 * branch renders the default slot.
 *
 * When used inside {@link T}, every named branch is extracted for translation
 * while only the active branch is rendered.
 */
export const Select = /* @__PURE__ */ withGTMetadata<SelectProps>(
  /* @__PURE__ */ defineComponent({
    inheritAttrs: false,
    name: 'Select',
    props: {
      /** Names the branch to render, after conversion to a string. */
      value: [String, Number, Boolean] as PropType<string | number | boolean>,
    },
    setup(props, { attrs, slots }) {
      return () => {
        const branch = props.value == null ? '' : String(props.value);
        // `other` is not a branch name: it is the default slot.
        const hasBranch =
          (branch !== 'other' && Object.hasOwn(slots, branch)) ||
          isBranchAttribute(branch, attrs[branch]);
        return asFragmentRoot(
          hasBranch
            ? getBranchContent(branch, attrs, slots)
            : (slots.default?.() ?? null)
        );
      };
    },
  }),
  'select'
);
