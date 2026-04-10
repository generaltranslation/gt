import Num from '../variables/Num';
import Var from '../variables/Var';
import Currency from '../variables/Currency';
import DateTime from '../variables/DateTime';
import RelativeTime from '../variables/RelativeTime';
import { RelativeTimeFormatOptions, RenderVariable } from '../types-dir/types';

const renderVariable: RenderVariable = ({
  variableType,
  variableValue,
  variableOptions,
}) => {
  if (variableType === 'n') {
    const numOptions = variableOptions as Intl.NumberFormatOptions | undefined;
    return <Num options={numOptions}>{variableValue}</Num>;
  } else if (variableType === 'd') {
    const dateTimeOptions = variableOptions as
      | Intl.DateTimeFormatOptions
      | undefined;
    return <DateTime options={dateTimeOptions}>{variableValue}</DateTime>;
  } else if (variableType === 'c') {
    const currencyOptions = variableOptions as
      | Intl.NumberFormatOptions
      | undefined;
    return <Currency options={currencyOptions}>{variableValue}</Currency>;
  } else if (variableType === 'rt') {
    // RelativeTime supports two modes:
    // 1. value + unit (e.g., value=-3, unit="hour") — explicit relative time
    // 2. date (Date object) — auto-select unit from date difference
    const relativeTimeOptions = variableOptions as
      | RelativeTimeFormatOptions
      | undefined;
    if (typeof variableValue === 'number' && relativeTimeOptions?.unit) {
      return (
        <RelativeTime
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
        date={dateValue && !isNaN(dateValue.getTime()) ? dateValue : undefined}
        baseDate={relativeTimeOptions?.baseDate}
        options={relativeTimeOptions}
      />
    );
  }
  return <Var>{variableValue}</Var>;
};
export default renderVariable;
