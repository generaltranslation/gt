// adapted from https://github.com/sanity-io/sanity-translations-tab. See LICENSE.md for more details.

import { SanityClient, Schema, TypedObject } from 'sanity';
import type { SerializedDocument } from './serialization';
import { PortableTextTypeComponent } from '@portabletext/to-html';
import { DeserializerRule } from '@sanity/block-tools';

export type TranslationTaskLocaleStatus = {
  localeId: string;
  progress: number;
};

export type TranslationTask = {
  document: GTFile;
  locales: TranslationTaskLocaleStatus[];
  linkToVendorTask?: string;
};

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

export type WorkflowIdentifiers = {
  workflowUid: string;
  workflowName: string;
};

export type GTFile = {
  documentId: string;
  versionId?: string;
};

export interface Adapter {
  getLocales: (secrets: Secrets | null) => Promise<TranslationLocale[]>;
  getTranslationTask: (
    document: GTFile,
    secrets: Secrets | null
  ) => Promise<TranslationTask>;
  createTask: (
    documentInfo: GTFile,
    serializedDocument: GTSerializedDocument,
    localeIds: string[],
    secrets: Secrets | null,
    workflowUid?: string,
    callbackUrl?: string
  ) => Promise<TranslationTask>;
  getTranslation: (
    document: GTFile,
    localeId: string,
    secrets: Secrets | null
  ) => Promise<any | null>;
}

export interface TranslationFunctionContext {
  client: SanityClient;
  schema: Schema;
}

export type GTSerializedDocument = Omit<SerializedDocument, 'name'> & GTFile;

export type ExportForTranslation = (
  documentInfo: GTFile,
  context: TranslationFunctionContext
) => Promise<GTSerializedDocument>;

export type ImportTranslation = (
  documentInfo: GTFile,
  localeId: string,
  document: string,
  context: TranslationFunctionContext,
  mergeWithTargetLocale?: boolean,
  publish?: boolean
) => Promise<void>;

export type TranslationsTabConfigOptions = {
  adapter: Adapter;
  secretsNamespace: string | null;
  exportForTranslation: ExportForTranslation;
  importTranslation: ImportTranslation;
  serializationOptions?: {
    additionalStopTypes?: string[];
    additionalSerializers?: Record<
      string,
      PortableTextTypeComponent | undefined
    >;
    additionalDeserializers?: Record<
      string,
      (value: HTMLElement) => TypedObject
    >;
    additionalBlockDeserializers?: DeserializerRule[];
  };
  workflowOptions?: WorkflowIdentifiers[];
  localeIdAdapter?: (id: string) => string;
  languageField?: string;
  callbackUrl?: string;
  mergeWithTargetLocale?: boolean;
};
