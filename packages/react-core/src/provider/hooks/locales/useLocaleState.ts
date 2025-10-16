import { UseLocaleStateProps, UseLocaleStateReturn } from './types';

export function useLocaleState({}: UseLocaleStateProps): UseLocaleStateReturn {
  throw new Error(
    '@generaltranslation/react-core: The useLocaleState hook was not overridden. This is likely the result'
  );
}
