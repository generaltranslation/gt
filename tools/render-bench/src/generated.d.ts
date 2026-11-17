// The shape of src/generated/<variant>/index.js, from scripts/generate.mjs.
declare module '@generated' {
  import type { ComponentType } from 'react';

  export type Values = { name: string; count: number; role: string };
  export type Kind = 'plain' | 'jsx' | 'interp' | 'plural' | 'select';
  type RouteModule = { Route: ComponentType<Values> };

  export const routes: (() => Promise<RouteModule>)[];
  export const kinds: Record<Kind, () => Promise<RouteModule>>;
  export function useMicroSites(): Record<
    Exclude<Kind, 'jsx'>,
    ((values: Values) => string)[]
  >;
  export function loadTranslations(locale: string): Promise<object>;
  export function loadMsgTranslations(locale: string): Promise<object>;
}

declare module '@init' {
  export function init(): Promise<void>;
}
