import { PortableTextBlock } from 'sanity';
import { expect, test } from 'vitest';
import { documentLevelArticle } from '../BaseDocumentSerializer/utils';
import { getDeserialized, toPlainText } from '../helpers';

test('Global test of working doc-level functionality and snapshot match', () => {
  const deserialized = getDeserialized(documentLevelArticle, 'document');
  expect(deserialized).toMatchSnapshot();
});

/*
 * Top-level plain text
 */

test('String and text types get deserialized correctly at top-level -- document level', () => {
  const deserialized = getDeserialized(documentLevelArticle, 'document');
  expect(deserialized.title).toEqual(documentLevelArticle.title);
  expect(deserialized.snippet).toEqual(documentLevelArticle.snippet);
});

/*
 * Presence and accuracy of fields in "vanilla" deserialization -- objects
 */
test('Nested object contains accurate values -- document level', () => {
  const deserialized = getDeserialized(documentLevelArticle, 'document');
  const origTitle = documentLevelArticle.config.title;
  const deserializedTitle = deserialized.config.title;
  expect(origTitle).toEqual(deserializedTitle);

  const origBlockText = documentLevelArticle.config.nestedArrayField;
  const deserializedBlockText = deserialized.config.nestedArrayField;

  const origKeys = origBlockText.map((block: PortableTextBlock) => block._key);
  const deserializedKeys = deserializedBlockText.map(
    (block: PortableTextBlock) => block._key
  );

  expect(deserializedKeys.sort()).toEqual(origKeys.sort());
  expect(toPlainText(deserializedBlockText)).toEqual(
    toPlainText(origBlockText)
  );
});

test('Nested object in an object contains accurate values -- document level', () => {
  const deserialized = getDeserialized(documentLevelArticle, 'document');
  const origNestedObject = documentLevelArticle.config.objectAsField;
  const deserializedNestedObject = deserialized.config.objectAsField;

  expect(origNestedObject.title).toEqual(deserializedNestedObject.title);

  const origKeys = origNestedObject.content.map(
    (block: PortableTextBlock) => block._key
  );
  const deserializedKeys = deserializedNestedObject.content.map(
    (block: PortableTextBlock) => block._key
  );

  expect(origKeys.sort()).toEqual(deserializedKeys.sort());
  expect(toPlainText(deserializedNestedObject.content)).toEqual(
    toPlainText(origNestedObject.content)
  );
});

/*
 * Presence and accuracy of fields in vanilla deserialization -- arrays
 */

test('Array contains all serializable blocks with keys, in order -- document level', () => {
  const deserialized = getDeserialized(documentLevelArticle, 'document');
  const origKeys = documentLevelArticle.content.map(
    (block: PortableTextBlock) => block._key
  );
  const deserializedKeys = deserialized.content.map(
    (block: PortableTextBlock) => block._key
  );
  expect(deserializedKeys.sort()).toEqual(origKeys.sort());
});

test('Array contains top-level block text -- document level', () => {
  const deserialized = getDeserialized(documentLevelArticle, 'document');
  expect(toPlainText(deserialized.content)).toEqual(
    toPlainText(documentLevelArticle.content)
  );
});

test('Object in array contains accurate values in nested object -- document level', () => {
  const deserialized = getDeserialized(documentLevelArticle, 'document');
  const origTitle = documentLevelArticle.content.find(
    (block: Record<string, any>) => block._type === 'objectField'
  ).objectAsField.title;
  const deserializedTitle = deserialized.content.find(
    (block: Record<string, any>) => block._type === 'objectField'
  ).objectAsField.title;
  expect(deserializedTitle).toEqual(origTitle);

  const origBlockText = toPlainText(
    documentLevelArticle.content.find(
      (block: Record<string, any>) => block._type === 'objectField'
    ).objectAsField.content
  ).trim();
  const deserializedBlockText = toPlainText(
    documentLevelArticle.content.find(
      (block: Record<string, any>) => block._type === 'objectField'
    ).objectAsField.content
  ).trim();
  expect(deserializedBlockText).toEqual(origBlockText);
});
