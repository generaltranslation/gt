// Builders for Lexical rich text in tests, in the shape Payload stores.

export const BOLD = 1;
export const ITALIC = 2;
export const UNDERLINE = 8;
export const CODE = 16;

type Node = Record<string, unknown>;

export const text = (value: string, format = 0): Node => ({
  type: 'text',
  text: value,
  format,
  style: '',
  mode: 'normal',
  detail: 0,
  version: 1,
});

export const link = (url: string, ...children: Node[]): Node => ({
  type: 'link',
  version: 3,
  direction: 'ltr',
  format: '',
  indent: 0,
  fields: { linkType: 'custom', url, newTab: false },
  children,
});

export const lineBreak = (): Node => ({ type: 'linebreak', version: 1 });

export const paragraph = (...children: Node[]): Node => ({
  type: 'paragraph',
  version: 1,
  direction: 'ltr',
  format: '',
  indent: 0,
  textFormat: 0,
  children,
});

export const heading = (tag: string, ...children: Node[]): Node => ({
  type: 'heading',
  tag,
  version: 1,
  direction: 'ltr',
  format: '',
  indent: 0,
  children,
});

export const richText = (...children: Node[]) => ({
  root: {
    type: 'root',
    version: 1,
    direction: 'ltr',
    format: '',
    indent: 0,
    children,
  },
});

type RichText = ReturnType<typeof richText>;

// The text of every leaf, in order, for assertions.
export function plainText(value: RichText | null | undefined): string[] {
  const out: string[] = [];
  const visit = (node: Node) => {
    if (node.type === 'text') out.push(node.text as string);
    (node.children as Node[] | undefined)?.forEach(visit);
  };
  if (value) visit(value.root);
  return out;
}

// The tree with every text value blanked, to compare structure.
export function shape(value: RichText | null | undefined): unknown {
  return JSON.parse(
    JSON.stringify(value ?? null, (key, v) => (key === 'text' ? '' : v))
  );
}

export const bulletList = (...items: Node[][]): Node => ({
  type: 'list',
  listType: 'bullet',
  tag: 'ul',
  start: 1,
  version: 1,
  direction: 'ltr',
  format: '',
  indent: 0,
  children: items.map((children, index) => ({
    type: 'listitem',
    value: index + 1,
    version: 1,
    direction: 'ltr',
    format: '',
    indent: 0,
    children,
  })),
});

// A block inside rich text, as Payload's BlocksFeature stores it.
export const block = (
  blockType: string,
  fields: Record<string, unknown>
): Node => ({
  type: 'block',
  version: 2,
  format: '',
  fields: {
    id: `${blockType}-${Math.random().toString(36).slice(2, 10)}`,
    blockName: '',
    blockType,
    ...fields,
  },
});
