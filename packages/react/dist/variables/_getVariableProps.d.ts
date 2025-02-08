export default function getVariableProps(props: {
  'data-_gt'?: {
    transformation: 'variable';
    [key: string]: any;
  };
  [key: string]: any;
}): {
  variableName: string;
  variableType: 'number' | 'variable' | 'datetime' | 'currency';
  variableValue?: any;
  variableOptions?: Intl.NumberFormatOptions | Intl.DateTimeFormatOptions;
};
//# sourceMappingURL=_getVariableProps.d.ts.map
