use std::collections::HashSet;
use std::sync::LazyLock;

/// Set of valid plural forms
pub static PLURAL_FORMS: LazyLock<HashSet<&'static str>> = LazyLock::new(|| {
  [
    "singular", "plural", "dual", "zero", "one", "two", "few", "many", "other",
  ]
  .into_iter()
  .collect()
});

/// HTML elements whose content model does NOT permit a direct `<span>` child.
/// A `<T>` rendered directly inside one of these can't be wrapped in the
/// opt-in id-tagging `display:contents` span without producing invalid nesting
/// — the browser hoists the span out of the element, causing a hydration
/// mismatch. When a `<T>`'s immediate static JSX parent is one of these, the
/// plugin marks it (`_noTag`) so the runtime skips the tagging span. The
/// translation itself is unaffected (lookup still uses `_hash`); only the
/// DOM-tooling attribute is dropped.
pub static SPAN_HOSTILE_PARENTS: LazyLock<HashSet<&'static str>> =
  LazyLock::new(|| {
    [
      "table", "thead", "tbody", "tfoot", "tr", "colgroup", "select",
      "optgroup", "ul", "ol", "menu", "dl", "hgroup", "picture",
    ]
    .into_iter()
    .collect()
  });

/// Whether `tag` is an HTML element that can't legally contain a `<span>` child.
/// Only matches lowercase HTML tag names, so React components (capitalized) are
/// never treated as span-hostile — their rendered output is unknowable at
/// compile time, so the runtime span is left in place for them.
pub fn is_span_hostile_parent(tag: &str) -> bool {
  SPAN_HOSTILE_PARENTS.contains(tag)
}
