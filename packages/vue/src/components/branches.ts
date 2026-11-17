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

type BranchProps = {
  /** Named branch to render after conversion to a string. */
  branch?: string | number | boolean;
};

/**
 * Selects a plural slot or attribute for `n` as ICU does: an exact number such
 * as `_0`, then the active locale's plural category such as `one`, then
 * `other`.
 */
export const Plural = /* @__PURE__ */ withGTMetadata<PluralProps>(
  /* @__PURE__ */ defineComponent({
    inheritAttrs: false,
    name: 'Plural',
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
          branches.map(getPluralBranchKey),
          getFormatLocales(
            undefined,
            state.getLocale(),
            state.defaultLocale,
            state.resolveFormattingLocale
          )
        );
        const branch = branches.find(
          (name) => getPluralBranchKey(name) === form
        );
        return asFragmentRoot(
          branch ? getBranchContent(branch, attrs, slots) : null
        );
      };
    },
  }),
  'plural'
);

/**
 * Selects an arbitrary named slot or attribute from `branch`. A value with no
 * branch renders the `other` branch.
 *
 * When used inside {@link T}, every named branch is extracted for translation
 * while only the active branch is rendered.
 */
export const Branch = /* @__PURE__ */ withGTMetadata<BranchProps>(
  /* @__PURE__ */ defineComponent({
    inheritAttrs: false,
    name: 'Branch',
    props: {
      /** Named branch to render after conversion to a string. */
      branch: [String, Number, Boolean] as PropType<string | number | boolean>,
    },
    setup(props, { attrs, slots }) {
      return () => {
        const branch = props.branch == null ? '' : String(props.branch);
        const hasBranch =
          Object.hasOwn(slots, branch) ||
          isBranchAttribute(branch, attrs[branch]);
        return asFragmentRoot(
          getBranchContent(hasBranch ? branch : 'other', attrs, slots)
        );
      };
    },
  }),
  'branch'
);
