import { createRequire } from 'module';
import { expect, test } from 'vitest';
import { BaseDocumentMerger } from '../../index';
import { getNewDocument, getNewObject } from './utils';

const require = createRequire(import.meta.url);

const documentLevelArticle = require('../__fixtures__/documentLevelArticle.json');

const newDocument = getNewDocument();
const mergedDocument = BaseDocumentMerger.documentLevelMerge(
  newDocument,
  documentLevelArticle
);

test('Global document level snapshot test', () => {
  expect(mergedDocument).toMatchSnapshot();
});

/*
 * Objects
 */
test('Top-level string / text fields from new document override old document', () => {
  expect(mergedDocument.title).toEqual(newDocument.title);
  expect(mergedDocument.snippet).toEqual(newDocument.snippet);
  expect(mergedDocument.title).not.toEqual(documentLevelArticle.title);
  expect(mergedDocument.snippet).not.toEqual(documentLevelArticle.snippet);
});

test('Nested object fields override old object fields', () => {
  expect(mergedDocument.config.title).toEqual(newDocument.config.title);
  expect(mergedDocument.config.title).not.toEqual(
    documentLevelArticle.config.title
  );
  expect(mergedDocument.config.nestedArrayField[0].children[0].text).toEqual(
    newDocument.config.nestedArrayField[0].children[0].text
  );
  expect(
    mergedDocument.config.nestedArrayField[0].children[0].text
  ).not.toEqual(
    documentLevelArticle.config.nestedArrayField[0].children[0].text
  );
});

test('Nested object merge uses old fields when not present on new object', () => {
  expect(newDocument.config.objectAsField.content).toBeUndefined();
  expect(mergedDocument.config.objectAsField.content).toBeDefined();
});

/*
 * Arrays
 */
test('Arrays will use new objects when they exist', () => {
  expect(mergedDocument.content[0].children[0].text).toEqual(
    newDocument.content[0].children[0].text
  );
  expect(mergedDocument.content[0].children[0].text).not.toEqual(
    documentLevelArticle.content[0].children[0].text
  );
});

test('Arrays will use old blocks if they do not exist on new object', () => {
  expect(newDocument.content[1]).toBeUndefined();
  expect(mergedDocument.content[1]).toBeDefined();
  expect(mergedDocument.content[1]._key).toEqual(
    documentLevelArticle.content[1]._key
  );
});

test('Arrays will merge objects in the array', () => {
  const documentWithIncompleteObj = getNewDocument();
  const incompleteObj = getNewObject();

  //add a new block with some new content, but not all new content
  documentWithIncompleteObj.content.push({
    _key: documentLevelArticle.content[1]._key,
    objectAsField: incompleteObj.objectAsField,
    title: incompleteObj.title,
  });
  const documentWithMergedObj = BaseDocumentMerger.documentLevelMerge(
    documentWithIncompleteObj,
    documentLevelArticle
  );

  expect(documentWithMergedObj.content[1].title).toEqual(
    documentWithIncompleteObj.content[1].title
  );
  expect(documentWithMergedObj.content[1].objectAsField.title).toEqual(
    documentWithIncompleteObj.content[1].objectAsField.title
  );
  //content existed on old doc but not new, so the two coexist happily
  expect(
    documentWithIncompleteObj.content[1].objectAsField.content
  ).toBeUndefined();
  expect(documentWithMergedObj.content[1].objectAsField.content).toBeDefined();
});
