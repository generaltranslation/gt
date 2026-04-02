import Num from '../variables/Num';
import Var from '../variables/Var';
import Currency from '../variables/Currency';
import DateTime from '../variables/DateTime';
import RelativeTime from '../variables/RelativeTime';
import { RenderVariable } from '../types-dir/types';

const renderVariable: RenderVariable = ({
  variableType,
  variableValue,
  variableOptions,
}) => {
  if (variableType === 'n') {
    return <Num options={variableOptions}>{variableValue}</Num>;
  } else if (variableType === 'd') {
    return <DateTime options={variableOptions}>{variableValue}</DateTime>;
  } else if (variableType === 'c') {
    return <Currency options={variableOptions}>{variableValue}</Currency>;
  } else if (variableType === 'rt') {
    // RelativeTime supports two modes:
    // 1. value + unit (e.g., value=-3, unit="hour") — explicit relative time
    // 2. date (Date object) — auto-select unit from date difference
    if (typeof variableValue === 'number' && variableOptions?.unit) {
      return (
        <RelativeTime
          value={variableValue}
          unit={variableOptions.unit}
          baseDate={variableOptions?.baseDate}
          options={variableOptions}
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
        baseDate={variableOptions?.baseDate}
        options={variableOptions}
      />
    );
  }
  return <Var>{variableValue}</Var>;
};
export default renderVariable;
