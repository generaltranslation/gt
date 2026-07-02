import { h } from 'vue';
import type { VNodeChild } from 'vue';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import type { VariableType } from 'generaltranslation/types';
import {
  Currency,
  DateTime,
  Num,
  RelativeTime,
  Var,
} from '../components/variables';

export type RenderVariableParams = {
  variableType: VariableType;
  variableValue: unknown;
  variableOptions: Record<string, unknown> | undefined;
  locales: string[];
  enableI18n: boolean;
};

/**
 * Renders a variable by type, delegating to the matching variable component
 * with explicit locale overrides.
 */
export function renderVariable({
  variableType,
  variableValue,
  variableOptions,
  locales,
  enableI18n,
}: RenderVariableParams): VNodeChild {
  const internalProps = {
    _locale: locales[0] ?? libraryDefaultLocale,
    _enableI18n: enableI18n,
  };

  if (variableType === 'n') {
    return h(Num, {
      ...internalProps,
      value: variableValue as number | string | null,
      options: variableOptions as Intl.NumberFormatOptions | undefined,
    });
  }
  if (variableType === 'd') {
    return h(DateTime, {
      ...internalProps,
      value: variableValue as Date | string | number | null,
      options: variableOptions as Intl.DateTimeFormatOptions | undefined,
    });
  }
  if (variableType === 'c') {
    return h(Currency, {
      ...internalProps,
      value: variableValue as number | string | null,
      currency: variableOptions?.currency as string | undefined,
      options: variableOptions as Intl.NumberFormatOptions | undefined,
    });
  }
  if (variableType === 'rt') {
    const options = variableOptions as
      | (Intl.RelativeTimeFormatOptions & {
          unit?: Intl.RelativeTimeFormatUnit;
          baseDate?: Date;
        })
      | undefined;
    if (typeof variableValue === 'number' && options?.unit) {
      return h(RelativeTime, {
        ...internalProps,
        value: variableValue,
        unit: options.unit,
        baseDate: options.baseDate,
        options,
      });
    }
    return h(RelativeTime, {
      ...internalProps,
      date: variableValue as Date | string | number | null,
      baseDate: options?.baseDate,
      options,
    });
  }
  return h(Var, { ...internalProps, value: variableValue });
}
