import { libraryDefaultLocale } from 'generaltranslation/internal';
import {
  decodeMsg,
  decodeOptions,
  decodeVars,
  declareVar,
  derive,
  gtFallback,
  mFallback,
  msg,
} from 'gt-i18n';
import {
  getI18nConfig,
  initializeI18nConfig,
  ReadonlyConditionStore,
  WritableConditionStore,
} from 'gt-i18n/internal';
import type { ReactNode } from 'react';
import { computeBranch } from './components/branches/computeBranch';
import type { BranchProps } from './components/branches/computeBranch';
import { computePlural } from './components/branches/computePlural';
import type { PluralProps } from './components/branches/computePlural';
import { computeDerive } from './components/derivation/computeDerive';
import type { DeriveProps } from './components/derivation/computeDerive';
import { computeCurrency } from './components/variables/computeCurrency';
import type { CurrencyProps } from './components/variables/computeCurrency';
import { computeDateTime } from './components/variables/computeDateTime';
import type { DateTimeProps } from './components/variables/computeDateTime';
import { computeNum } from './components/variables/computeNum';
import type { NumProps } from './components/variables/computeNum';
import { computeRelativeTime } from './components/variables/computeRelativeTime';
import type { RelativeTimeProps } from './components/variables/computeRelativeTime';
import { computeVar } from './components/variables/Var';
import {
  getReadonlyConditionStoreWithFallback,
  setReadonlyConditionStore,
} from './condition-store/singleton-operations';
import { getTranslationsSnapshot } from './functions/helpers/getTranslationsSnapshot';
import { t } from './functions/translation/t';
import { getFormatLocales } from './hooks/format-locales';
import {
  getReactI18nCache,
  setReactI18nCache,
} from './i18n-cache/singleton-operations';
import { internalInitializeGTSRA } from './setup/initializeGTSRA';
import { getRenderStrategy, setRenderStrategy } from './setup/globals';
import { renderPreparedT } from './utils/rendering/renderPreparedT';
import { prepareT } from './utils/translation/prepareTPure';
import type { JsxTranslationOptions } from './utils/translation/prepareTPure';
import type { RelativeTimeFormatOptions, RenderVariable } from './utils/types';

type RequestConditions = {
  _locale?: string;
  _enableI18n?: boolean;
};

function getResolvedConditions({ _locale, _enableI18n }: RequestConditions): {
  _locale: string;
  _enableI18n: boolean;
} {
  const conditionStore =
    _locale == null || _enableI18n == null
      ? getReadonlyConditionStoreWithFallback()
      : undefined;
  return {
    _locale: _locale ?? conditionStore?.getLocale() ?? libraryDefaultLocale,
    _enableI18n: _enableI18n ?? conditionStore?.getEnableI18n() ?? true,
  };
}

function RscBranch(props: BranchProps): ReactNode {
  return computeBranch(props);
}

function GtInternalBranch(props: BranchProps): ReactNode {
  return computeBranch(props);
}

function RscPlural({ _locale, _enableI18n, ...props }: PluralProps): ReactNode {
  return computePlural({
    ...props,
    ...getResolvedConditions({ _locale, _enableI18n }),
  });
}

function GtInternalPlural(props: PluralProps): ReactNode {
  return RscPlural(props);
}

function RscDerive<T extends ReactNode>(props: DeriveProps<T>): T {
  return computeDerive(props);
}

function GtInternalDerive<T extends ReactNode>(props: DeriveProps<T>): T {
  return computeDerive(props);
}

function RscCurrency({
  _locale,
  _enableI18n,
  ...props
}: CurrencyProps): string | null {
  return computeCurrency({
    ...props,
    ...getResolvedConditions({ _locale, _enableI18n }),
  });
}

function GtInternalCurrency(props: CurrencyProps): string | null {
  return RscCurrency(props);
}

function RscDateTime({
  _locale,
  _enableI18n,
  ...props
}: DateTimeProps): string | null {
  return computeDateTime({
    ...props,
    ...getResolvedConditions({ _locale, _enableI18n }),
  });
}

function GtInternalDateTime(props: DateTimeProps): string | null {
  return RscDateTime(props);
}

function RscNum({ _locale, _enableI18n, ...props }: NumProps): string | null {
  return computeNum({
    ...props,
    ...getResolvedConditions({ _locale, _enableI18n }),
  });
}

function GtInternalNum(props: NumProps): string | null {
  return RscNum(props);
}

function RscRelativeTime({
  _locale,
  _enableI18n,
  ...props
}: RelativeTimeProps): string | null {
  return computeRelativeTime({
    ...props,
    ...getResolvedConditions({ _locale, _enableI18n }),
  });
}

function GtInternalRelativeTime(props: RelativeTimeProps): string | null {
  return RscRelativeTime(props);
}

function RscVar<T extends ReactNode>(props: {
  children: T;
  name?: string;
  _locale?: string;
  _enableI18n?: boolean;
}): T {
  return computeVar(props);
}

function GtInternalVar<T extends ReactNode>(props: {
  children: T;
  name?: string;
  _locale?: string;
  _enableI18n?: boolean;
}): T {
  return computeVar(props);
}

const renderRscVariable: RenderVariable = ({
  variableType,
  variableValue,
  variableOptions,
  locales,
  enableI18n,
}) => {
  const internalProps = {
    _locale: locales[0] ?? libraryDefaultLocale,
    _enableI18n: enableI18n,
  };

  if (variableType === 'n') {
    return RscNum({
      ...internalProps,
      options: variableOptions as Intl.NumberFormatOptions | undefined,
      children: variableValue as number | string | null | undefined,
    });
  }

  if (variableType === 'd') {
    return RscDateTime({
      ...internalProps,
      options: variableOptions as Intl.DateTimeFormatOptions | undefined,
      children: variableValue as Date | null | undefined,
    });
  }

  if (variableType === 'c') {
    return RscCurrency({
      ...internalProps,
      options: variableOptions as Intl.NumberFormatOptions | undefined,
      children: variableValue as number | string | null | undefined,
    });
  }

  if (variableType === 'rt') {
    const relativeTimeOptions = variableOptions as
      | RelativeTimeFormatOptions
      | undefined;
    if (typeof variableValue === 'number' && relativeTimeOptions?.unit) {
      return RscRelativeTime({
        ...internalProps,
        value: variableValue,
        unit: relativeTimeOptions.unit,
        baseDate: relativeTimeOptions?.baseDate,
        options: relativeTimeOptions,
      });
    }
    const dateValue =
      variableValue instanceof Date
        ? variableValue
        : typeof variableValue === 'string' || typeof variableValue === 'number'
          ? new Date(variableValue)
          : undefined;
    return RscRelativeTime({
      ...internalProps,
      date: dateValue && !isNaN(dateValue.getTime()) ? dateValue : undefined,
      baseDate: relativeTimeOptions?.baseDate,
      options: relativeTimeOptions,
    });
  }

  return RscVar({
    ...internalProps,
    children: variableValue as ReactNode,
  });
};

async function RscT({
  children: sourceChildren,
  locale: localeProp,
  enableI18n: enableI18nProp,
  _locale,
  _enableI18n,
  ...params
}: {
  children: ReactNode;
  locale?: string;
  enableI18n?: boolean;
  _locale?: string;
  _enableI18n?: boolean;
} & JsxTranslationOptions): Promise<ReactNode> {
  const locale =
    localeProp ??
    _locale ??
    getReadonlyConditionStoreWithFallback().getLocale();
  const enableI18n =
    enableI18nProp ??
    _enableI18n ??
    getReadonlyConditionStoreWithFallback().getEnableI18n();
  const defaultLocale = getI18nConfig().getDefaultLocale();
  const shouldTranslate =
    enableI18n && getI18nConfig().requiresTranslation(locale);
  const prepared = prepareT({
    sourceChildren,
    params,
    locale,
  });

  if (!shouldTranslate) {
    return renderPreparedT({
      ...prepared,
      targetJsxChildren: undefined,
      locale,
      defaultLocale,
      enableI18n,
      shouldTranslate,
      renderVariable: renderRscVariable,
    });
  }

  const lookupTranslation =
    await getReactI18nCache().getLookupTranslation(locale);
  const targetJsxChildren = lookupTranslation(
    prepared.sourceJsxChildren,
    prepared.targetOptions
  );

  return renderPreparedT({
    ...prepared,
    targetJsxChildren,
    locale,
    defaultLocale,
    enableI18n,
    shouldTranslate,
    renderVariable: renderRscVariable,
  });
}

function useLocale(): string {
  return getReadonlyConditionStoreWithFallback().getLocale();
}

function useEnableI18n(): boolean {
  return getReadonlyConditionStoreWithFallback().getEnableI18n();
}

function useCustomMapping() {
  return getI18nConfig().getCustomMapping();
}

function useDefaultLocale(): string {
  return getI18nConfig().getDefaultLocale();
}

function useLocales(): readonly string[] {
  return getI18nConfig().getLocales();
}

function useFormatLocales(localesProp?: string[]): string[] {
  const conditionStore = getReadonlyConditionStoreWithFallback();
  return getFormatLocales({
    locale: conditionStore.getLocale(),
    enableI18n: conditionStore.getEnableI18n(),
    localesProp,
  });
}

/** @internal _gtt - The GT transformation for the component. */
RscBranch._gtt = 'branch';
GtInternalBranch._gtt = 'branch-automatic';
RscPlural._gtt = 'plural';
GtInternalPlural._gtt = 'plural-automatic';
RscDerive._gtt = 'derive';
GtInternalDerive._gtt = 'derive-automatic';
RscT._gtt = 'translate-server';
RscCurrency._gtt = 'variable-currency';
GtInternalCurrency._gtt = 'variable-currency-automatic';
RscDateTime._gtt = 'variable-datetime';
GtInternalDateTime._gtt = 'variable-datetime-automatic';
RscNum._gtt = 'variable-number';
GtInternalNum._gtt = 'variable-number-automatic';
RscRelativeTime._gtt = 'variable-relative-time';
GtInternalRelativeTime._gtt = 'variable-relative-time-automatic';
RscVar._gtt = 'variable-variable';
GtInternalVar._gtt = 'variable-variable-automatic';

const Branch = RscBranch;
const Plural = RscPlural;
const Derive = RscDerive;
const T = RscT;
const GtInternalTranslateJsx = RscT;
const Currency = RscCurrency;
const DateTime = RscDateTime;
const Num = RscNum;
const RelativeTime = RscRelativeTime;
const Var = RscVar;

export {
  Branch,
  Currency,
  DateTime,
  decodeMsg,
  decodeOptions,
  decodeVars,
  declareVar,
  Derive,
  derive,
  getFormatLocales,
  getReactI18nCache,
  getRenderStrategy,
  getReadonlyConditionStoreWithFallback,
  getTranslationsSnapshot,
  GtInternalBranch,
  GtInternalCurrency,
  GtInternalDateTime,
  GtInternalDerive,
  GtInternalNum,
  GtInternalPlural,
  GtInternalRelativeTime,
  GtInternalTranslateJsx,
  GtInternalVar,
  gtFallback,
  initializeI18nConfig,
  internalInitializeGTSRA,
  mFallback,
  msg,
  Num,
  Plural,
  ReadonlyConditionStore,
  RelativeTime,
  renderPreparedT,
  RscBranch,
  RscCurrency,
  RscDateTime,
  RscDerive,
  RscNum,
  RscPlural,
  RscRelativeTime,
  RscT,
  RscVar,
  setReactI18nCache,
  setReadonlyConditionStore,
  setRenderStrategy,
  T,
  t,
  useCustomMapping,
  useDefaultLocale,
  useEnableI18n,
  useFormatLocales,
  useLocale,
  useLocales,
  Var,
  WritableConditionStore,
};
export type {
  BranchProps,
  CurrencyProps,
  DateTimeProps,
  DeriveProps,
  JsxTranslationOptions,
  NumProps,
  PluralProps,
  RelativeTimeFormatOptions,
  RelativeTimeProps,
  RenderVariable,
};
