// The analysis parses with the `oxc_parser` crate and reads its own tree; the
// languages parse with the `oxc-parser` package. Both must see the same nodes
// at the same positions: the two are the same version of oxc (`native/Cargo.toml`
// and `package.json`), and this holds them to it.
import fs from 'node:fs';
import path from 'node:path';
import { parseSync, visitorKeys } from 'oxc-parser';
import { expect, test } from 'vitest';
import { native } from '../../src/compiler/analysis/native.js';

type Node = {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
};
type Row = [type: string, start: number, end: number];

const TYPE_KEYS = new Set([
  'typeAnnotation',
  'typeArguments',
  'typeParameters',
  'returnType',
  'superTypeArguments',
  'superTypeParameters',
  'implements',
]);

/** Nodes the analysis keeps as a whole: nothing in them is a usage. */
const LEAVES = new Set([
  'JSXClosingElement',
  'MetaProperty',
  'TSInterfaceDeclaration',
  'TSTypeAliasDeclaration',
  'TSIndexSignature',
  'TSNamespaceExportDeclaration',
  'BreakStatement',
  'ContinueStatement',
]);

/** Their end includes a type annotation, which the analysis does not read. */
const ENDS_AFTER_TYPE = new Set([
  'Identifier',
  'ObjectPattern',
  'ArrayPattern',
  'RestElement',
  'AssignmentPattern',
  'Program',
]);

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Node).type === 'string';

/** The nodes a walk by the visitor keys reaches, without types. */
function walked(program: Node): Row[] {
  const rows: Row[] = [];

  const visit = (node: Node, parent?: Node, key?: string) => {
    const isModuleName = parent?.type === 'TSModuleDeclaration' && key === 'id';
    if (isModuleName) return;

    const isTypeReference =
      node.type === 'TSQualifiedName' ||
      (parent?.type === 'TSImportEqualsDeclaration' &&
        key === 'moduleReference' &&
        node.type !== 'TSExternalModuleReference');
    rows.push([isTypeReference ? 'TSType' : node.type, node.start, node.end]);
    if (isTypeReference || LEAVES.has(node.type)) return;

    for (const childKey of visitorKeys[node.type] ?? []) {
      const isSkipped =
        TYPE_KEYS.has(childKey) ||
        childKey === 'label' ||
        (childKey === 'attributes' && node.type !== 'JSXOpeningElement');
      if (isSkipped) continue;

      const children = [node[childKey]].flat();
      for (const child of children)
        if (isNode(child)) visit(child, node, childKey);
    }
  };
  visit(program);

  return rows;
}

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '.tmp' ? [] : sourceFiles(file);
    }

    return /\.tsx?$/.test(entry.name) ? [file] : [];
  });
}

test('the analysis reads the tree that oxc-parser gives JavaScript', () => {
  const root = path.resolve(import.meta.dirname, '../..');
  const files = [
    ...sourceFiles(path.join(root, 'src')),
    ...sourceFiles(path.join(root, '__tests__')),
  ];
  expect(files.length).toBeGreaterThan(50);

  for (const file of files) {
    const code = fs.readFileSync(file, 'utf8');
    const lang = file.endsWith('.tsx') ? 'tsx' : 'ts';

    const { program } = parseSync(file, code, { lang, astType: 'ts' });
    const expected = walked(program as unknown as Node);

    const actual = native
      .debugTree(code, lang)
      .trimEnd()
      .split('\n')
      .map((line): Row => {
        const [type = '', start, end] = line.split(' ');
        return [type, Number(start), Number(end)];
      });

    const comparable = (rows: Row[]) =>
      rows.map(([type, start, end]) =>
        ENDS_AFTER_TYPE.has(type)
          ? `${type} ${start}`
          : `${type} ${start} ${end}`
      );

    expect(comparable(actual), file).toEqual(comparable(expected));
  }
});

test('positions count UTF-16 code units, as JavaScript does', () => {
  const code = 'const 名前 = "é😀"; m.greeting(`😀${m.x}`);';
  const { program } = parseSync('a.ts', code, { lang: 'ts', astType: 'ts' });

  expect(native.debugTree(code, 'ts').trimEnd().split('\n')).toEqual(
    walked(program as unknown as Node).map((row) => row.join(' '))
  );
});
