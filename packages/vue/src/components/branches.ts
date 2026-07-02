import type { GTFunctionalComponent } from '../types';
import { getConditionStore } from '../condition-store';
import { getFormatLocales } from '../internal/getFormatLocales';
import { getPluralBranch } from '../internal/getPluralBranch';

type BranchProps = {
  branch?: string | number | boolean;
  _locale?: string;
  _enableI18n?: boolean;
};

/**
 * Renders one of its named slots based on the `branch` prop, falling back to
 * the default slot. Inside `<T>`, all branches are translated.
 *
 * ```html
 * <Branch :branch="status">
 *   <template #active><p>Active</p></template>
 *   <template #inactive><p>Inactive</p></template>
 *   <p>Unknown</p>
 * </Branch>
 * ```
 */
export const Branch: GTFunctionalComponent<BranchProps> = (
  props,
  { slots }
) => {
  const branchKey =
    props.branch == null || props.branch === ''
      ? undefined
      : props.branch.toString();
  const slot = branchKey && slots[branchKey] ? slots[branchKey] : slots.default;
  return slot ? slot() : null;
};
Branch.props = ['branch', '_locale', '_enableI18n'];
Branch.inheritAttrs = false;
Branch._gtt = 'branch';

type PluralProps = {
  n: number;
  locales?: string[];
  _locale?: string;
  _enableI18n?: boolean;
};

/**
 * Renders the named slot matching the plural form of `n` for the current
 * locale, falling back to the default slot. Inside `<T>`, all plural forms
 * are translated.
 *
 * ```html
 * <Plural :n="count">
 *   <template #one><p>You have one item.</p></template>
 *   <template #other><p>You have {{ count }} items.</p></template>
 * </Plural>
 * ```
 */
export const Plural: GTFunctionalComponent<PluralProps> = (
  props,
  { slots }
) => {
  if (typeof props.n !== 'number') {
    return slots.default ? slots.default() : null;
  }
  const locales = getFormatLocales({
    locale: props._locale ?? getConditionStore().getLocale(),
    enableI18n: props._enableI18n ?? getConditionStore().getEnableI18n(),
    localesProp: props.locales ?? [],
  });
  const branches: Record<string, () => unknown> = {};
  for (const [name, slot] of Object.entries(slots)) {
    if (name !== 'default' && typeof slot === 'function') {
      branches[name] = slot as () => unknown;
    }
  }
  const branch = getPluralBranch(props.n, locales, branches);
  if (branch) return branch();
  return slots.default ? slots.default() : null;
};
Plural.props = ['n', 'locales', '_locale', '_enableI18n'];
Plural.inheritAttrs = false;
Plural._gtt = 'plural';
