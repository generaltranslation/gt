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
import { prerender } from 'react-dom/static';
import { InternalGTProvider, I18nStore } from '@generaltranslation/react-core/components';
import { internalInitializeGTSRA, ReadonlyConditionStore } from '@generaltranslation/react-core/pure';
import { hashMessage } from 'gt-i18n/internal';
import * as inputModule from ${JSON.stringify(inputFile)};
import { writeFileSync } from 'node:fs';

const captures = [];
internalInitializeGTSRA({
  defaultLocale: ${JSON.stringify(locale)},
  locales: [${JSON.stringify(locale)}],
});

const store = new I18nStore();
const getTranslateSnapshot = store.getTranslateSnapshot.bind(store);
store.getTranslateSnapshot = (lookup, translations) => {
  const options = lookup.options;
  const source = options.__gtRuntimeSeedSource;
  if (source) {
    const jsxChildren = structuredClone(lookup.message);
    const metadata = {
      ...(options.$context && { context: options.$context }),
      ...(options.$id && { id: options.$id }),
      ...(options.$maxChars != null && { maxChars: options.$maxChars }),
      ...(options.$requiresReview === true && { requiresReview: true }),
    };
    captures.push({
      source,
      hash: hashMessage(structuredClone(jsxChildren), options),
      jsxChildren,
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
const { prelude } = await prerender(
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
await prelude.cancel();
captures.sort((first, second) => {
  const sourceOrder =
    compare(first.source.file, second.source.file) ||
    first.source.line - second.source.line ||
    first.source.column - second.source.column;
  return sourceOrder || compare(JSON.stringify(first), JSON.stringify(second));
});
writeFileSync(${JSON.stringify(resultFile)}, JSON.stringify(captures));
if (!process.send) {
  throw new Error('The runtime harness must be started with an IPC channel.');
}
await new Promise((resolve, reject) => {
  process.send({ type: 'gt-react-runtime-seed-complete' }, (error) =>
    error ? reject(error) : resolve()
  );
});
await new Promise(() => {});

function compare(first, second) {
  if (first < second) return -1;
  if (first > second) return 1;
  return 0;
}

`;
}
