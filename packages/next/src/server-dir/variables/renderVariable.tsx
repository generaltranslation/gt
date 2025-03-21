import Num from '../../variables/Num';
import Var from '../../variables/Var';
import Currency from '../../variables/Currency';
import DateTime from '../../variables/DateTime';
import { RenderVariable } from 'gt-react/internal';

const renderVariable: RenderVariable = ({
  variableType,
  variableValue,
  variableOptions,
  locales,
}) => {
  if (variableType === 'number') {
    return (
      <Num options={variableOptions} locales={locales}>
        {variableValue}
      </Num>
    );
  } else if (variableType === 'datetime') {
    return (
      <DateTime options={variableOptions} locales={locales}>
        {variableValue}
      </DateTime>
    );
  } else if (variableType === 'currency') {
    return (
      <Currency options={variableOptions} locales={locales}>
        {variableValue}
      </Currency>
    );
  }
  return <Var>{variableValue}</Var>;
};

export default renderVariable;
