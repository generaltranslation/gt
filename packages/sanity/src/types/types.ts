// adapted from https://github.com/sanity-io/sanity-translations-tab. See LICENSE.md for more details.

import { SanityClient, Schema } from 'sanity';

export type TranslationLocale = {
  localeId: string;
  enabled?: boolean;
};

//this varies according to provider
//not every vendor uses every field
export type Secrets = {
  organization: string;
  project: string;
  token?: string;
  secret?: string;
  username?: string;
  password?: string;
  proxy?: string;
};

export type GTFile = {
  documentId: string;
  versionId?: string;
  fileName?: string;
  /**
   * Language the document is written in, when it is an original outside the
   * configured source locale. Omitted means the configured source locale.
   */
  sourceLocale?: string;
  /** Page on the site that shows this version of the document. */
  previewUrl?: string;
};

export interface TranslationFunctionContext {
  client: SanityClient;
  schema: Schema;
}
