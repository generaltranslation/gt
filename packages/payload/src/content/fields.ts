// One walk over a document's fields, used both to collect the strings to
// translate and to rebuild the target locale from translations, so a string
// gets the same key in both directions.
//
// Keys are field names joined by dots, with row and block ids in place of
// list positions, and `#` plus a child-index path for a text element inside
// rich text: `layout.<blockId>.richText#1`.
import { flattenAllFields } from 'payload';
import type {
  Block,
  FlattenedBlock,
  FlattenedField,
  RichTextField,
} from 'payload';
import type { Data } from '../types';
import { isAddress } from './address';
import {
  encodeElement,
  isInlineNode,
  type EncodedElement,
  type LexicalNode,
} from './inline';

type Row = Data & { id?: string; blockType?: string };

// A character limit on a plain text value: the length to ask for, and the
// length Payload rejects anything over (the field's maxLength), if any.
export type LengthLimit = { maxChars: number; cutAt?: number };

export type Visitor = {
  // A translatable plain text value. Returning a string replaces it.
  text(
    key: string,
    source: string,
    target: string | undefined,
    limit: LengthLimit | undefined
  ): string | undefined;
  // A rich text element whose inline content is encodable. Returning
  // children replaces its children.
  element(
    key: string,
    source: EncodedElement,
    target: LexicalNode | undefined
  ): LexicalNode[] | undefined;
};

export type FieldContext = {
  // Blocks defined once in the config and referenced by slug.
  blocks: FlattenedBlock[];
};

type Walked = { value: unknown; changed: boolean };

// Payload adds these to rows. They identify rows and are never content.
const ROW_FIELDS = new Set(['id', 'blockName', 'blockType']);
// Payload's built-in slug field renders with this admin component.
const SLUG_FIELD_COMPONENT = '@payloadcms/next/client#SlugField';
// The SEO plugin's meta fields render with these and show these lengths.
const SEO_LENGTHS: Record<string, number> = {
  '@payloadcms/plugin-seo/client#MetaTitleComponent': 60,
  '@payloadcms/plugin-seo/client#MetaDescriptionComponent': 150,
};

const isData = (value: unknown): value is Data =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const clone = <T>(value: T): T => structuredClone(value);

const isEmpty = (value: unknown) =>
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0);

function fieldComponent(field: FlattenedField): unknown {
  if (field.type !== 'text' && field.type !== 'textarea') return undefined;
  const component = field.admin?.components?.Field;
  return typeof component === 'object' &&
    component !== null &&
    'path' in component
    ? component.path
    : component;
}

function isSlugField(field: FlattenedField): boolean {
  return (
    field.type === 'text' && fieldComponent(field) === SLUG_FIELD_COMPONENT
  );
}

function lengthLimit(field: FlattenedField): LengthLimit | undefined {
  const component = fieldComponent(field);
  const recommended =
    typeof component === 'string' ? SEO_LENGTHS[component] : undefined;
  const max =
    'maxLength' in field && typeof field.maxLength === 'number'
      ? field.maxLength
      : undefined;
  if (max !== undefined && (recommended === undefined || max <= recommended))
    return { maxChars: max, cutAt: max };
  return recommended === undefined
    ? undefined
    : { maxChars: recommended, cutAt: max };
}

function optedOut(field: FlattenedField): boolean {
  const custom = field.custom as { gt?: { translate?: boolean } } | undefined;
  return custom?.gt?.translate === false;
}

// Fields editors cannot change in the admin panel.
function uneditable(field: FlattenedField): boolean {
  const admin =
    'admin' in field
      ? (field.admin as { readOnly?: boolean; hidden?: boolean } | undefined)
      : undefined;
  return Boolean(
    admin?.readOnly || admin?.hidden || ('virtual' in field && field.virtual)
  );
}

const skipped = (field: FlattenedField) =>
  !('name' in field) ||
  ROW_FIELDS.has(field.name) ||
  optedOut(field) ||
  uneditable(field);

const isLocalized = (field: FlattenedField, inLocaleCopy: boolean) =>
  inLocaleCopy || Boolean('localized' in field && field.localized);

// Payload saves a locale only when its required fields hold a value, so a
// required field left untranslated takes the source's.
function needsSourceValue(
  field: FlattenedField,
  inLocaleCopy: boolean,
  source: unknown,
  target: unknown
): boolean {
  return (
    isLocalized(field, inLocaleCopy) &&
    'required' in field &&
    Boolean(field.required) &&
    isEmpty(target) &&
    !isEmpty(source)
  );
}

function blockFields(
  field: Extract<FlattenedField, { type: 'blocks' }>,
  blockType: unknown,
  ctx: FieldContext
): FlattenedField[] | undefined {
  const references = (field.blockReferences ?? []).map((ref) =>
    typeof ref === 'string' ? ctx.blocks.find((b) => b.slug === ref) : ref
  );
  return [...field.blocks, ...references].find((b) => b?.slug === blockType)
    ?.flattenedFields;
}

function richTextBlockFields(
  field: RichTextField,
  blockType: unknown
): FlattenedField[] | undefined {
  const editor = field.editor as
    | { editorConfig?: { resolvedFeatureMap?: Map<string, unknown> } }
    | undefined;
  const feature = editor?.editorConfig?.resolvedFeatureMap?.get('blocks') as
    | {
        sanitizedServerFeatureProps?: {
          blocks?: Block[];
          inlineBlocks?: Block[];
        };
      }
    | undefined;
  const props = feature?.sanitizedServerFeatureProps;
  const config = [
    ...(props?.blocks ?? []),
    ...(props?.inlineBlocks ?? []),
  ].find((b) => b.slug === blockType);
  return config ? flattenAllFields({ fields: config.fields }) : undefined;
}

// Row ids removed, for a list each locale holds its own rows of.
function withoutRowIds(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((row) => {
      if (!isData(row)) return row;
      const { id: _id, ...rest } = row;
      return withoutRowIds(rest);
    });
  }
  if (isData(value))
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, withoutRowIds(v)])
    );
  return value;
}

export function walkFields(
  fields: FlattenedField[],
  source: Data | undefined,
  target: Data | undefined,
  path: string,
  inLocaleCopy: boolean,
  visitor: Visitor,
  ctx: FieldContext
): { value: Data; changed: boolean } {
  const value: Data = {};
  let changed = false;
  for (const field of fields) {
    if (!('name' in field) || ROW_FIELDS.has(field.name)) continue;
    const sourceValue = source?.[field.name];
    const targetValue = target?.[field.name];
    const walked = skipped(field)
      ? { value: targetValue, changed: false }
      : walkField(
          field,
          sourceValue,
          targetValue,
          path ? `${path}.${field.name}` : field.name,
          inLocaleCopy,
          visitor,
          ctx
        );
    if (walked.changed) {
      value[field.name] = walked.value;
      changed = true;
    } else if (
      needsSourceValue(field, inLocaleCopy, sourceValue, walked.value)
    ) {
      value[field.name] = clone(sourceValue);
      changed = true;
    }
  }
  return { value, changed };
}

function walkField(
  field: FlattenedField,
  source: unknown,
  target: unknown,
  key: string,
  inLocaleCopy: boolean,
  visitor: Visitor,
  ctx: FieldContext
): Walked {
  const localized = isLocalized(field, inLocaleCopy);
  switch (field.type) {
    case 'text':
      if (!localized) return { value: target, changed: false };
      if (field.hasMany)
        return walkTextList(source, target, key, visitor, lengthLimit(field));
      // Slugs are left to Payload and the editor.
      if (isSlugField(field)) return { value: target, changed: false };
      return walkText(source, target, key, visitor, true, lengthLimit(field));
    case 'textarea':
      return localized
        ? walkText(source, target, key, visitor, false, lengthLimit(field))
        : { value: target, changed: false };
    case 'richText':
      return localized
        ? walkRichText(field, source, target, key, visitor, ctx)
        : { value: target, changed: false };
    case 'group':
    case 'tab':
      return walkGroup(
        field.flattenedFields,
        source,
        target,
        key,
        inLocaleCopy,
        Boolean(field.localized),
        visitor,
        ctx
      );
    case 'array':
      return walkRows(
        source,
        target,
        key,
        localized,
        () => field.flattenedFields,
        visitor,
        ctx
      );
    case 'blocks':
      return walkRows(
        source,
        target,
        key,
        localized,
        (row) => blockFields(field, row.blockType, ctx),
        visitor,
        ctx
      );
    default:
      return { value: target, changed: false };
  }
}

function walkText(
  source: unknown,
  target: unknown,
  key: string,
  visitor: Visitor,
  skipAddresses: boolean,
  limit: LengthLimit | undefined
): Walked {
  if (typeof source !== 'string' || source.trim() === '') {
    // Text removed from the source is removed from the locale too.
    return isEmpty(target)
      ? { value: target, changed: false }
      : { value: typeof source === 'string' ? source : null, changed: true };
  }
  if (skipAddresses && isAddress(source))
    return { value: target, changed: false };
  const replaced = visitor.text(
    key,
    source,
    typeof target === 'string' && target !== '' ? target : undefined,
    limit
  );
  return replaced === undefined
    ? { value: target, changed: false }
    : { value: replaced, changed: true };
}

function walkTextList(
  source: unknown,
  target: unknown,
  key: string,
  visitor: Visitor,
  limit: LengthLimit | undefined
): Walked {
  if (!Array.isArray(source)) return { value: target, changed: false };
  const targets = Array.isArray(target) ? target : [];
  let changed = false;
  const value = source.map((item, index) => {
    const walked = walkText(
      item,
      targets[index],
      `${key}.${index}`,
      visitor,
      true,
      limit
    );
    changed ||= walked.changed;
    return walked.changed ? walked.value : (targets[index] ?? item);
  });
  return { value, changed };
}

function walkGroup(
  fields: FlattenedField[],
  source: unknown,
  target: unknown,
  key: string,
  inLocaleCopy: boolean,
  localized: boolean,
  visitor: Visitor,
  ctx: FieldContext
): Walked {
  const copy = inLocaleCopy || localized;
  const walked = walkFields(
    fields,
    isData(source) ? source : undefined,
    isData(target) ? target : undefined,
    key,
    copy,
    visitor,
    ctx
  );
  if (!walked.changed) return { value: target, changed: false };
  // A group in a locale's own copy is rebuilt from the source, so the fields
  // it does not translate come along.
  return {
    value: copy
      ? { ...(withoutRowIds(clone(source)) as Data), ...walked.value }
      : walked.value,
    changed: true,
  };
}

function walkRows(
  source: unknown,
  target: unknown,
  key: string,
  localeCopy: boolean,
  fieldsFor: (row: Row) => FlattenedField[] | undefined,
  visitor: Visitor,
  ctx: FieldContext
): Walked {
  if (!Array.isArray(source) || source.length === 0) {
    // A locale's own rows go when the source has none.
    return localeCopy && !isEmpty(target)
      ? { value: [], changed: true }
      : { value: target, changed: false };
  }
  const targets: Row[] = Array.isArray(target) ? target : [];
  let changed = false;
  const value = (source as Row[]).map((row, index) => {
    const fields = fieldsFor(row) ?? [];
    // Shared rows match the target by id; a locale's own rows by position.
    const targetRow = localeCopy
      ? targets[index]
      : targets.find((t) => t.id === row.id);
    const walked = walkFields(
      fields,
      row,
      targetRow,
      `${key}.${row.id}`,
      localeCopy,
      visitor,
      ctx
    );
    changed ||= walked.changed;
    if (localeCopy) {
      // Row ids are unique across locales, so a locale's copy gets new ones.
      const { id: _id, ...copy } = withoutRowIds(clone(row)) as Data;
      return { ...copy, ...walked.value };
    }
    return {
      id: row.id,
      ...(row.blockType ? { blockType: row.blockType } : {}),
      ...walked.value,
    };
  });
  return { value, changed };
}

function isTextElement(node: LexicalNode): boolean {
  return (
    Array.isArray(node.children) &&
    node.children.length > 0 &&
    node.children.every(isInlineNode)
  );
}

// Whether a rich text tree holds any text, or any node without children such
// as an upload, a block or a divider.
function hasContent(node: LexicalNode): boolean {
  if (node.type === 'text') return String(node.text ?? '').trim() !== '';
  if (!Array.isArray(node.children))
    return !['linebreak', 'tab'].includes(node.type);
  return node.children.some(hasContent);
}

function walkRichText(
  field: RichTextField,
  source: unknown,
  target: unknown,
  key: string,
  visitor: Visitor,
  ctx: FieldContext
): Walked {
  const root = isData(source)
    ? (source.root as LexicalNode | undefined)
    : undefined;
  // Rich text emptied in the source is emptied in the locale too.
  if (!root || !hasContent(root))
    return isEmpty(target)
      ? { value: target, changed: false }
      : { value: source ?? null, changed: true };
  const targetRoot = isData(target)
    ? (target.root as LexicalNode | undefined)
    : undefined;
  const tree = clone(source as Data);
  const changed = walkNode(
    field,
    tree.root as LexicalNode,
    targetRoot,
    key,
    '',
    visitor,
    ctx
  );
  if (changed) return { value: tree, changed };
  // Rich text with nothing to translate, like a lone image, is copied as is.
  return isEmpty(target) && !hasTextElement(root)
    ? { value: tree, changed: true }
    : { value: target, changed: false };
}

function hasTextElement(node: LexicalNode): boolean {
  if (node.type === 'block' || isTextElement(node)) return true;
  return (node.children ?? []).some(hasTextElement);
}

// Returns whether any element was replaced. Elements without a replacement
// keep the target's text when the target has the same element, otherwise the
// source's.
function walkNode(
  field: RichTextField,
  node: LexicalNode,
  target: LexicalNode | undefined,
  key: string,
  path: string,
  visitor: Visitor,
  ctx: FieldContext
): boolean {
  const sameTarget = target && target.type === node.type ? target : undefined;
  if (node.type === 'block' && isData(node.fields)) {
    const fields = richTextBlockFields(field, node.fields.blockType);
    if (!fields) return false;
    const walked = walkFields(
      fields,
      node.fields,
      isData(sameTarget?.fields) ? sameTarget.fields : undefined,
      `${key}#${path}`,
      true,
      visitor,
      ctx
    );
    if (walked.changed) node.fields = { ...node.fields, ...walked.value };
    return walked.changed;
  }
  if (isTextElement(node)) {
    const encoded = encodeElement(node);
    if (!encoded) return false;
    const replaced = visitor.element(`${key}#${path}`, encoded, sameTarget);
    if (replaced) node.children = replaced;
    else if (sameTarget?.children) node.children = clone(sameTarget.children);
    return Boolean(replaced);
  }
  let changed = false;
  (node.children ?? []).forEach((child, index) => {
    const childPath = path ? `${path}.${index}` : `${index}`;
    changed =
      walkNode(
        field,
        child,
        sameTarget?.children?.[index],
        key,
        childPath,
        visitor,
        ctx
      ) || changed;
  });
  return changed;
}

// Whether a field list holds anything walkFields would translate.
export function hasTranslatableFields(
  fields: FlattenedField[],
  inLocaleCopy = false
): boolean {
  return fields.some((field) => {
    if (skipped(field)) return false;
    const localized = isLocalized(field, inLocaleCopy);
    switch (field.type) {
      case 'text':
        return localized && !isSlugField(field);
      case 'textarea':
      case 'richText':
        return localized;
      case 'group':
      case 'tab':
      case 'array':
        return hasTranslatableFields(field.flattenedFields, localized);
      case 'blocks':
        return field.blocks.some((block) =>
          hasTranslatableFields(block.flattenedFields, localized)
        );
      default:
        return false;
    }
  });
}
