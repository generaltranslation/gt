declare module 'virtual:gt-astro/config-server' {
  export const config: import('./types').GTAstroRuntimeConfig;
  export const settings: import('./types').GTAstroRuntimeSettings;
  export const loadTranslations:
    | ((locale: string) => Promise<unknown>)
    | undefined;
}
