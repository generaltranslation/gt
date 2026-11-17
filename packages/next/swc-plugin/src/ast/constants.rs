/// Plural categories a Plural component takes as branch props
const PLURAL_FORMS: [&str; 6] = ["zero", "one", "two", "few", "many", "other"];

/// The key a Plural branch prop is stored under: a plural category as is, and
/// `_N`, an exact number, as ICU's `=N`. None when the prop is not a branch.
pub fn plural_branch_key(prop: &str) -> Option<String> {
  if PLURAL_FORMS.contains(&prop) {
    return Some(prop.to_string());
  }
  let digits = prop.strip_prefix('_')?;
  let is_integer = digits == "0"
    || (!digits.is_empty()
      && !digits.starts_with('0')
      && digits.bytes().all(|b| b.is_ascii_digit()));
  is_integer.then(|| format!("={digits}"))
}

#[cfg(test)]
mod tests {
  use super::plural_branch_key;

  #[test]
  fn maps_plural_props_to_stored_keys() {
    assert_eq!(plural_branch_key("one").as_deref(), Some("one"));
    assert_eq!(plural_branch_key("other").as_deref(), Some("other"));
    assert_eq!(plural_branch_key("_0").as_deref(), Some("=0"));
    assert_eq!(plural_branch_key("_12").as_deref(), Some("=12"));
    for prop in ["_01", "_", "_a", "singular", "plural", "dual", "n"] {
      assert_eq!(plural_branch_key(prop), None);
    }
  }
}
