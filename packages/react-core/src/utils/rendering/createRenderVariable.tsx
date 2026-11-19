import type { ResolvedCurrencyProps } from '../../components/variables/Currency.shared';
import type { ResolvedDateTimeProps } from '../../components/variables/DateTime.shared';
import type { ResolvedNumProps } from '../../components/variables/Num.shared';
import type { ResolvedRelativeTimeProps } from '../../components/variables/RelativeTime.shared';
import type { RelativeTimeFormatOptions, RenderVariable } from '../types';
import { VARIABLE_TYPES } from '@generaltranslation/format';
import { defaultDefaultLocale } from '@generaltranslation/format/internal';
import { ReactNode } from 'react';

// Factory shared by the hook-based and RSC variable renderers: the branching
// logic is written once and the concrete components are injected, so the RSC
// renderer never statically imports the hook-based variable components. This
// module must stay free of hook/context imports so it can be reached from the
// components-rsc entrypoint.

type RenderableNode = ReactNode | Promise<ReactNode>;

type VariableComponents = {
  Currency: (props: ResolvedCurrencyProps) => RenderableNode;
  GtInternalCurrency: (props: ResolvedCurrencyProps) => RenderableNode;
  DateTime: (props: ResolvedDateTimeProps) => RenderableNode;
  GtInternalDateTime: (props: ResolvedDateTimeProps) => RenderableNode;
  Num: (props: ResolvedNumProps) => RenderableNode;
  GtInternalNum: (props: ResolvedNumProps) => RenderableNode;
  RelativeTime: (props: ResolvedRelativeTimeProps) => RenderableNode;
  GtInternalRelativeTime: (props: ResolvedRelativeTimeProps) => RenderableNode;
  Var: (props: {
    children: ReactNode;
    name?: string;
    _locale: string;
    _enableI18n: boolean;
  }) => RenderableNode;
  GtInternalVar: (props: {
    children: ReactNode;
    name?: string;
    _locale: string;
    _enableI18n: boolean;
  }) => RenderableNode;
};

function createRenderVariable({
  Currency: GtExternalCurrency,
  GtInternalCurrency,
  DateTime: GtExternalDateTime,
  GtInternalDateTime,
  Num: GtExternalNum,
  GtInternalNum,
  RelativeTime: GtExternalRelativeTime,
  GtInternalRelativeTime,
  Var: GtExternalVar,
  GtInternalVar,
}: VariableComponents): RenderVariable {
  return function renderVariable({
    variableType,
    variableValue,
    variableOptions,
    locales,
    enableI18n,
    injectionType,
  }) {
    const locale = locales[0] ?? defaultDefaultLocale;
    const internalProps = {
      _locale: locale,
      _enableI18n: enableI18n,
    };

    if (
      variableType === VARIABLE_TYPES.number ||
      variableType === VARIABLE_TYPES.count
    ) {
      const Num = injectionType === 'automatic' ? GtExternalNum : GtInternalNum;
      const numOptions = variableOptions as
        | Intl.NumberFormatOptions
        | undefined;
      return (
        <Num {...internalProps} options={numOptions}>
          {variableValue as ResolvedNumProps['children']}
        </Num>
      );
    }
    if (variableType === VARIABLE_TYPES.datetime) {
      const DateTime =
        injectionType === 'automatic' ? GtExternalDateTime : GtInternalDateTime;
      const dateTimeOptions = variableOptions as
        | Intl.DateTimeFormatOptions
        | undefined;
      return (
        <DateTime {...internalProps} options={dateTimeOptions}>
          {variableValue as ResolvedDateTimeProps['children']}
        </DateTime>
      );
    }
    if (variableType === VARIABLE_TYPES.currency) {
      const Currency =
        injectionType === 'automatic' ? GtExternalCurrency : GtInternalCurrency;
      const currencyOptions = variableOptions as
        | Intl.NumberFormatOptions
        | undefined;
      return (
        <Currency
          {...internalProps}
          currency={currencyOptions?.currency as string}
          options={currencyOptions}
        >
          {variableValue as ResolvedCurrencyProps['children']}
        </Currency>
      );
    }
    if (variableType === VARIABLE_TYPES.relativetime) {
      const RelativeTime =
        injectionType === 'automatic'
          ? GtExternalRelativeTime
          : GtInternalRelativeTime;
      const relativeTimeOptions = variableOptions as
        | RelativeTimeFormatOptions
        | undefined;
      if (typeof variableValue === 'number' && relativeTimeOptions?.unit) {
        return (
          <RelativeTime
            {...internalProps}
            value={variableValue}
            unit={relativeTimeOptions.unit}
            baseDate={relativeTimeOptions?.baseDate}
            options={relativeTimeOptions}
          />
        );
      }
      const dateValue =
        variableValue instanceof Date
          ? variableValue
          : typeof variableValue === 'string' ||
              typeof variableValue === 'number'
            ? new Date(variableValue)
            : undefined;
      return (
        <RelativeTime
          {...internalProps}
          baseDate={relativeTimeOptions?.baseDate}
          options={relativeTimeOptions}
        >
          {dateValue && !isNaN(dateValue.getTime()) ? dateValue : undefined}
        </RelativeTime>
      );
    }
    const renderedValue = variableValue as ReactNode;
    const Var = injectionType === 'automatic' ? GtInternalVar : GtExternalVar;
    return <Var {...internalProps}>{renderedValue}</Var>;
  };
}

// ===== Exports ===== //

export { createRenderVariable };
export type { VariableComponents };
