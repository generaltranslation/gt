import { createRequire } from 'module';
import { expect, test } from 'vitest';
import { BaseDocumentMerger } from '../../index';
import { getDeserialized } from '../helpers';
import { getNewFieldLevelDocument, getNewObject } from './utils';
import clone from 'just-clone';

const require = createRequire(import.meta.url);

const fieldLevelArticle = require('../__fixtures__/fieldLevelArticle.json');
const nestedLanguageFields = require('../__fixtures__/nestedLanguageFields.json');

const newDocument = getNewFieldLevelDocument();
const fieldLevelPatches = BaseDocumentMerger.fieldLevelMerge(
  newDocument,
  fieldLevelArticle,
  'es_ES',
  'en'
);
test('Global field level snapshot test', () => {
  expect(fieldLevelPatches).toMatchSnapshot();
});

/*
 * Objects
 */
test('Top-level string / text fields from new document patch to new field, and will be maintained in old field', () => {
  expect(fieldLevelPatches['title.es_ES']).toEqual(newDocument.title.en);
  expect(fieldLevelPatches['snippet.es_ES']).toEqual(newDocument.snippet.en);
  expect(fieldLevelPatches['title.es_ES']).not.toEqual(
    fieldLevelArticle.title.en
  );
  expect(fieldLevelPatches['snippet.es_ES']).not.toEqual(
    fieldLevelArticle.snippet.en
  );
  expect(fieldLevelPatches['title.en']).toBeUndefined();
  expect(fieldLevelPatches['snippet.en']).toBeUndefined();
});

test('Nested object fields override old object fields', () => {
  expect(fieldLevelPatches['config.es_ES'].title).toEqual(
    newDocument.config.en.title
  );
  expect(fieldLevelPatches['config.es_ES'].title).not.toEqual(
    fieldLevelArticle.config.en.title
  );
  expect(
    fieldLevelPatches['config.es_ES'].nestedArrayField[0].children[0].text
  ).toEqual(newDocument.config.en.nestedArrayField[0].children[0].text);
  expect(
    fieldLevelPatches['config.es_ES'].nestedArrayField[0].children[0].text
  ).not.toEqual(
    fieldLevelArticle.config.en.nestedArrayField[0].children[0].text
  );
});

test('Nested object merge uses old fields when not present on new object', () => {
  expect(fieldLevelPatches['config.es_ES'].objectAsField.content).toEqual(
    fieldLevelArticle.config.en.objectAsField.content
  );
});

/*
 * Arrays
 */
test('Arrays will use new objects when they exist', () => {
  expect(fieldLevelPatches['content.es_ES'][0].children[0].text).toEqual(
    newDocument.content.en[0].children[0].text
  );
  expect(fieldLevelPatches['content.es_ES'][0].children[0].text).not.toEqual(
    fieldLevelArticle.content.en[0].children[0].text
  );
});

test('Arrays will use old blocks if they do not exist on new object', () => {
  expect(newDocument.content.en[1]).toBeUndefined();
  expect(fieldLevelPatches['content.es_ES'][1]).toBeDefined();
  expect(fieldLevelPatches['content.es_ES'][1]._key).toEqual(
    fieldLevelArticle.content.en[1]._key
  );
});

test('Arrays will merge objects in the array', () => {
  const documentWithIncompleteObj = getNewFieldLevelDocument();
  const incompleteObj = getNewObject();

  //add a new block with some new content, but not all new content
  documentWithIncompleteObj.content.en.push({
    _key: fieldLevelArticle.content.en[1]._key,
    objectAsField: incompleteObj.objectAsField,
    title: incompleteObj.title,
    //does not include "content" field -- we want that to be merged with the old
  });

  const fieldDocWithMergedObj = BaseDocumentMerger.fieldLevelMerge(
    documentWithIncompleteObj,
    fieldLevelArticle,
    'es_ES',
    'en'
  );

  expect(fieldDocWithMergedObj['content.es_ES'][1].title).toEqual(
    documentWithIncompleteObj.content.en[1].title
  );
  expect(fieldDocWithMergedObj['content.es_ES'][1].objectAsField.title).toEqual(
    documentWithIncompleteObj.content.en[1].objectAsField.title
  );
  //"content" field existed on old doc but not new, so the two coexist happily
  expect(
    documentWithIncompleteObj.content.en[1].objectAsField.content
  ).toBeUndefined();
  expect(
    fieldDocWithMergedObj['content.es_ES'][1].objectAsField.content
  ).toBeDefined();
});

test('nested locale fields will be merged', () => {
  const newNestedFields = clone(nestedLanguageFields);
  newNestedFields.pageFields.name.en = 'This is a new page field name';
  newNestedFields.slices[0].en[0].children[0].text = 'This is new slice text';
  const baseDocumentWithNestedFields = {
    ...fieldLevelArticle,
    ...nestedLanguageFields,
  };
  const newDocumentWithNestedFields = getDeserialized(
    { ...fieldLevelArticle, ...newNestedFields },
    'field'
  );
  const nestedFieldLevelPatches = BaseDocumentMerger.fieldLevelMerge(
    newDocumentWithNestedFields,
    baseDocumentWithNestedFields,
    'es_ES',
    'en'
  );

  expect(
    nestedFieldLevelPatches['slices[0].es_ES'][0].children[0].text
  ).toEqual(newDocumentWithNestedFields.slices[0].en[0].children[0].text);
  expect(nestedFieldLevelPatches['pageFields.name.es_ES']).toEqual(
    newDocumentWithNestedFields.pageFields.name.en
  );
});
