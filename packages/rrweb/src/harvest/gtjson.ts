// GTJSON is GT's minified translation format: a locale's dictionary maps each message
// HASH to its translated content — a `JsxChildren` tree (string leaves, element nodes
// `{ t, c }`, variable placeholders `{ k, v }`) or, for string messages, a bare string.
// We only need to read it, so the shapes are declared locally rather than depending on
// `@generaltranslation/format` (gt-rrweb stays framework-agnostic — gt-react is an
// OPTIONAL peer).

/** A variable placeholder: `k` = name, `v` = minified type. Renders one text node. */
type GtVariable = { k: string; i?: number; v?: string };
/** GT metadata on an element; `b` present ⇒ plural/branch (no single rendered form). */
type GtProp = { b?: Record<string, GtJsxChildren>; t?: 'p' | 'b' };
/** An element: `t` = tag, `c` = children. */
type GtElement = { t?: string; i?: number; d?: GtProp; c?: GtJsxChildren };
export type GtJsxChild = string | GtElement | GtVariable;
export type GtJsxChildren = GtJsxChild | GtJsxChild[];

/** A locale's translations: hash → translated content (null when untranslated). */
export type TranslationDict = Record<string, GtJsxChildren | null>;

/**
 * A flattened leaf, one per rendered text node in document order: translatable `text`,
 * or a `variable` placeholder whose recorded (source) value must be kept.
 */
export type GtLeaf = { text: string } | { variable: true };

// GT field separators (U+001C–U+001F) delimit internal metadata inside string leaves;
// they never render, so strip them from emitted text. (Matching these control chars
// is the whole point.)
// oxlint-disable-next-line no-control-regex
const FIELD_SEP = /[\u001c-\u001f]/g;

function isElement(node: GtElement | GtVariable): node is GtElement {
  // A variable carries a `k` (name); an element never does.
  return !('k' in node);
}

// HTML void elements render neither children nor text. A CHILDLESS element that isn't
// one of these is a value-rendering component — a GT `<DateTime>`/`<Num>`/`<Currency>`
// (serialized as `{ t: 'LocalizedDateTime', … }`, no `c`) or a custom component — which
// renders one dynamic text node we must keep on source, NOT drop. Treating it as a
// placeholder (below) keeps the leaf count aligned with the rendered text nodes.
const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

/**
 * Flatten a GTJSON entry to its leaves in document order — one per text node the app
 * renders for this message. Strings become text leaves; variables (`{ k }`) and
 * value-rendering components (a childless non-void element, e.g. a localized date/number)
 * become placeholder leaves (the caller keeps the recorded source value); elements with
 * children (`{ t, c }`) recurse. A plural/branch (`d.b`) has no single rendered form, so
 * the whole entry is unresolvable and this returns `null` — the caller then skips that
 * message and leaves it on source. Pure.
 */
export function flattenEntry(
  entry: GtJsxChildren | null | undefined
): GtLeaf[] | null {
  if (entry == null) return null;
  const out: GtLeaf[] = [];
  let unresolvable = false;

  const walk = (node: GtJsxChild): void => {
    if (unresolvable) return;
    if (typeof node === 'string') {
      out.push({ text: node.replace(FIELD_SEP, '') });
      return;
    }
    if (!node || typeof node !== 'object') return;
    if (!isElement(node)) {
      out.push({ variable: true });
      return;
    }
    if (node.d?.b) {
      unresolvable = true; // plural/branch: which branch rendered is unknown
      return;
    }
    if (node.c != null) {
      walkChildren(node.c);
      return;
    }
    // Childless: a void element renders nothing; anything else renders one dynamic
    // text node (localized date/number, custom component) we keep on source.
    if (!(typeof node.t === 'string' && VOID_TAGS.has(node.t.toLowerCase()))) {
      out.push({ variable: true });
    }
  };

  const walkChildren = (children: GtJsxChildren): void => {
    if (Array.isArray(children)) children.forEach(walk);
    else walk(children);
  };

  walkChildren(entry);
  return unresolvable ? null : out;
}
