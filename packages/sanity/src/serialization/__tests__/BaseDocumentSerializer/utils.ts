import { SerializedDocument } from '../../types';
import documentLevelArticleFixture from '../__fixtures__/documentLevelArticle.json';
import docWithInlineMarksFixture from '../__fixtures__/documentInlineMarks.json';
import inlineDocumentLevelArticleFixture from '../__fixtures__/inlineDocumentLevelArticle.json';
import fieldLevelArticleFixture from '../__fixtures__/fieldLevelArticle.json';
import annotationAndInlineBlocksFixture from '../__fixtures__/annotationAndInlineBlocks.json';
import nestedLanguageFieldsFixture from '../__fixtures__/nestedLanguageFields.json';

export { default as inlineSchema } from '../__fixtures__/inlineSchema';
export { default as schema } from '../__fixtures__/schema';
export const documentLevelArticle = documentLevelArticleFixture;
export const docWithInlineMarks = docWithInlineMarksFixture;
export const inlineDocumentLevelArticle = inlineDocumentLevelArticleFixture;
export const fieldLevelArticle = fieldLevelArticleFixture;
export const annotationAndInlineBlocks = annotationAndInlineBlocksFixture;
export const nestedLanguageFields = nestedLanguageFieldsFixture;

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
