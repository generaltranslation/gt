import Num from '../../variables/Num';
import Var from '../../variables/Var';
import Currency from '../../variables/Currency';
import DateTime from '../../variables/DateTime';
import { RenderVariable } from '../../types/types';

const renderVariable: RenderVariable = ({
  variableType,
  variableValue,
  variableOptions,
  locales,
}) => {
  if (variableType === 'number') {
    return (
      <Num value={variableValue} options={variableOptions} locales={locales} />
    );
  } else if (variableType === 'datetime') {
    return (
      <DateTime
        value={variableValue}
        options={variableOptions}
        locales={locales}
      />
    );
  } else if (variableType === 'currency') {
    return (
      <Currency
        value={variableValue}
        options={variableOptions}
        locales={locales}
      />
    );
  }
  return <Var value={variableValue} />;
};
export default renderVariable;
