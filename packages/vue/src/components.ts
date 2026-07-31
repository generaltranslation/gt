import {
  getPluralForm,
  isAcceptedPluralForm,
} from 'generaltranslation/internal';
import {
  defineComponent,
  isVNode,
  type Component,
  type PropType,
  type Slots,
  type VNodeChild,
} from 'vue';
import { translateVueChildren } from './rich';
import { useGTState } from './state';

type GTComponent<T extends Component> = T & { _gtt: string };

function withGTMetadata<T extends Component>(
  component: T,
  metadata: string
): GTComponent<T> {
  return Object.assign(component, { _gtt: metadata });
}

export const T = withGTMetadata(
  defineComponent({
    inheritAttrs: false,
    name: 'T',
    props: {
      /** @internal Compile-time hash inserted by GT tooling. */
      _hash: String,
      context: String,
    },
    setup(props, { attrs, slots }) {
      const state = useGTState();
      return () =>
        translateVueChildren(slots.default?.() ?? [], state, {
          ...props,
          ...(typeof attrs.$context === 'string' && {
            $context: attrs.$context,
          }),
        });
    },
  }),
  'translate-client'
);

export const Var = withGTMetadata(
  defineComponent({
    name: 'Var',
    setup(_props, { slots }) {
      return () => slots.default?.() ?? null;
    },
  }),
  'variable-variable'
);

export const Num = withGTMetadata(
  defineComponent({
    name: 'Num',
    props: {
      locales: Array as PropType<string[]>,
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

export const DateTime = withGTMetadata(
  defineComponent({
    name: 'DateTime',
    props: {
      locales: Array as PropType<string[]>,
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

export const Currency = withGTMetadata(
  defineComponent({
    name: 'Currency',
    props: {
      currency: {
        default: 'USD',
        type: String,
      },
      locales: Array as PropType<string[]>,
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

export const Plural = withGTMetadata(
  defineComponent({
    inheritAttrs: false,
    name: 'Plural',
    props: {
      locales: Array as PropType<string[]>,
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
          getFormatLocales(props.locales, state.locale.value)
        );
        return getBranchContent(branch, attrs, slots);
      };
    },
  }),
  'plural'
);

export const Branch = withGTMetadata(
  defineComponent({
    inheritAttrs: false,
    name: 'Branch',
    props: {
      branch: [String, Number, Boolean] as PropType<string | number | boolean>,
    },
    setup(props, { attrs, slots }) {
      return () => {
        const branch = props.branch?.toString();
        return getBranchContent(
          branch && !branch.startsWith('data-') ? branch : undefined,
          attrs,
          slots
        );
      };
    },
  }),
  'branch'
);

function getFormatLocales(
  locales: string[] | undefined,
  locale: string
): string[] {
  return [...(locales ?? []), locale];
}

function readSlotText(slots: Slots): string {
  return (slots.default?.() ?? []).map(readVNodeText).join('');
}

function readVNodeText(node: VNodeChild): string {
  if (node == null || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(readVNodeText).join('');
  if (!isVNode(node)) return String(node);
  if (typeof node.children === 'string') return node.children;
  if (Array.isArray(node.children)) {
    return node.children.map(readVNodeText).join('');
  }
  return '';
}

function getBranchNames(
  attrs: Record<string, unknown>,
  slots: Slots
): string[] {
  return [
    ...Object.keys(attrs).filter((key) => !key.startsWith('data-')),
    ...Object.keys(slots).filter(
      (key) => key !== 'default' && !key.startsWith('_')
    ),
  ];
}

function getBranchContent(
  branch: string | undefined,
  attrs: Record<string, unknown>,
  slots: Slots
) {
  if (branch && slots[branch]) return slots[branch]?.();
  if (branch && attrs[branch] !== undefined) return String(attrs[branch]);
  return slots.default?.() ?? null;
}
