// adapted from https://github.com/sanity-io/sanity-translations-tab. See LICENSE.md for more details.

import React from 'react';
import { SanityDocument } from 'sanity';
import { GTSerializedDocument } from '../types';
import { Adapter, GTFile, Secrets, WorkflowIdentifiers } from '../types';

export type ContextProps = {
  documentInfo: GTFile;
  document: SanityDocument;
  languageField: string;
  adapter: Adapter;
  importTranslation: (languageId: string, document: string) => Promise<void>;
  exportForTranslation: (documentInfo: GTFile) => Promise<GTSerializedDocument>;
  secrets: Secrets;
  workflowOptions?: WorkflowIdentifiers[];
  localeIdAdapter?: (id: string) => string | Promise<string>;
  callbackUrl?: string;
  mergeWithTargetLocale?: boolean;
};

export const TranslationContext = React.createContext<ContextProps | null>(
  null
);
