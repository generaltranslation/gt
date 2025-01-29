import React, { ReactNode } from "react";
import { TranslatedChildren } from "../../types/types";
export default function renderTranslatedChildren({ source, target, variables, variablesOptions, locales, renderVariable, }: {
    source: ReactNode;
    target: TranslatedChildren;
    variables?: Record<string, any>;
    variablesOptions?: Record<string, any>;
    locales: string[];
    renderVariable: ({ variableType, variableName, variableValue, variableOptions, }: {
        variableType: "variable" | "number" | "datetime" | "currency";
        variableName: string;
        variableValue: any;
        variableOptions: Intl.NumberFormatOptions | Intl.DateTimeFormatOptions;
        locales: string[];
    }) => React.JSX.Element;
}): ReactNode;
//# sourceMappingURL=renderTranslatedChildren.d.ts.map