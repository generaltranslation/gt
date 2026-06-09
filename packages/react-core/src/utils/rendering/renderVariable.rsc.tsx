import { RscCurrency } from '../../components/variables/Currency.rsc';
import { RscDateTime } from '../../components/variables/DateTime.rsc';
import { RscNum } from '../../components/variables/Num.rsc';
import { RscRelativeTime } from '../../components/variables/RelativeTime.rsc';
import { RscVar } from '../../components/variables/Var.rsc';
import type { RelativeTimeFormatOptions, RenderVariable } from '../types';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import type { ReactNode } from 'react';

// ===== Renderer ===== //

/**
 * RSC variant of `renderVariable`. Invokes the `Rsc*` variable components
 * directly so no React context (createContext) is pulled into the server graph.
 */
const renderVariable: RenderVariable = ({
  variableType,
  variableValue,
  variableOptions,
  locales,
  enableI18n,
}) => {
  const internalProps = {
    _locale: locales[0] ?? libraryDefaultLocale,
    _enableI18n: enableI18n,
  };

  if (variableType === 'n') {
    return RscNum({
      ...internalProps,
      options: variableOptions as Intl.NumberFormatOptions | undefined,
      children: variableValue as number | string | null | undefined,
    });
  }

  if (variableType === 'd') {
    return RscDateTime({
      ...internalProps,
      options: variableOptions as Intl.DateTimeFormatOptions | undefined,
      children: variableValue as Date | null | undefined,
    });
  }

  if (variableType === 'c') {
    return RscCurrency({
      ...internalProps,
      options: variableOptions as Intl.NumberFormatOptions | undefined,
      children: variableValue as number | string | null | undefined,
    });
  }

  if (variableType === 'rt') {
    const relativeTimeOptions = variableOptions as
      | RelativeTimeFormatOptions
      | undefined;
    if (typeof variableValue === 'number' && relativeTimeOptions?.unit) {
      return RscRelativeTime({
        ...internalProps,
        value: variableValue,
        unit: relativeTimeOptions.unit,
        baseDate: relativeTimeOptions?.baseDate,
        options: relativeTimeOptions,
      });
    }
    const dateValue =
      variableValue instanceof Date
        ? variableValue
        : typeof variableValue === 'string' || typeof variableValue === 'number'
          ? new Date(variableValue)
          : undefined;
    return RscRelativeTime({
      ...internalProps,
      date: dateValue && !isNaN(dateValue.getTime()) ? dateValue : undefined,
      baseDate: relativeTimeOptions?.baseDate,
      options: relativeTimeOptions,
    });
  }

  return RscVar({
    ...internalProps,
    children: variableValue as ReactNode,
  });
};

// ===== Exports ===== //

export { renderVariable };
