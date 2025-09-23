import { PortableTextBlock } from 'sanity';
import { describe, expect, test } from 'vitest';
import {
  getSerialized,
  getValidFields,
  toPlainText,
  getDeserialized,
} from '../helpers';
import { docWithInlineMarks, findByClass, getHTMLNode } from './utils';

const serialized = getSerialized(docWithInlineMarks, 'document');
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
