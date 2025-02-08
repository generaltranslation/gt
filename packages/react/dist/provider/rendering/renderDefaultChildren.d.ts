import React, { ReactNode } from 'react';
export default function renderDefaultChildren({
  children,
  variables,
  variablesOptions,
  defaultLocale,
  renderVariable,
}: {
  children: ReactNode;
  variables?: Record<string, any>;
  variablesOptions?: Record<string, any>;
  defaultLocale: string;
  renderVariable: ({
    variableType,
    variableName,
    variableValue,
    variableOptions,
  }: {
    variableType: 'variable' | 'number' | 'datetime' | 'currency';
    variableName: string;
    variableValue: any;
    variableOptions: Intl.NumberFormatOptions | Intl.DateTimeFormatOptions;
    locales: string[];
  }) => React.JSX.Element;
}): React.ReactNode;
//# sourceMappingURL=renderDefaultChildren.d.ts.map
