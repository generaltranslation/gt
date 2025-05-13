// Type definition for the params extracted from gt.config.json

import { RenderMethod } from '../internal';

export type GTConfig = {
  projectId?: string;
  devApiKey?: string;
  locales?: string[];
  defaultLocale?: string;
  dictionary?: string; // path to the dictionary file
  runtimeUrl?: string;
  cacheUrl?: string;
  renderSettings?: {
    method: RenderMethod;
    timeout?: number;
  };
  _versionId?: string;
  ssr?: boolean;
  localeCookieName?: string;
};
