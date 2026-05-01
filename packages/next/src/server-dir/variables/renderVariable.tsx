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
    return (
      <Num options={variableOptions as Intl.NumberFormatOptions}>
        {variableValue}
      </Num>
    );
  } else if (variableType === 'd') {
    return (
      <DateTime options={variableOptions as Intl.DateTimeFormatOptions}>
        {variableValue}
      </DateTime>
    );
  } else if (variableType === 'c') {
    return (
      <Currency options={variableOptions as Intl.NumberFormatOptions}>
        {variableValue}
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
  return <Var>{variableValue}</Var>;
};
