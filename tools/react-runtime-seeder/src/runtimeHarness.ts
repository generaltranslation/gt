export function createRuntimeHarness({
  inputFile,
  resultFile,
  locale,
}: {
  inputFile: string;
  resultFile: string;
  locale: string;
}): string {
  return `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InternalGTProvider, I18nStore } from '@generaltranslation/react-core/components';
import { internalInitializeGTSRA, ReadonlyConditionStore } from '@generaltranslation/react-core/pure';
import { hashMessage } from 'gt-i18n/internal';
import * as inputModule from ${JSON.stringify(inputFile)};
import { writeFileSync } from 'node:fs';

const captures = [];
internalInitializeGTSRA({ defaultLocale: ${JSON.stringify(locale)}, locales: [${JSON.stringify(locale)}] });

const store = new I18nStore();
const getTranslateSnapshot = store.getTranslateSnapshot.bind(store);
store.getTranslateSnapshot = (lookup, translations) => {
  const source = lookup.options.__gtRuntimeSeedSource;
  if (source) {
    const metadata = {
      ...(lookup.options.$context && { context: lookup.options.$context }),
      ...(lookup.options.$id && { id: lookup.options.$id }),
      ...(lookup.options.$maxChars != null && { maxChars: lookup.options.$maxChars }),
      ...(lookup.options.$requiresReview === true && { requiresReview: true }),
    };
    captures.push({
      source,
      hash: hashMessage(lookup.message, lookup.options),
      jsxChildren: lookup.message,
      ...(Object.keys(metadata).length > 0 && { metadata }),
    });
  }
  return getTranslateSnapshot(lookup, translations);
};

const Exported = inputModule.default ?? inputModule.Seed ?? inputModule.App;
if (!Exported) {
  throw new Error('The input must default-export a React component or export Seed or App.');
}
const content = React.isValidElement(Exported)
  ? Exported
  : React.createElement(Exported);
const conditionStore = new ReadonlyConditionStore({
  locale: ${JSON.stringify(locale)},
  enableI18n: false,
});
renderToStaticMarkup(
  React.createElement(
    InternalGTProvider,
    {
      translations: {},
      conditionStore,
      i18nStore: store,
    },
    content
  )
);
writeFileSync(${JSON.stringify(resultFile)}, JSON.stringify(captures));
`;
}
