import {
  Currency as GtExternalCurrency,
  GtInternalCurrency,
} from '../../components/variables/Currency';
import {
  DateTime as GtExternalDateTime,
  GtInternalDateTime,
} from '../../components/variables/DateTime';
import {
  GtInternalNum,
  Num as GtExternalNum,
} from '../../components/variables/Num';
import {
  GtInternalRelativeTime,
  RelativeTime as GtExternalRelativeTime,
} from '../../components/variables/RelativeTime';
import {
  GtInternalVar,
  Var as GtExternalVar,
} from '../../components/variables/Var';
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
    const Num = injectionType === 'automatic' ? GtExternalNum : GtInternalNum;
    const numOptions = variableOptions as Intl.NumberFormatOptions | undefined;
    return (
      <Num {...internalProps} options={numOptions}>
        {variableValue as number | string | null | undefined}
      </Num>
    );
  }
  if (variableType === 'd') {
    const DateTime =
      injectionType === 'automatic' ? GtExternalDateTime : GtInternalDateTime;
    const dateTimeOptions = variableOptions as
      | Intl.DateTimeFormatOptions
      | undefined;
    return (
      <DateTime {...internalProps} options={dateTimeOptions}>
        {variableValue as Date | null | undefined}
      </DateTime>
    );
  }
  if (variableType === 'c') {
    const Currency =
      injectionType === 'automatic' ? GtExternalCurrency : GtInternalCurrency;
    const currencyOptions = variableOptions as
      | Intl.NumberFormatOptions
      | undefined;
    return (
      <Currency {...internalProps} options={currencyOptions}>
        {variableValue as number | string | null | undefined}
      </Currency>
    );
  }
  if (variableType === 'rt') {
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
        : typeof variableValue === 'string' || typeof variableValue === 'number'
          ? new Date(variableValue)
          : undefined;
    return (
      <RelativeTime
        {...internalProps}
        date={dateValue && !isNaN(dateValue.getTime()) ? dateValue : undefined}
        baseDate={relativeTimeOptions?.baseDate}
        options={relativeTimeOptions}
      />
    );
  }
  const renderedValue = variableValue as ReactNode;
  const Var = injectionType === 'automatic' ? GtInternalVar : GtExternalVar;
  return <Var {...internalProps}>{renderedValue}</Var>;
};

// ===== Exports ===== //

export { renderVariable };
