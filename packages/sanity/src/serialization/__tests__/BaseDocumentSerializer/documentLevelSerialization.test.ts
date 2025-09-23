import {PortableTextBlock} from 'sanity'
import {describe, expect, test} from 'vitest'
import {getSerialized, getValidFields, toPlainText} from '../helpers'
import {documentLevelArticle, findByClass, getHTMLNode} from './utils'

const serialized = getSerialized(documentLevelArticle, 'document')
const docTree = getHTMLNode(serialized).body.children[0]

test('Global test of working doc-level functionality and snapshot match', () => {
  expect(serialized).toMatchSnapshot()
})
/*
 * Top-level plain text
 */
test('String and text types get serialized correctly at top-level', () => {
  const HTMLString = findByClass(docTree.children, 'title')
  const HTMLText = findByClass(docTree.children, 'snippet')
  expect(HTMLString?.innerHTML).toEqual(documentLevelArticle.title)
  expect(HTMLText?.innerHTML).toEqual(documentLevelArticle.snippet)
})

/*
 * Presence and accuracy of fields
 */
describe('Presence and accuracy of fields in "vanilla" deserialization -- objects', () => {
  //parent node is always div with classname of field with a nested div
  //that has classname of obj type
  const configObj = findByClass(docTree.children, 'config')
  const objectField = configObj!.children[0]

  test('Top-level nested objects contain all serializable fields -- document level', () => {
    const fieldNames = getValidFields(documentLevelArticle.config)
    const foundFieldNames = Array.from(objectField!.children).map((child) => child.className)
    expect(foundFieldNames.sort()).toEqual(fieldNames.sort())
  })

  test('Nested object in object contains all serializable fields -- document level', () => {
    const nestedObject = findByClass(objectField!.children, 'objectAsField')!.children[0]
    const fieldNames = getValidFields(documentLevelArticle.config.objectAsField)
    const foundFieldNames = Array.from(nestedObject!.children).map((child) => child.className)
    expect(foundFieldNames.sort()).toEqual(fieldNames.sort())
  })

  test('Nested object contains accurate values -- document level', () => {
    const title = documentLevelArticle.config.title
    const blockText = toPlainText(documentLevelArticle.config.nestedArrayField)

    expect(objectField?.innerHTML).toContain(title)
    expect(objectField?.innerHTML).toContain(blockText)
  })

  test('Nested object in an object contains accurate values -- document level', () => {
    const nestedObject = findByClass(objectField!.children, 'objectAsField')!.children[0]
    const title = documentLevelArticle.config.objectAsField.title
    const blockText = toPlainText(documentLevelArticle.config.objectAsField.content)

    expect(nestedObject.innerHTML).toContain(title)
    expect(nestedObject.innerHTML).toContain(blockText)
  })
})

describe('Presence and accuracy of fields in vanilla deserialization -- arrays', () => {
  const arrayField = findByClass(docTree.children, 'content')

  test('Array contains all serializable blocks with keys, in order -- document level', () => {
    const origKeys = documentLevelArticle.content.map((block: PortableTextBlock) => block._key)
    const serializedKeys = Array.from(arrayField!.children).map((block) => block.id)
    expect(serializedKeys).toEqual(origKeys)
  })

  test('Array contains top-level block text -- document level', () => {
    const blockText = toPlainText(documentLevelArticle.content).trim()
    const blockStrings = blockText.split('\n\n')
    blockStrings.forEach((substring: string) => expect(arrayField?.innerHTML).toContain(substring))
  })

  test('Object in array contains all serializable fields -- document level', () => {
    const objectInArray = findByClass(arrayField!.children, 'objectField')
    const fieldNames = getValidFields(
      documentLevelArticle.content.find(
        (block: Record<string, any>) => block._type === 'objectField'
      )
    )
    const foundFieldNames = Array.from(objectInArray!.children).map((child) => child.className)
    expect(foundFieldNames.sort()).toEqual(fieldNames.sort())
  })

  test('Object in array contains accurate values in nested object -- document level', () => {
    const objectInArray = findByClass(arrayField!.children, 'objectField')
    const nestedObject = findByClass(objectInArray!.children, 'objectAsField')
    const title = documentLevelArticle.content.find(
      (block: Record<string, any>) => block._type === 'objectField'
    ).objectAsField.title
    const blockText = toPlainText(
      documentLevelArticle.content.find(
        (block: Record<string, any>) => block._type === 'objectField'
      ).objectAsField.content
    ).trim()
    expect(nestedObject?.innerHTML).toContain(title)
    expect(nestedObject?.innerHTML).toContain(blockText)
  })
})
