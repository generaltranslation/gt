import {
  HTML_CONTENT_PROPS,
  type JsxChildren,
} from '@generaltranslation/format';
import { isVariable } from 'generaltranslation/internal';
import {
  getI18nConfig,
  lookupInlineTranslation,
  type InlineTranslations,
} from 'gt-i18n/internal';
import {
  cloneElement,
  createElement,
  Fragment,
  type ReactElement,
  type ReactNode,
} from 'react';
import { getReadonlyConditionStore } from '../../condition-store/singleton-operations';
import { useGTContext } from '../../context/context';
import { getReactI18nCache } from '../../i18n-cache/singleton-operations';
import { getPluralBranch } from '../../utils/plurals/getPluralBranch';
import { computeCurrency } from '../variables/Currency.shared';
import { computeDateTime } from '../variables/DateTime.shared';
import { computeNum } from '../variables/Num.shared';

// The compiler builds these from a `<T>` call site, so nothing here walks,
// tags or hashes the children. Each component renders what `<T>` renders for
// the same children and translation.

/**
 * A variable: its name in the translation, the slot of its element, and the
 * type it formats as (`n`, `c`, `d` or `rt`) unless it prints its value.
 */
type PrecomputedVariable = { k: string; x: number; v?: string };

/**
 * An element by its id among its siblings. `x` is its slot: the element
 * without its children, or the `n` of a plural (`t: 'p'`) or the `branch` of
 * a branch (`t: 'b'`). A fragment (`t: 'f'`) has no slot.
 */
type PrecomputedElement = {
  i: number;
  x?: number;
  t?: 'p' | 'b' | 'f';
  c?: PrecomputedChildren;
  b?: Record<string, PrecomputedChildren>;
};

type PrecomputedChild =
  | string
  | boolean
  | null
  | PrecomputedVariable
  | PrecomputedElement;

/** The children of a `<T>` call site, with the values of a render left out. */
type PrecomputedChildren = PrecomputedChild | PrecomputedChild[];

type PrecomputedTextProps = {
  /** The hash of the source */
  h: string;
  /** The source text */
  s: string;
  /** The translations embedded at the call site */
  i?: InlineTranslations<JsxChildren>;
};

type PrecomputedJsxProps = {
  /** The hash of the source */
  h: string;
  /** The source children */
  s: PrecomputedChildren;
  /** The values of this render, by slot */
  v: readonly unknown[];
  /** The translations embedded at the call site */
  i?: InlineTranslations<JsxChildren>;
};

type TranslatedElement = {
  i?: number;
  c?: unknown;
  d?: Record<string, unknown> & { b?: Record<string, unknown> };
};

type RenderState = {
  slots: readonly unknown[];
  locales: string[];
  enableI18n: boolean;
};

const PLAIN_VARIABLE = 'v';

/** The props a variable the compiler precomputes can have. */
type VariableElementProps = {
  children?: unknown;
  currency?: string;
  options?: Record<string, unknown>;
};

/**
 * The translation of a call site in `locale`, or undefined when the source
 * renders.
 */
function lookupTarget(
  context: ReturnType<typeof useGTContext>,
  locale: string,
  enableI18n: boolean,
  hash: string,
  source: PrecomputedChildren,
  inline: InlineTranslations<JsxChildren> | undefined
): unknown {
  if (!enableI18n || !getI18nConfig().requiresTranslation({ locale })) {
    return undefined;
  }
  return (
    (inline && lookupInlineTranslation(inline, locale)) ??
    context?.translationsSnapshot[locale]?.[hash] ??
    getReactI18nCache().lookupTranslation(locale, source as JsxChildren, {
      $format: 'JSX',
      $_hash: hash,
    })
  );
}

/**
 * A `<T>` whose children are text.
 * @internal
 */
function GtInternalPrecomputedText({
  h,
  s,
  i,
}: PrecomputedTextProps): ReactNode {
  const context = useGTContext();
  const store = context ? undefined : getReadonlyConditionStore();
  const target = lookupTarget(
    context,
    context ? context.locale : store!.getLocale(),
    context ? context.enableI18n : store!.getEnableI18n(),
    h,
    s,
    i
  );
  if (typeof target === 'string') return target;
  // Text has nothing a translated element or variable could render
  return Array.isArray(target) && s
    ? target.filter((child) => typeof child === 'string')
    : s;
}

/**
 * A `<T>` whose children hold elements, variables or branches.
 * @internal
 */
function GtInternalPrecomputedJsx({
  h,
  s,
  v,
  i,
}: PrecomputedJsxProps): ReactNode {
  const context = useGTContext();
  const store = context ? undefined : getReadonlyConditionStore();
  const locale = context ? context.locale : store!.getLocale();
  const enableI18n = context ? context.enableI18n : store!.getEnableI18n();
  const target = lookupTarget(context, locale, enableI18n, h, s, i);
  const defaultLocale = getI18nConfig().getDefaultLocale();
  return target == null
    ? renderSource(s, { slots: v, locales: [defaultLocale], enableI18n })
    : renderTranslated(s, target, {
        slots: v,
        locales: [locale, defaultLocale],
        enableI18n,
      });
}

// ===== Source ===== //

function renderSource(
  source: PrecomputedChildren | undefined,
  state: RenderState
): ReactNode {
  return Array.isArray(source)
    ? source.map((child) => renderSourceChild(child, state))
    : renderSourceChild(source, state);
}

function renderSourceChild(
  child: PrecomputedChild | undefined,
  state: RenderState
): ReactNode {
  if (!child || typeof child !== 'object') return child;
  if ('k' in child) return renderVariable(child, state);
  const { t, c, b } = child;
  const slot = state.slots[child.x!];
  if (t === 'p') {
    if (typeof slot !== 'number')
      return c != null ? renderSource(c, state) : null;
    const branch = getPluralBranch(slot, [state.locales[0]], b || {});
    return renderSource(branch != null ? branch : c, state);
  }
  if (t === 'b') {
    const key = getBranchKey(slot);
    return renderSource(key && b?.[key] !== undefined ? b[key] : c, state);
  }
  if (t === 'f') return createElement(Fragment, null, renderSource(c, state));
  return c
    ? cloneElement(slot as ReactElement, undefined, renderSource(c, state))
    : (slot as ReactElement);
}

/**
 * A variable in the locale of the render. `type` is the type its translation
 * gives it. Where that is not the type of its component, <T> formats the
 * value and options of the component as the translation's type, through
 * the function that type's component formats with. A relative time, which
 * no precomputed variable is, is left as its component formats it.
 */
function renderVariable(
  variable: PrecomputedVariable,
  { slots, locales, enableI18n }: RenderState,
  type?: string
): ReactNode {
  const element = slots[variable.x] as ReactElement<VariableElementProps>;
  if (type !== undefined && type !== (variable.v || PLAIN_VARIABLE)) {
    const { children, currency, options } = element.props;
    const props = {
      _locale: locales[0],
      _enableI18n: enableI18n,
      children: children as never,
      options: currency === undefined ? options : { currency, ...options },
    };
    switch (type) {
      case PLAIN_VARIABLE:
        return children as ReactNode;
      case 'n':
        return computeNum(props);
      case 'c':
        return computeCurrency(props);
      case 'd':
        return computeDateTime(props);
    }
  }
  return cloneElement(element, {
    _locale: locales[0],
    _enableI18n: enableI18n,
  } as object);
}

function getBranchKey(branch: unknown): string | undefined {
  return branch == null || branch === '' ? undefined : String(branch);
}

// ===== Translation ===== //

function isSourceElement(
  child: PrecomputedChild | undefined
): child is PrecomputedElement {
  return !!child && typeof child === 'object' && !('k' in child);
}

function renderTranslated(
  source: PrecomputedChildren | undefined,
  target: unknown,
  state: RenderState
): ReactNode {
  if (target == null && source) return renderSource(source, state);
  if (typeof target === 'string') return target;

  if (Array.isArray(target) && !Array.isArray(source) && source) {
    source = [source];
  }

  if (Array.isArray(source) && Array.isArray(target)) {
    const siblings = source;
    let elements: PrecomputedElement[] | undefined;
    return target.map((child: unknown) => {
      if (typeof child === 'string') return child;
      if (isVariable(child)) {
        // A name renders its last sibling
        let variable: PrecomputedVariable | undefined;
        for (const sibling of siblings) {
          if (
            sibling &&
            typeof sibling === 'object' &&
            'k' in sibling &&
            sibling.k === child.k
          ) {
            variable = sibling;
          }
        }
        return variable
          ? renderVariable(variable, state, child.v || PLAIN_VARIABLE)
          : null;
      }
      elements ??= siblings.filter(isSourceElement);
      // Without its id, an element takes the first one left
      const element =
        elements.find(
          (sibling) => sibling.i === (child as TranslatedElement).i
        ) || elements.shift();
      return element
        ? renderTranslatedElement(element, child as TranslatedElement, state)
        : null;
    });
  }

  if (target && typeof target === 'object' && !Array.isArray(target)) {
    if (source && typeof source === 'object' && !Array.isArray(source)) {
      if ('k' in source) {
        return isVariable(target)
          ? renderVariable(source, state)
          : renderVariableAsElement(source, target as TranslatedElement, state);
      }
      if (!isVariable(target)) {
        return renderTranslatedElement(
          source,
          target as TranslatedElement,
          state
        );
      }
    }
  }

  return renderSource(source, state);
}

/**
 * A variable whose translation is an element. <T> reads the variable as the
 * element, so the text of the translation takes the place of its value.
 */
function renderVariableAsElement(
  variable: PrecomputedVariable,
  target: TranslatedElement,
  state: RenderState
): ReactNode {
  const element = state.slots[variable.x] as ReactElement<{
    children?: ReactNode;
  }>;
  const text =
    typeof target.c === 'string'
      ? target.c
      : Array.isArray(target.c)
        ? target.c.filter((child) => typeof child === 'string')
        : undefined;
  return element.props.children && text !== undefined && target.c
    ? cloneElement(element, undefined, text)
    : renderVariable(variable, state);
}

function renderTranslatedElement(
  source: PrecomputedElement,
  target: TranslatedElement,
  state: RenderState
): ReactNode {
  const { t, c, b } = source;
  const slot = state.slots[source.x!];

  if (t === 'p') {
    if (typeof slot !== 'number') return renderSourceChild(source, state);
    const sourceBranch = getPluralBranch(slot, state.locales, b || {});
    const targetBranch = getPluralBranch(
      slot,
      state.locales,
      target.d?.b || {}
    );
    return renderTranslated(
      sourceBranch != null ? sourceBranch : c,
      targetBranch != null ? targetBranch : target.c,
      state
    );
  }

  if (t === 'b') {
    const key = getBranchKey(slot);
    const targetBranches = target.d?.b || {};
    return renderTranslated(
      key && b?.[key] !== undefined ? b[key] : c,
      key && targetBranches[key] !== undefined ? targetBranches[key] : target.c,
      state
    );
  }

  if (t === 'f' && target.c) {
    return createElement(Fragment, null, renderTranslated(c, target.c, state));
  }

  if (c && target.c) {
    const children = renderTranslated(c, target.c, state);
    let props: Record<string, unknown> | undefined;
    if (target.d) {
      for (const minified in HTML_CONTENT_PROPS) {
        if (target.d[minified]) {
          (props ??= {})[
            HTML_CONTENT_PROPS[minified as keyof typeof HTML_CONTENT_PROPS]
          ] = target.d[minified];
        }
      }
    }
    return cloneElement(slot as ReactElement, props, children);
  }

  return renderSourceChild(source, state);
}

export { GtInternalPrecomputedJsx, GtInternalPrecomputedText };
export type { PrecomputedChildren, PrecomputedJsxProps, PrecomputedTextProps };
