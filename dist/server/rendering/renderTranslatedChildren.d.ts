import { ReactNode } from 'react';
import { TranslatedChildren } from 'gt-react/dist/primitives/types';
export default function renderTranslatedChildren({ source, target, variables, variablesOptions, locales, }: {
    source: ReactNode;
    target: TranslatedChildren;
    variables?: Record<string, any>;
    variablesOptions?: Record<string, any>;
    locales: string[];
}): ReactNode;
//# sourceMappingURL=renderTranslatedChildren.d.ts.map