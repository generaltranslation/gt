import { createRequire } from 'module';

import { SerializedDocument } from '../../types';

const require = createRequire(import.meta.url);

export { default as inlineSchema } from '../__fixtures__/inlineSchema';
export { default as schema } from '../__fixtures__/schema';
export const documentLevelArticle = require('../__fixtures__/documentLevelArticle.json');
export const inlineDocumentLevelArticle = require('../__fixtures__/inlineDocumentLevelArticle.json');
export const fieldLevelArticle = require('../__fixtures__/fieldLevelArticle.json');
export const annotationAndInlineBlocks = require('../__fixtures__/annotationAndInlineBlocks.json');
export const nestedLanguageFields = require('../__fixtures__/nestedLanguageFields.json');

export const getHTMLNode = (serialized: SerializedDocument): Document => {
  const htmlString = serialized.content;
  const parser = new DOMParser();
  return parser.parseFromString(htmlString, 'text/html');
};

export const findByClass = (
  children: HTMLCollection,
  className: string
): Element | undefined => {
  return Array.from(children).find((node) => node.className === className);
};
