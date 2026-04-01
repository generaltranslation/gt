import { GtInternalNum } from '../GtInternalNum';
import { GtInternalVar } from '../GtInternalVar';
import { GtInternalCurrency } from '../GtInternalCurrency';
import { GtInternalDateTime } from '../GtInternalDateTime';
import { RenderVariable } from '@generaltranslation/react-core/types';

/**
 * Custom override for the renderVariable function
 * to use the GtInternal components instead of the regular components
 *
 * TODO: There are other params that these components should take in (name, locales, etc.), double check we aren't missing these
 */
export const renderVariable: RenderVariable = ({
  variableType,
  variableValue,
  variableOptions,
}) => {
  if (variableType === 'n') {
    return (
      <GtInternalNum options={variableOptions}>{variableValue}</GtInternalNum>
    );
  } else if (variableType === 'd') {
    return (
      <GtInternalDateTime options={variableOptions}>
        {variableValue}
      </GtInternalDateTime>
    );
  } else if (variableType === 'c') {
    return (
      <GtInternalCurrency options={variableOptions}>
        {variableValue}
      </GtInternalCurrency>
    );
  }
  return <GtInternalVar>{variableValue}</GtInternalVar>;
};
