import type { ReactNode } from 'react';
import { Num } from '../../variables/Num';
import { Var } from '../../variables/Var';
import { Currency } from '../../variables/Currency';
import { DateTime } from '../../variables/DateTime';
import { RelativeTime } from '../../variables/RelativeTime';
import { RenderVariable } from 'gt-react/internal';

export const renderVariable: RenderVariable = ({
  variableType,
  variableValue,
  variableOptions,
}) => {
  if (variableType === 'n') {
    const numValue =
      typeof variableValue === 'string' || typeof variableValue === 'number'
        ? variableValue
        : variableValue == null
          ? variableValue
          : undefined;
    return (
      <Num options={variableOptions as Intl.NumberFormatOptions}>
        {numValue}
      </Num>
    );
  } else if (variableType === 'd') {
    const dateValue = variableValue instanceof Date ? variableValue : undefined;
    return (
      <DateTime options={variableOptions as Intl.DateTimeFormatOptions}>
        {dateValue}
      </DateTime>
    );
  } else if (variableType === 'c') {
    const currencyValue =
      typeof variableValue === 'string' || typeof variableValue === 'number'
        ? variableValue
        : variableValue == null
          ? variableValue
          : undefined;
    return (
      <Currency options={variableOptions as Intl.NumberFormatOptions}>
        {currencyValue}
      </Currency>
    );
  } else if (variableType === 'rt') {
    const rtOptions = variableOptions as Intl.RelativeTimeFormatOptions & {
      unit?: Intl.RelativeTimeFormatUnit;
      baseDate?: Date;
    };
    // RelativeTime supports two modes:
    // 1. value + unit (e.g., value=-3, unit="hour") — explicit relative time
    // 2. date (Date object) — auto-select unit from date difference
    if (typeof variableValue === 'number' && rtOptions?.unit) {
      return (
        <RelativeTime
          value={variableValue}
          unit={rtOptions.unit}
          baseDate={rtOptions?.baseDate}
          options={rtOptions}
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
        date={dateValue && !isNaN(dateValue.getTime()) ? dateValue : undefined}
        baseDate={rtOptions?.baseDate}
        options={rtOptions}
      />
    );
  }
  return <Var>{variableValue as ReactNode}</Var>;
};
