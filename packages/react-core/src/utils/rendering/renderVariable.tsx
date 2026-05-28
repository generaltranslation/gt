import { GtInternalCurrency } from '../../components/variables/Currency';
import { GtInternalDateTime } from '../../components/variables/DateTime';
import { GtInternalNum } from '../../components/variables/Num';
import { GtInternalRelativeTime } from '../../components/variables/RelativeTime';
import { GtInternalVar } from '../../components/variables/Var';
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
}) => {
  const locale = locales[0] ?? libraryDefaultLocale;

  if (variableType === 'n') {
    const numOptions = variableOptions as Intl.NumberFormatOptions | undefined;
    return (
      <GtInternalNum
        _locale={locale}
        _enableI18n={enableI18n}
        options={numOptions}
      >
        {variableValue as number | string | null | undefined}
      </GtInternalNum>
    );
  }
  if (variableType === 'd') {
    const dateTimeOptions = variableOptions as
      | Intl.DateTimeFormatOptions
      | undefined;
    return (
      <GtInternalDateTime
        _locale={locale}
        _enableI18n={enableI18n}
        options={dateTimeOptions}
      >
        {variableValue as Date | null | undefined}
      </GtInternalDateTime>
    );
  }
  if (variableType === 'c') {
    const currencyOptions = variableOptions as
      | Intl.NumberFormatOptions
      | undefined;
    return (
      <GtInternalCurrency
        _locale={locale}
        _enableI18n={enableI18n}
        options={currencyOptions}
      >
        {variableValue as number | string | null | undefined}
      </GtInternalCurrency>
    );
  }
  if (variableType === 'rt') {
    const relativeTimeOptions = variableOptions as
      | RelativeTimeFormatOptions
      | undefined;
    if (typeof variableValue === 'number' && relativeTimeOptions?.unit) {
      return (
        <GtInternalRelativeTime
          _locale={locale}
          _enableI18n={enableI18n}
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
      <GtInternalRelativeTime
        _locale={locale}
        _enableI18n={enableI18n}
        date={dateValue && !isNaN(dateValue.getTime()) ? dateValue : undefined}
        baseDate={relativeTimeOptions?.baseDate}
        options={relativeTimeOptions}
      />
    );
  }
  return (
    <GtInternalVar _locale={locale} _enableI18n={enableI18n}>
      {variableValue as ReactNode}
    </GtInternalVar>
  );
};

// ===== Exports ===== //

export { renderVariable };
