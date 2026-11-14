//! Names as Vue's compiler reads them: which tags are native elements, and how a tag or attribute
//! names a component or prop.

use std::borrow::Cow;

/// `isHTMLTag`, `isSVGTag` and `isMathMLTag` of `@vue/shared`, sorted.
const NATIVE_TAGS: [&str; 225] = [
  "a",
  "abbr",
  "address",
  "animate",
  "animateMotion",
  "animateTransform",
  "annotation",
  "annotation-xml",
  "area",
  "article",
  "aside",
  "audio",
  "b",
  "base",
  "bdi",
  "bdo",
  "blockquote",
  "body",
  "br",
  "button",
  "canvas",
  "caption",
  "circle",
  "cite",
  "clipPath",
  "code",
  "col",
  "colgroup",
  "color-profile",
  "data",
  "datalist",
  "dd",
  "defs",
  "del",
  "desc",
  "details",
  "dfn",
  "dialog",
  "discard",
  "div",
  "dl",
  "dt",
  "ellipse",
  "em",
  "embed",
  "feBlend",
  "feColorMatrix",
  "feComponentTransfer",
  "feComposite",
  "feConvolveMatrix",
  "feDiffuseLighting",
  "feDisplacementMap",
  "feDistantLight",
  "feDropShadow",
  "feFlood",
  "feFuncA",
  "feFuncB",
  "feFuncG",
  "feFuncR",
  "feGaussianBlur",
  "feImage",
  "feMerge",
  "feMergeNode",
  "feMorphology",
  "feOffset",
  "fePointLight",
  "feSpecularLighting",
  "feSpotLight",
  "feTile",
  "feTurbulence",
  "fieldset",
  "figcaption",
  "figure",
  "filter",
  "footer",
  "foreignObject",
  "form",
  "g",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hatch",
  "hatchpath",
  "head",
  "header",
  "hgroup",
  "hr",
  "html",
  "i",
  "iframe",
  "image",
  "img",
  "input",
  "ins",
  "kbd",
  "label",
  "legend",
  "li",
  "line",
  "linearGradient",
  "link",
  "maction",
  "main",
  "maligngroup",
  "malignmark",
  "map",
  "mark",
  "marker",
  "mask",
  "math",
  "menclose",
  "menu",
  "merror",
  "mesh",
  "meshgradient",
  "meshpatch",
  "meshrow",
  "meta",
  "metadata",
  "meter",
  "mfenced",
  "mfrac",
  "mfraction",
  "mglyph",
  "mi",
  "mlabeledtr",
  "mlongdiv",
  "mmultiscripts",
  "mn",
  "mo",
  "mover",
  "mpadded",
  "mpath",
  "mphantom",
  "mprescripts",
  "mroot",
  "mrow",
  "ms",
  "mscarries",
  "mscarry",
  "msgroup",
  "msline",
  "mspace",
  "msqrt",
  "msrow",
  "mstack",
  "mstyle",
  "msub",
  "msubsup",
  "msup",
  "mtable",
  "mtd",
  "mtext",
  "mtr",
  "munder",
  "munderover",
  "nav",
  "none",
  "noscript",
  "object",
  "ol",
  "optgroup",
  "option",
  "output",
  "p",
  "param",
  "path",
  "pattern",
  "picture",
  "polygon",
  "polyline",
  "pre",
  "progress",
  "q",
  "radialGradient",
  "rect",
  "rp",
  "rt",
  "ruby",
  "s",
  "samp",
  "script",
  "section",
  "select",
  "semantics",
  "set",
  "small",
  "solidcolor",
  "source",
  "span",
  "stop",
  "strong",
  "style",
  "sub",
  "summary",
  "sup",
  "svg",
  "switch",
  "symbol",
  "table",
  "tbody",
  "td",
  "template",
  "text",
  "textPath",
  "textarea",
  "tfoot",
  "th",
  "thead",
  "time",
  "title",
  "tr",
  "track",
  "tspan",
  "u",
  "ul",
  "unknown",
  "use",
  "var",
  "video",
  "view",
  "wbr",
];

/// `isVoidTag` of `@vue/shared`: elements without children or an end tag. Case matters: `<Input>`
/// is a component, with children.
pub fn is_void_tag(tag: &[u8]) -> bool {
  matches!(
    tag,
    b"area"
      | b"base"
      | b"br"
      | b"col"
      | b"embed"
      | b"hr"
      | b"img"
      | b"input"
      | b"link"
      | b"meta"
      | b"param"
      | b"source"
      | b"track"
      | b"wbr"
  )
}

pub fn is_native_tag(tag: &[u8]) -> bool {
  NATIVE_TAGS
    .binary_search_by(|native| native.as_bytes().cmp(tag))
    .is_ok()
}

/// `\w` of a JavaScript regular expression.
pub fn is_word_byte(byte: u8) -> bool {
  byte.is_ascii_alphanumeric() || byte == b'_'
}

/// An ASCII identifier, as `identifierRE` of `@vue/language-core` accepts (with `$`).
pub fn is_identifier(name: &[u8]) -> bool {
  let Some((&first, rest)) = name.split_first() else {
    return false;
  };
  let is_start = |byte: u8| byte.is_ascii_alphabetic() || byte == b'_' || byte == b'$';

  is_start(first)
    && rest
      .iter()
      .all(|&byte| is_start(byte) || byte.is_ascii_digit())
}

/// `camelize` of `@vue/shared`: `paraglide-message` → `paraglideMessage`.
pub fn camelize(name: &str) -> Cow<'_, str> {
  let bytes = name.as_bytes();
  let has_dash_word = bytes
    .windows(2)
    .any(|pair| pair[0] == b'-' && is_word_byte(pair[1]));
  if !has_dash_word {
    return Cow::Borrowed(name);
  }

  let mut camel = String::with_capacity(name.len());
  let mut characters = name.chars().peekable();
  while let Some(character) = characters.next() {
    let next_is_word = characters
      .peek()
      .is_some_and(|&next| next.is_ascii() && is_word_byte(next as u8));
    if character == '-' && next_is_word {
      if let Some(next) = characters.next() {
        camel.push(next.to_ascii_uppercase());
      }
    } else {
      camel.push(character);
    }
  }
  Cow::Owned(camel)
}

/// `capitalize` of `@vue/shared`.
pub fn capitalize(name: &str) -> Cow<'_, str> {
  match name.as_bytes().first() {
    Some(first) if first.is_ascii_lowercase() => {
      let mut capitalized = String::with_capacity(name.len());
      capitalized.push(first.to_ascii_uppercase() as char);
      capitalized.push_str(&name[1..]);
      Cow::Owned(capitalized)
    }
    _ => Cow::Borrowed(name),
  }
}

/// The name a tag renders, as `@vue/language-core` writes it: the component the script imports
/// from a `.vue` file under one of the names Vue resolves the tag to, else the tag in PascalCase if
/// it is kebab-case (`<message-view>` → `MessageView`, a global component). None when it is no
/// identifier.
pub fn component_name<'t>(tag: &'t str, imported: &[&str]) -> Option<Cow<'t, str>> {
  let camel = camelize(tag);
  if !is_identifier(camel.as_bytes()) {
    return None;
  }
  let pascal = capitalize(&camel).into_owned();

  if imported.contains(&pascal.as_str()) {
    return Some(Cow::Owned(pascal));
  }
  if imported.contains(&camel.as_ref()) {
    return Some(Cow::Owned(camel.into_owned()));
  }
  if tag.contains('-') {
    return Some(Cow::Owned(pascal));
  }
  Some(camel)
}

/// Writes `text` as a JavaScript string literal.
pub fn push_string_literal(literal: &mut String, text: &str) {
  literal.push('"');
  for character in text.chars() {
    match character {
      '"' => literal.push_str("\\\""),
      '\\' => literal.push_str("\\\\"),
      '\n' => literal.push_str("\\n"),
      '\r' => literal.push_str("\\r"),
      '\u{2028}' => literal.push_str("\\u2028"),
      '\u{2029}' => literal.push_str("\\u2029"),
      character if (character as u32) < 0x20 => {
        literal.push_str(&format!("\\u{:04x}", character as u32));
      }
      character => literal.push(character),
    }
  }
  literal.push('"');
}

/// HTML's whitespace, as Vue's tokenizer has it.
pub fn is_html_space(byte: u8) -> bool {
  matches!(byte, b' ' | b'\t' | b'\n' | b'\r' | b'\x0c')
}

/// `s` without HTML whitespace around it.
pub fn trim(text: &[u8], start: usize, end: usize) -> (usize, usize) {
  let mut start = start;
  let mut end = end;
  while start < end && is_html_space(text[start]) {
    start += 1;
  }
  while end > start && is_html_space(text[end - 1]) {
    end -= 1;
  }
  (start, end)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn native_tags_are_sorted() {
    assert!(NATIVE_TAGS.windows(2).all(|pair| pair[0] < pair[1]));
    assert!(is_native_tag(b"div"));
    assert!(is_native_tag(b"foreignObject"));
    assert!(is_native_tag(b"annotation-xml"));
    assert!(!is_native_tag(b"Div"));
    assert!(!is_native_tag(b"paraglide-message"));
  }

  #[test]
  fn names_are_camelized_as_vue_does() {
    assert_eq!(camelize("paraglide-message"), "paraglideMessage");
    assert_eq!(camelize("my-1st-prop"), "my1stProp");
    assert_eq!(camelize("trailing-"), "trailing-");
    assert_eq!(camelize("plain"), "plain");
    assert_eq!(capitalize("paraglideMessage"), "ParaglideMessage");
  }

  #[test]
  fn tags_name_imported_components_first() {
    assert_eq!(
      component_name("paraglide-message", &[]).as_deref(),
      Some("ParaglideMessage")
    );
    assert_eq!(component_name("foo", &[]).as_deref(), Some("foo"));
    assert_eq!(component_name("foo", &["Foo"]).as_deref(), Some("Foo"));
    assert_eq!(
      component_name("my-item", &["myItem"]).as_deref(),
      Some("myItem")
    );
    assert_eq!(component_name("my:item", &[]), None);
  }

  #[test]
  fn strings_are_escaped() {
    let mut literal = String::new();
    push_string_literal(&mut literal, "a\"b\\c\nd\u{1}");
    assert_eq!(literal, "\"a\\\"b\\\\c\\nd\\u0001\"");
  }
}
