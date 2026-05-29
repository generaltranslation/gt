import {
  Currency,
  GtInternalCurrency,
} from '../../components/variables/Currency';
import {
  DateTime,
  GtInternalDateTime,
} from '../../components/variables/DateTime';
import { GtInternalNum, Num } from '../../components/variables/Num';
import {
  GtInternalRelativeTime,
  RelativeTime,
} from '../../components/variables/RelativeTime';
import { Var } from '../../components/variables/Var';
import type { RelativeTimeFormatOptions, RenderVariable } from '../types';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import { ReactNode } from 'react';

// ===== Renderer ===== //

const renderVariable: RenderVariable = ({
  variableType,
  variableValue,
  variableOptions,
  locales,
  enableI18n,
  injectionType,
}) => {
  const locale = locales[0] ?? libraryDefaultLocale;
  const internalProps = {
    _locale: locale,
    _enableI18n: enableI18n,
  };

  if (variableType === 'n') {
    const Component = injectionType === 'automatic' ? Num : GtInternalNum;
    const numOptions = variableOptions as Intl.NumberFormatOptions | undefined;
    return (
      <Component {...internalProps} options={numOptions}>
        {variableValue as number | string | null | undefined}
      </Component>
    );
  }
  if (variableType === 'd') {
    const Component =
      injectionType === 'automatic' ? DateTime : GtInternalDateTime;
    const dateTimeOptions = variableOptions as
      | Intl.DateTimeFormatOptions
      | undefined;
    return (
      <Component {...internalProps} options={dateTimeOptions}>
        {variableValue as Date | null | undefined}
      </Component>
    );
  }
  if (variableType === 'c') {
    const Component =
      injectionType === 'automatic' ? Currency : GtInternalCurrency;
    const currencyOptions = variableOptions as
      | Intl.NumberFormatOptions
      | undefined;
    return (
      <Component {...internalProps} options={currencyOptions}>
        {variableValue as number | string | null | undefined}
      </Component>
    );
  }
  if (variableType === 'rt') {
    const Component =
      injectionType === 'automatic' ? RelativeTime : GtInternalRelativeTime;
    const relativeTimeOptions = variableOptions as
      | RelativeTimeFormatOptions
      | undefined;
    if (typeof variableValue === 'number' && relativeTimeOptions?.unit) {
      return (
        <Component
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
        : typeof variableValue === 'string' || typeof variableValue === 'number'
          ? new Date(variableValue)
          : undefined;
    return (
      <Component
        {...internalProps}
        date={dateValue && !isNaN(dateValue.getTime()) ? dateValue : undefined}
        baseDate={relativeTimeOptions?.baseDate}
        options={relativeTimeOptions}
      />
    );
  }
  const renderedValue = variableValue as ReactNode;
  return injectionType === 'automatic' ? (
    renderedValue
  ) : (
    <Var {...internalProps}>{renderedValue}</Var>
  );
};

// ===== Exports ===== //

export { renderVariable };
