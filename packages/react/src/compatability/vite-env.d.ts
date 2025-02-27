/**
 * This file is used for compatability issues to prevent errors when using import.meta.env with typescript.
 * This avoids adding an extra dependency on vite/client
 */
interface ImportMetaEnv {
  readonly VITE_GT_PROJECT_ID: string;
  readonly VITE_GT_API_KEY: string;
  readonly REDWOOD_ENV_GT_PROJECT_ID: string; // uses vite
  readonly REDWOOD_ENV_GT_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
