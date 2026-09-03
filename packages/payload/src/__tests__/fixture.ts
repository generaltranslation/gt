import type {
  JsxChild,
  JsxChildren,
  JsxElement,
} from 'generaltranslation/types';

import type { LexicalNode, LexicalState } from '../lexical';

const text = (value: string, format = 0): LexicalNode => ({
  detail: 0,
  format,
  mode: 'normal',
  style: '',
  text: value,
  type: 'text',
  version: 1,
});

export const fixtureState = (): LexicalState => ({
  root: {
    children: [
      {
        children: [text('Brewing at home')],
        direction: 'ltr',
        format: '',
        indent: 0,
        tag: 'h2',
        type: 'heading',
        version: 1,
      },
      {
        children: [
          text('Grind the beans '),
          text('right before', 1),
          text(' you brew.'),
          { type: 'linebreak', version: 1 },
          text('Water matters more than people think.'),
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        textFormat: 0,
        type: 'paragraph',
        version: 1,
      },
      {
        children: [
          {
            children: [text('Use a scale')],
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'listitem',
            value: 1,
            version: 1,
          },
          {
            children: [text('Rinse the filter')],
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'listitem',
            value: 2,
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        listType: 'bullet',
        start: 1,
        tag: 'ul',
        type: 'list',
        version: 1,
      },
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
});

export const upperCaseTree = (child: JsxChildren): JsxChildren => {
  if (Array.isArray(child))
    return child.map((item) => upperCaseTree(item) as JsxChild);
  if (typeof child === 'string') return child.toUpperCase();
  if (typeof child === 'object' && child !== null && 'c' in child) {
    const element = child as JsxElement;
    if (element.c !== undefined)
      return { ...element, c: upperCaseTree(element.c) };
  }
  return child;
};
