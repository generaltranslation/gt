import {
  GtInternalCurrency,
  Currency as GtExternalCurrency,
} from "../../components/variables/Currency";
import {
  GtInternalDateTime,
  DateTime as GtExternalDateTime,
} from "../../components/variables/DateTime";
import {
  GtInternalNum,
  Num as GtExternalNum,
} from "../../components/variables/Num";
import {
  GtInternalRelativeTime,
  RelativeTime as GtExternalRelativeTime,
} from "../../components/variables/RelativeTime";
import {
  computeVar,
  Var as GtExternalVar,
} from "../../components/variables/Var";
import type { RelativeTimeFormatOptions, RenderVariable } from "../types";
import { ReactNode } from "react";

// ===== Renderer ===== //

const renderVariable: RenderVariable = ({
  variableType,
  variableValue,
  variableOptions,
  injectionType,
}) => {
  if (variableType === "n") {
    const Num = injectionType === "automatic" ? GtExternalNum : GtInternalNum;
    const numOptions = variableOptions as Intl.NumberFormatOptions | undefined;
    return (
      <Num options={numOptions}>
        {variableValue as number | string | null | undefined}
      </Num>
    );
  }
  if (variableType === "d") {
    const DateTime =
      injectionType === "automatic" ? GtExternalDateTime : GtInternalDateTime;
    const dateTimeOptions = variableOptions as
      | Intl.DateTimeFormatOptions
      | undefined;
    return (
      <DateTime options={dateTimeOptions}>
        {variableValue as Date | null | undefined}
      </DateTime>
    );
  }
  if (variableType === "c") {
    const Currency =
      injectionType === "automatic" ? GtExternalCurrency : GtInternalCurrency;
    const currencyOptions = variableOptions as
      | Intl.NumberFormatOptions
      | undefined;
    return (
      <Currency options={currencyOptions}>
        {variableValue as number | string | null | undefined}
      </Currency>
    );
  }
  if (variableType === "rt") {
    const RelativeTime =
      injectionType === "automatic"
        ? GtExternalRelativeTime
        : GtInternalRelativeTime;
    const relativeTimeOptions = variableOptions as
      | RelativeTimeFormatOptions
      | undefined;
    if (typeof variableValue === "number" && relativeTimeOptions?.unit) {
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
        : typeof variableValue === "string" || typeof variableValue === "number"
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
  return injectionType === "automatic" ? (
    computeVar({ children: variableValue as ReactNode })
  ) : (
    <GtExternalVar>{variableValue as ReactNode}</GtExternalVar>
  );
};

// ===== Exports ===== //

export { renderVariable };
