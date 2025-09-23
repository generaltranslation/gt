import { PortableTextBlock } from 'sanity';
import { expect, test } from 'vitest';
import { fieldLevelArticle } from '../BaseDocumentSerializer/utils';
import { getDeserialized, toPlainText } from '../helpers';

test('Global test of working field-level functionality and snapshot match', () => {
  const deserialized = getDeserialized(fieldLevelArticle, 'field');
  expect(deserialized).toMatchSnapshot();
});

/*
 * Top-level plain text
 */

test('String and text types get deserialized correctly at top-level -- field level', () => {
  const deserialized = getDeserialized(fieldLevelArticle, 'field');
  expect(deserialized.title.en).toEqual(fieldLevelArticle.title.en);
  expect(deserialized.snippet.en).toEqual(fieldLevelArticle.snippet.en);
});

/*
 * Presence and accuracy of fields in "vanilla" deserialization -- objects
 */
test('Nested object contains accurate values -- field level', () => {
  const deserialized = getDeserialized(fieldLevelArticle, 'field');
  const origTitle = fieldLevelArticle.config.en.title;
  const deserializedTitle = deserialized.config.en.title;
  expect(origTitle).toEqual(deserializedTitle);

  const origBlockText = fieldLevelArticle.config.en.nestedArrayField;
  const deserializedBlockText = deserialized.config.en.nestedArrayField;

  const origKeys = origBlockText.map((block: PortableTextBlock) => block._key);
  const deserializedKeys = deserializedBlockText.map(
    (block: PortableTextBlock) => block._key
  );

  expect(deserializedKeys.sort()).toEqual(origKeys.sort());
  expect(toPlainText(deserializedBlockText)).toEqual(
    toPlainText(origBlockText)
  );
});

test('Nested object in an object contains accurate values -- field level', () => {
  const deserialized = getDeserialized(fieldLevelArticle, 'field');
  const origNestedObject = fieldLevelArticle.config.en.objectAsField;
  const deserializedNestedObject = deserialized.config.en.objectAsField;

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

test('Array contains all serializable blocks with keys, in order -- field level', () => {
  const deserialized = getDeserialized(fieldLevelArticle, 'field');
  const origKeys = fieldLevelArticle.content.en.map(
    (block: PortableTextBlock) => block._key
  );
  const deserializedKeys = deserialized.content.en.map(
    (block: PortableTextBlock) => block._key
  );
  expect(deserializedKeys.sort()).toEqual(origKeys.sort());
});

test('Array contains top-level block text -- field level', () => {
  const deserialized = getDeserialized(fieldLevelArticle, 'field');
  expect(toPlainText(deserialized.content.en)).toEqual(
    toPlainText(fieldLevelArticle.content.en)
  );
});

test('Object in array contains accurate values in nested object -- field level', () => {
  const deserialized = getDeserialized(fieldLevelArticle, 'field');
  const origTitle = fieldLevelArticle.content.en.find(
    (block: Record<string, any>) => block._type === 'objectField'
  ).objectAsField.title;
  const deserializedTitle = deserialized.content.en.find(
    (block: Record<string, any>) => block._type === 'objectField'
  ).objectAsField.title;
  expect(deserializedTitle).toEqual(origTitle);

  const origBlockText = toPlainText(
    fieldLevelArticle.content.en.find(
      (block: Record<string, any>) => block._type === 'objectField'
    ).objectAsField.content
  ).trim();
  const deserializedBlockText = toPlainText(
    fieldLevelArticle.content.en.find(
      (block: Record<string, any>) => block._type === 'objectField'
    ).objectAsField.content
  ).trim();
  expect(deserializedBlockText).toEqual(origBlockText);
});
