/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GT_PROJECT_ID?: string;
  readonly VITE_GT_DEV_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
