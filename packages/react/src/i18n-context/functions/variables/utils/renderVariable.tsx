import { GtInternalNum, Num as GtExternalNum } from '../GtInternalNum';
import { Var as GtExternalVar } from '../GtInternalVar';
import { computeVar } from './computeVar';
import {
  GtInternalCurrency,
  Currency as GtExternalCurrency,
} from '../GtInternalCurrency';
import {
  GtInternalDateTime,
  DateTime as GtExternalDateTime,
} from '../GtInternalDateTime';
import { RenderVariable } from '@generaltranslation/react-core/types';

/**
 * Custom override for the renderVariable function
 * to use the GtInternal components instead of the regular components
 *
 * We have to remove injected Variable components at runtime because the user would not expect them to be there.
 * For example, we could end up with:
 * const name = "John";
 * <StringOnly>{name}</StringOnly> -> <StringOnly><_Var>John</_Var></StringOnly>
 * This could break logic.
 *
 * TODO: There are other params that these components should take in (name, locales, etc.), double check we aren't missing these
 */
export const renderVariable: RenderVariable = ({
  variableType,
  variableValue,
  variableOptions,
  injectionType,
}) => {
  switch (variableType) {
    case 'n':
      const Num = injectionType === 'automatic' ? GtExternalNum : GtInternalNum;
      return (
        <Num options={variableOptions as Intl.NumberFormatOptions | undefined}>
          {variableValue}
        </Num>
      );
    case 'd':
      const DateTime =
        injectionType === 'automatic' ? GtExternalDateTime : GtInternalDateTime;
      return (
        <DateTime
          options={variableOptions as Intl.DateTimeFormatOptions | undefined}
        >
          {variableValue}
        </DateTime>
      );
    case 'c':
      const Currency =
        injectionType === 'automatic' ? GtExternalCurrency : GtInternalCurrency;
      return (
        <Currency
          options={variableOptions as Intl.NumberFormatOptions | undefined}
        >
          {variableValue}
        </Currency>
      );
    case 'v':
    default:
      // If we have auto injected a variable, then remove it at runtime
      return injectionType === 'automatic' ? (
        computeVar({ children: variableValue })
      ) : (
        <GtExternalVar>{variableValue}</GtExternalVar>
      );
  }
};
