import Num from '../variables/Num';
import Var from '../variables/Var';
import Currency from '../variables/Currency';
import DateTime from '../variables/DateTime';
import { RenderVariable } from '../types/types';

const renderVariable: RenderVariable = ({
  variableType,
  variableValue,
  variableOptions,
}) => {
  if (variableType === 'number') {
    return <Num options={variableOptions}>{variableValue}</Num>;
  } else if (variableType === 'datetime') {
    return <DateTime options={variableOptions}>{variableValue}</DateTime>;
  } else if (variableType === 'currency') {
    return <Currency options={variableOptions}>{variableValue}</Currency>;
  }
  return <Var>{variableValue}</Var>;
};
export default renderVariable;
