// Adapted from https://github.com/sanity-io/sanity-naive-html-serializer
import { htmlToBlocks } from '@portabletext/block-tools';
import { Schema } from '@sanity/schema';
import { ObjectField, PortableTextSpan, PortableTextTextBlock } from 'sanity';

const defaultSchema = Schema.compile({
  name: 'default',
  types: [
    {
      type: 'object',
      name: 'default',
      fields: [
        {
          name: 'block',
          type: 'array',
          of: [{ type: 'block' }],
        },
      ],
    },
  ],
});

export const blockContentType = defaultSchema
  .get('default')
  .fields.find((field: ObjectField) => field.name === 'block').type;

export const noSchemaWarning = (obj: Element): string =>
  `WARNING: Unfortunately the deserializer may have issues with this field or object: ${obj.className}.
  If it's a specific type, you may need to declare  at the top level, or write a custom deserializer.`;

//helper to handle messy input -- take advantage
//of blockTools' sanitizing behavior for single strings
export const preprocess = (html: string): string => {
  const intermediateBlocks = htmlToBlocks(
    `<p>${html}</p>`,
    blockContentType
  ) as PortableTextTextBlock<PortableTextSpan>[];
  if (!intermediateBlocks.length) {
    throw new Error(`Error parsing string '${html}'`);
  }
  return intermediateBlocks[0].children[0].text;
};
