//! Angular: components with an inline `template` in `.ts` files, `templateUrl` templates and plain
//! HTML pages (`.html`), and Analog single-file components (`.ag`, `.analog`).

use super::Generate;

/// None while JavaScript's tooling writes these files.
pub const GENERATE_COMPONENT: Option<Generate> = None;
/// None while JavaScript's tooling writes these files.
pub const GENERATE_TEMPLATE: Option<Generate> = None;
/// None while JavaScript's tooling writes these files.
pub const GENERATE_ANALOG: Option<Generate> = None;

/// As `/@Component\s*\(/` and `/\btemplate\s*:/` in JavaScript: a component with an inline template.
pub fn is_component_with_template(source: &str) -> bool {
  has_component_decorator(source) && has_template_property(source)
}

fn has_component_decorator(source: &str) -> bool {
  source.match_indices("@Component").any(|(at, name)| {
    source[at + name.len()..]
      .trim_start_matches(is_js_whitespace)
      .starts_with('(')
  })
}

fn has_template_property(source: &str) -> bool {
  source.match_indices("template").any(|(at, name)| {
    let is_word_start = source[..at]
      .chars()
      .next_back()
      .is_none_or(|before| !is_word_character(before));

    is_word_start
      && source[at + name.len()..]
        .trim_start_matches(is_js_whitespace)
        .starts_with(':')
  })
}

/// `\w` in a JavaScript regular expression.
fn is_word_character(character: char) -> bool {
  character.is_ascii_alphanumeric() || character == '_'
}

/// `\s` in a JavaScript regular expression.
fn is_js_whitespace(character: char) -> bool {
  character.is_whitespace() || character == '\u{feff}'
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn detects_components_with_inline_templates() {
    assert!(is_component_with_template(
      "@Component ({ selector: 'a', template : '<p></p>' }) class A {}"
    ));
    assert!(!is_component_with_template(
      "@Component({ templateUrl: './a.html' }) class A {}"
    ));
    assert!(!is_component_with_template(
      "@Component class A { template: 1 }"
    ));
    assert!(!is_component_with_template(
      "@Component({ mytemplate: 'x' }) class A {}"
    ));
  }
}
