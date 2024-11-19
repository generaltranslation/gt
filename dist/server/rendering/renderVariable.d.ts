export default function renderVariable({ variableType, variableName, variableValue, variableOptions, }: {
    variableType: "variable" | "number" | "datetime" | "currency";
    variableName: string;
    variableValue: any;
    variableOptions: Intl.NumberFormatOptions | Intl.DateTimeFormatOptions;
}): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=renderVariable.d.ts.map