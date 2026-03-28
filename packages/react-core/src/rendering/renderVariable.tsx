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
    return <RelativeTime date={variableValue instanceof Date ? variableValue : undefined} options={variableOptions} />;
  }
  return <Var>{variableValue}</Var>;
};
export default renderVariable;
