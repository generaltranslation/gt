import { VariableProps } from 'gt-react/internal';
export type RenderVariable = ({ variableType, variableValue, variableOptions, locales, }: Omit<VariableProps, 'variableName'> & {
    locales: string[];
}) => Promise<React.JSX.Element>;
//# sourceMappingURL=types.d.ts.map