import {PortableTextBlock} from 'sanity'
import {describe, expect, test} from 'vitest'
import {getSerialized, getValidFields, toPlainText} from '../helpers'
import {fieldLevelArticle, findByClass, getHTMLNode, nestedLanguageFields} from './utils'

const serialized = getSerialized(fieldLevelArticle, 'field')
const docTree = getHTMLNode(serialized).body.children[0]

test('Global test of working field-level functionality and snapshot match', () => {
  expect(serialized).toMatchSnapshot()
})

test('String and text types get serialized correctly at top-level -- field level', () => {
  const titleObj = findByClass(docTree.children, 'title')?.children[0]
  const HTMLString = findByClass(titleObj!.children, 'en')
  const snippetObj = findByClass(docTree.children, 'snippet')?.children[0]
  const HTMLText = findByClass(snippetObj!.children, 'en')
  expect(HTMLString?.innerHTML).toEqual(fieldLevelArticle.title.en)
  expect(HTMLText?.innerHTML).toEqual(fieldLevelArticle.snippet.en)
})

describe('Presence and accuracy of fields in "vanilla" deserialization -- objects', () => {
  const getFieldLevelObjectField = () => {
    const config = findByClass(docTree.children, 'config')?.children[0]
    //return english field
    const englishConfig = findByClass(config!.children, 'en')
    return findByClass(englishConfig!.children, 'objectField')
  }

  const objectField = getFieldLevelObjectField()

  test('Top-level nested objects contain all serializable fields -- field level', () => {
    const fieldNames = getValidFields(fieldLevelArticle.config.en)
    const foundFieldNames = Array.from(objectField!.children).map((child) => child.className)

    expect(foundFieldNames.sort()).toEqual(fieldNames.sort())
  })

  test('Nested object in object contains all serializable fields -- field Level', () => {
    const nestedObject = findByClass(objectField!.children, 'objectAsField')!.children[0]
    const fieldNames = getValidFields(fieldLevelArticle.config.en.objectAsField)
    const foundFieldNames = Array.from(nestedObject!.children).map((child) => child.className)
    expect(foundFieldNames.sort()).toEqual(fieldNames.sort())
  })

  test('Nested object contains accurate values -- field level', () => {
    const title = fieldLevelArticle.config.en.title
    const blockText = toPlainText(fieldLevelArticle.config.en.nestedArrayField)

    expect(objectField?.innerHTML).toContain(title)
    expect(objectField?.innerHTML).toContain(blockText)
  })

  test('Nested object in an object contains accurate values -- field level', () => {
    const nestedObject = findByClass(objectField!.children, 'objectAsField')!.children[0]
    const title = fieldLevelArticle.config.en.objectAsField.title
    const blockText = toPlainText(fieldLevelArticle.config.en.objectAsField.content)

    expect(nestedObject.innerHTML).toContain(title)
    expect(nestedObject.innerHTML).toContain(blockText)
  })
})

/*
 * Presence and accuracy of fields in "vanilla" deserialization -- arrays
 */
describe('Presence and accurancy of fields in "vanilla" deserialization -- arrays', () => {
  const getFieldLevelArrayField = () => {
    const content = findByClass(docTree.children, 'content')?.children[0]
    return findByClass(content!.children, 'en')
  }
  const arrayField = getFieldLevelArrayField()

  test('Array contains all serializable blocks with keys, in order -- field level', () => {
    const origKeys = fieldLevelArticle.content.en.map((block: PortableTextBlock) => block._key)
    const serializedKeys = Array.from(arrayField!.children).map((block) => block.id)
    expect(serializedKeys).toEqual(origKeys)
  })

  test('Array contains top-level block text -- field level', () => {
    const blockText = toPlainText(fieldLevelArticle.content.en).trim()
    expect(arrayField?.innerHTML).toContain(blockText)
  })

  test('Object in array contains all serializable fields -- field level', () => {
    const objectInArray = findByClass(arrayField!.children, 'objectField')
    const fieldNames = getValidFields(
      fieldLevelArticle.content.en.find(
        (block: Record<string, any>) => block._type === 'objectField'
      )
    )
    const foundFieldNames = Array.from(objectInArray!.children).map((child) => child.className)
    expect(foundFieldNames.sort()).toEqual(fieldNames.sort())
  })

  test('Object in array contains accurate values in nested object -- field level', () => {
    const objectInArray = findByClass(arrayField!.children, 'objectField')
    const nestedObject = findByClass(objectInArray!.children, 'objectAsField')
    const title = fieldLevelArticle.content.en.find(
      (block: Record<string, any>) => block._type === 'objectField'
    ).objectAsField.title
    const blockText = toPlainText(
      fieldLevelArticle.content.en.find(
        (block: Record<string, any>) => block._type === 'objectField'
      ).objectAsField.content
    ).trim()
    expect(nestedObject?.innerHTML).toContain(title)
    expect(nestedObject?.innerHTML).toContain(blockText)
  })
})

test('Nested locale fields make it to serialization, but only base lang', () => {
  const nestedLocales = {...fieldLevelArticle, ...nestedLanguageFields}
  const nestedSerialized = getSerialized(nestedLocales, 'field')
  const nestedDocTree = getHTMLNode(nestedSerialized).body.children[0]
  const slices = findByClass(nestedDocTree.children, 'slices')
  const pageFields = findByClass(nestedDocTree.children, 'pageFields')
  expect(slices?.innerHTML).toContain(nestedLanguageFields.slices[0].en[0].children[0].text)
  expect(pageFields?.innerHTML).toContain(nestedLanguageFields.pageFields.name.en)
  expect(slices?.innerHTML).not.toContain(nestedLanguageFields.slices[0].fr_FR[0].children[0].text)
  expect(pageFields?.innerHTML).not.toContain(nestedLanguageFields.pageFields.name.fr_FR)
})

//also test: setting different base language!
