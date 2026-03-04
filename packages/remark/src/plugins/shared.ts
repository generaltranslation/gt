export const IGNORE_ALWAYS = [
  'code',
  'inlineCode',
  'mdxFlowExpression',
  'mdxTextExpression',
  'mdxjsEsm',
  'yaml',
  'toml',
  'math',
  'inlineMath',
];

// Want to ignore headings to avoid escaping fragment ids ( {#my-id} )
export const IGNORE_HEADINGS = [...IGNORE_ALWAYS, 'heading'];
