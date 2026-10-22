// adapted from https://github.com/sanity-io/sanity-translations-tab. See LICENSE.md for more details.

import { SanityClient, Schema } from 'sanity';

export type TranslationLocale = {
  localeId: string;
  description: string;
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
};

export interface TranslationFunctionContext {
  client: SanityClient;
  schema: Schema;
}
