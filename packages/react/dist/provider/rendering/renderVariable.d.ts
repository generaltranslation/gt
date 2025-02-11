export default function renderVariable({ variableType, variableName, variableValue, variableOptions, locales, }: {
    variableType: 'variable' | 'number' | 'datetime' | 'currency';
    variableName: string;
    variableValue: any;
    variableOptions: Intl.NumberFormatOptions | Intl.DateTimeFormatOptions;
    locales: string[];
}): React.JSX.Element;
//# sourceMappingURL=renderVariable.d.ts.map