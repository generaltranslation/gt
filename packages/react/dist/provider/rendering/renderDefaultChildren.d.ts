import React, { ReactNode } from 'react';
import { RenderVariable } from '../../types/types';
export default function renderDefaultChildren({ children, variables, variablesOptions, defaultLocale, renderVariable, }: {
    children: ReactNode;
    variables?: Record<string, any>;
    variablesOptions?: Record<string, any>;
    defaultLocale: string;
    renderVariable: RenderVariable;
}): React.ReactNode;
//# sourceMappingURL=renderDefaultChildren.d.ts.map