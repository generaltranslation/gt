import { PortableTextBlock, SanityDocument } from 'sanity';
import { describe, expect, test } from 'vitest';
import {
  getSerialized,
  getValidFields,
  toPlainText,
  getDeserialized,
} from '../helpers';
import { docWithInlineMarks, findByClass, getHTMLNode, schema } from './utils';
import { attachGTData, BaseDocumentSerializer, customSerializers } from '../..';
import { TranslationLevel } from '../../types';
import { defaultStopTypes } from '../..';
import merge from 'lodash.merge';
import { PortableTextHtmlComponents } from '@portabletext/to-html';

function serialize(document: SanityDocument, level: TranslationLevel) {
  const serializer = BaseDocumentSerializer(schema);
  return serializer.serializeDocument(
    document,
    level,
    'en',
    defaultStopTypes,
    merge(customSerializers, {
      marks: {
        link: ({ value, children }) =>
          attachGTData(`<a>${children}</a>`, value, 'markDef'),
        inlineMath: ({ value, children }) =>
          attachGTData(`<span>${children}</span>`, value, 'markDef'),
      },
    } satisfies Partial<PortableTextHtmlComponents>)
  );
}

const serialized = serialize(docWithInlineMarks, 'document');
const deserialized = getDeserialized(docWithInlineMarks, 'document');
const docTree = getHTMLNode(serialized).body.children[0];

test('Global test of working doc-level functionality and snapshot match', () => {
  expect(serialized).toMatchSnapshot();
});

test('Test of working deserialization and snapshot match', () => {
  expect(deserialized).toMatchSnapshot();
});
/*
 * Top-level plain text
 */
test('String and text types get serialized correctly at top-level', () => {
  const HTMLString = findByClass(docTree.children, 'title');
  const HTMLText = findByClass(docTree.children, 'snippet');
  expect(HTMLString?.innerHTML).toEqual(docWithInlineMarks.title);
  expect(HTMLText?.innerHTML).toEqual(docWithInlineMarks.snippet);
});
