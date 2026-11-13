//! Paths as the analysis compares them: absolute, normalized strings.

use std::{borrow::Cow, path::MAIN_SEPARATOR};

/// With forward slashes: the path itself where they are the separator.
pub fn to_posix(file: &str) -> Cow<'_, str> {
  if MAIN_SEPARATOR == '/' {
    Cow::Borrowed(file)
  } else {
    Cow::Owned(file.replace(MAIN_SEPARATOR, "/"))
  }
}

fn is_separator(character: char) -> bool {
  character == '/' || character == MAIN_SEPARATOR
}

pub fn dirname(file: &str) -> &str {
  match file.rfind(is_separator) {
    Some(0) => &file[..1],
    Some(index) => &file[..index],
    None => ".",
  }
}

pub fn basename(file: &str) -> &str {
  match file.rfind(is_separator) {
    Some(index) => &file[index + 1..],
    None => file,
  }
}

/// `file` relative to `directory`, with its separators, if inside it.
fn within<'f>(directory: &str, file: &'f str) -> Option<&'f str> {
  let rest = file.strip_prefix(directory)?;
  let directory_ends_with_separator = directory.ends_with(is_separator);

  let relative = if directory_ends_with_separator {
    rest
  } else {
    let mut characters = rest.chars();
    let first = characters.next()?;
    if !is_separator(first) {
      return None;
    }
    characters.as_str()
  };

  // `..name` reads like a path that leaves the directory, as it does to Node's `path.relative` check.
  if relative.is_empty() || relative.starts_with("..") {
    return None;
  }

  Some(relative)
}

/// `file` relative to `directory` with forward slashes, if inside it.
pub fn relative_within<'f>(directory: &str, file: &'f str) -> Option<Cow<'f, str>> {
  within(directory, file).map(to_posix)
}

pub fn is_within(directory: &str, file: &str) -> bool {
  within(directory, file).is_some()
}

/// `.js`, `.mjs`, `.cts`, `.tsx`, …: the extension of a script, if `file` has one.
fn script_extension(file: &str) -> Option<&str> {
  let dot = file.rfind('.')?;
  let extension = &file[dot + 1..];

  let unprefixed = extension.strip_prefix(['c', 'm']).unwrap_or(extension);
  let base = unprefixed.strip_suffix('x').unwrap_or(unprefixed);
  let is_script = base == "js" || base == "ts";

  is_script.then_some(&file[dot..])
}

/// `a.d.ts`, `a.d.mts`, `a.d.cts`
pub fn is_declaration_file(file: &str) -> bool {
  [".d.ts", ".d.mts", ".d.cts"]
    .iter()
    .any(|suffix| file.ends_with(suffix))
}

pub fn is_script(file: &str) -> bool {
  script_extension(file).is_some() && !is_declaration_file(file)
}

pub fn is_dependency(file: &str) -> bool {
  to_posix(file).contains("/node_modules/")
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn scripts() {
    assert!(is_script("/a/b.ts"));
    assert!(is_script("/a/b.mjs"));
    assert!(is_script("/a/b.cjsx"));
    assert!(!is_script("/a/b.d.ts"));
    assert!(!is_script("/a/b.json"));
    assert!(!is_script("/a/b.jsxx"));
  }

  #[test]
  fn within() {
    assert_eq!(
      relative_within("/a", "/a/b/c.js").as_deref(),
      Some("b/c.js")
    );
    assert_eq!(relative_within("/a", "/a/"), None);
    assert_eq!(relative_within("/a/", "/a/b.js").as_deref(), Some("b.js"));
    assert_eq!(relative_within("/a", "/a"), None);
    assert_eq!(relative_within("/a", "/ab/c.js"), None);
    assert_eq!(relative_within("/a", "/a/..b/c.js"), None);
  }
}
