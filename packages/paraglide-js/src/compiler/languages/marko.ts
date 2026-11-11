import path from 'node:path';
import type * as MarkoCompiler from '@marko/compiler';
import type * as MarkoTools from '@marko/language-tools';
import { applyEdits, type Edit } from './edits.js';
import {
  SPREAD_ATTRIBUTE,
  type SourceAttribute,
  type SourceElement,
} from './elements.js';
import type { SourceLanguage } from './language.js';
import type { Mapping } from './mapping.js';

type Tools = typeof MarkoTools;
type Parsed = ReturnType<Tools['parse']>;
type MarkoNode = Parsed['program']['body'][number];
type TagNode = Extract<
  MarkoNode,
  { type: MarkoTools.NodeType.Tag | MarkoTools.NodeType.AttrTag }
>;

let hasDefaultCompiler = false;

/**
 * Marko templates, through `@marko/language-tools`: `extractScript` writes the
 * template as TypeScript, with tag variables hoisted as Marko scopes them.
 */
export const markoLanguage: SourceLanguage = {
  name: 'marko',
  extensions: ['.marko'],
  requires: ['@marko/language-tools', '@marko/compiler'],
  async generate(source, file, context) {
    const [tools, compiler] = await Promise.all([
      context.load<Tools>('@marko/language-tools'),
      context.load<typeof MarkoCompiler>('@marko/compiler'),
    ]);
    if (!tools || !compiler) return undefined;

    const directory = path.dirname(file);
    const lookup = tagLookup(tools, compiler, directory);
    const parsed = tools.parse(source, file);

    const scriptLang = tools.ScriptLang.ts;
    const { translator } = tools.Project.getConfig(directory);
    const extracted = tools.extractScript({
      parsed,
      lookup,
      scriptLang,
      translator,
    });

    const generated = extracted.toString();
    const copies = copyMappings(generated, (offset) =>
      extracted.sourceOffsetAt(offset)
    );
    const { code, mappings } = applyEdits(
      generated,
      copies,
      tagAliasDeclarations(generated)
    );
    const elements = sourceElements(tools, parsed);

    return { code, lang: 'ts', mappings, elements };
  },
};

/**
 * The project's tags, from the `@marko/compiler` and translator installed next
 * to the file. A file with none there (outside the project) still gets the core
 * tags, from a default compiler that has no translator.
 */
function tagLookup(
  tools: Tools,
  compiler: typeof MarkoCompiler,
  directory: string
) {
  try {
    return tools.Project.getTagLookup(directory);
  } catch (error) {
    if (hasDefaultCompiler) throw error;

    hasDefaultCompiler = true;
    tools.Project.setDefaultCompilerMeta(compiler, {
      translator: { taglibs: [] },
    });

    return tools.Project.getTagLookup(directory);
  }
}

/** The tooling maps one offset at a time: runs of consecutive offsets are copies. */
function copyMappings(
  code: string,
  sourceOffsetAt: (offset: number) => number | undefined
): Mapping[] {
  const mappings: Mapping[] = [];
  let current: Mapping | undefined;

  for (let offset = 0; offset < code.length; offset++) {
    const source = sourceOffsetAt(offset);

    if (source === undefined) {
      current = undefined;
    } else if (current && source === current.source + current.length) {
      current.length++;
    } else {
      current = { generated: offset, source, length: 1 };
      mappings.push(current);
    }
  }

  return mappings;
}

/**
 * The tooling renders a custom tag through an alias,
 * `const __marko_internal_tag_1 = (\nParaglideMessage\n);`. Without the
 * declaration, the tag's name is a reference of its own: a component usage.
 */
function tagAliasDeclarations(code: string): Edit[] {
  const declarations = [
    ...code.matchAll(/const __marko_internal_tag_\d+ = (?=\()/g),
  ];

  return declarations.map((declaration) => ({
    start: declaration.index,
    end: declaration.index + declaration[0].length,
  }));
}

function sourceElements({ NodeType }: Tools, parsed: Parsed): SourceElement[] {
  const elements: SourceElement[] = [];

  const visit = (nodes: readonly MarkoNode[] | undefined) => {
    for (const node of nodes ?? []) {
      if (node.type !== NodeType.Tag && node.type !== NodeType.AttrTag)
        continue;

      elements.push(sourceElement(node, NodeType, parsed));
      visit(node.body);
    }
  };

  visit(parsed.program.body);

  return elements;
}

function sourceElement(
  tag: TagNode,
  NodeType: Tools['NodeType'],
  parsed: Parsed
): SourceElement {
  const name = parsed.read(tag.name);
  const nameEnd = tag.name.end;
  // `<Card>`, `<my-tag>`, `<ui.Card>`, `<${dynamic}>`: not HTML elements or `<if>`.
  const isComponent = /^[A-Z]/.test(name) || /[-.$]/.test(name);

  return {
    name,
    start: nameEnd,
    end: tag.end,
    nameStart: tag.name.start,
    nameEnd,
    openEnd: tag.open?.end ?? nameEnd,
    component: isComponent,
    attributes: sourceAttributes(tag, NodeType, parsed),
  };
}

function sourceAttributes(
  tag: TagNode,
  NodeType: Tools['NodeType'],
  parsed: Parsed
): SourceAttribute[] {
  return (tag.attrs ?? []).flatMap((attribute) => {
    const { start, end } = attribute;
    if (attribute.type === NodeType.AttrSpread)
      return [{ name: SPREAD_ATTRIBUTE, start, end }];

    const name = parsed.read(attribute.name);

    // `<if=x>`: the tag's default attribute has no name.
    return name ? [{ name, start, end }] : [];
  });
}
