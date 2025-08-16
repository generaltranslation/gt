
use std::collections::HashSet;
use std::sync::LazyLock;

/// Set of valid plural forms
pub static PLURAL_FORMS: LazyLock<HashSet<&'static str>> = LazyLock::new(|| {
  ["singular", "plural", "dual", "zero", "one", "two", "few", "many", "other"]
      .into_iter().collect()
});