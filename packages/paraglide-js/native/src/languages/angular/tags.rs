//! What Angular's HTML parser knows of each tag (`getHtmlTagDefinition` in `@angular/compiler`):
//! which close implicitly, which are void, which hold raw text.

use super::entities::NAMED_ENTITIES;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Content {
  Parsable,
  RawText,
  EscapableRawText,
  /// `<title>`: escapable raw text, but parsable with the `svg` prefix.
  Title,
}

#[derive(Clone, Copy, Debug)]
pub struct TagDefinition {
  closed_by_children: &'static [&'static str],
  pub closed_by_parent: bool,
  pub implicit_namespace: Option<&'static str>,
  pub is_void: bool,
  pub ignore_first_lf: bool,
  pub prevents_namespace_inheritance: bool,
  pub can_self_close: bool,
  content: Content,
}

impl TagDefinition {
  const fn new() -> Self {
    TagDefinition {
      closed_by_children: &[],
      closed_by_parent: false,
      implicit_namespace: None,
      is_void: false,
      ignore_first_lf: false,
      prevents_namespace_inheritance: false,
      can_self_close: false,
      content: Content::Parsable,
    }
  }

  const fn void() -> Self {
    TagDefinition {
      is_void: true,
      closed_by_parent: true,
      ..TagDefinition::new()
    }
  }

  const fn closed_by(children: &'static [&'static str], closed_by_parent: bool) -> Self {
    TagDefinition {
      closed_by_children: children,
      closed_by_parent,
      ..TagDefinition::new()
    }
  }

  /// Whether a `name` child closes it.
  pub fn is_closed_by_child(&self, name: &str) -> bool {
    self.is_void
      || self
        .closed_by_children
        .iter()
        .any(|child| child.eq_ignore_ascii_case(name))
  }

  pub fn content(&self, prefix: &str) -> Content {
    match self.content {
      Content::Title if prefix == "svg" => Content::Parsable,
      Content::Title => Content::EscapableRawText,
      content => content,
    }
  }
}

/// Custom elements, and those of a namespace.
const DEFAULT: TagDefinition = TagDefinition {
  can_self_close: true,
  ..TagDefinition::new()
};

/// The elements Angular's DOM schema knows, which cannot close themselves.
const KNOWN: TagDefinition = TagDefinition::new();

const P_CLOSERS: &[&str] = &[
  "address",
  "article",
  "aside",
  "blockquote",
  "div",
  "dl",
  "fieldset",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hgroup",
  "hr",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "ul",
];

/// `DomElementSchemaRegistry.allKnownElementNames()` without a namespace, sorted.
const KNOWN_ELEMENTS: [&str; 129] = [
  "[element]",
  "[htmlelement]",
  "a",
  "abbr",
  "address",
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
  "cite",
  "code",
  "col",
  "colgroup",
  "content",
  "data",
  "datalist",
  "dd",
  "del",
  "details",
  "dfn",
  "dialog",
  "dir",
  "div",
  "dl",
  "dt",
  "em",
  "embed",
  "fieldset",
  "figcaption",
  "figure",
  "font",
  "footer",
  "form",
  "frame",
  "frameset",
  "geolocation",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "header",
  "hgroup",
  "hr",
  "html",
  "i",
  "iframe",
  "img",
  "input",
  "ins",
  "kbd",
  "keygen",
  "label",
  "legend",
  "li",
  "link",
  "main",
  "map",
  "mark",
  "marquee",
  "media",
  "menu",
  "menuitem",
  "meta",
  "meter",
  "nav",
  "noscript",
  "object",
  "ol",
  "optgroup",
  "option",
  "output",
  "p",
  "param",
  "picture",
  "pre",
  "progress",
  "q",
  "rb",
  "rp",
  "rt",
  "rtc",
  "ruby",
  "s",
  "samp",
  "script",
  "search",
  "section",
  "select",
  "selectedcontent",
  "slot",
  "small",
  "source",
  "span",
  "strong",
  "style",
  "sub",
  "summary",
  "sup",
  "table",
  "tbody",
  "td",
  "template",
  "textarea",
  "tfoot",
  "th",
  "thead",
  "time",
  "title",
  "tr",
  "track",
  "u",
  "ul",
  "unknown",
  "var",
  "video",
  "wbr",
];

/// The definition of the tag `name`: of the name as written, else in lowercase.
pub fn tag_definition(name: &str) -> TagDefinition {
  if name == "foreignObject" {
    return TagDefinition {
      implicit_namespace: Some("svg"),
      prevents_namespace_inheritance: true,
      ..TagDefinition::new()
    };
  }
  if name.starts_with(':') {
    return DEFAULT;
  }

  let mut lowercase = [0u8; 16];
  let lower: &str = if name.len() <= lowercase.len() && name.is_ascii() {
    for (index, byte) in name.bytes().enumerate() {
      lowercase[index] = byte.to_ascii_lowercase();
    }
    std::str::from_utf8(&lowercase[..name.len()]).unwrap_or(name)
  } else {
    return DEFAULT;
  };

  match lower {
    "base" | "meta" | "area" | "embed" | "link" | "img" | "input" | "param" | "hr" | "br"
    | "source" | "track" | "wbr" | "col" => TagDefinition::void(),
    "p" => TagDefinition::closed_by(P_CLOSERS, true),
    "thead" => TagDefinition::closed_by(&["tbody", "tfoot"], false),
    "tbody" => TagDefinition::closed_by(&["tbody", "tfoot"], true),
    "tfoot" => TagDefinition::closed_by(&["tbody"], true),
    "tr" => TagDefinition::closed_by(&["tr"], true),
    "td" | "th" => TagDefinition::closed_by(&["td", "th"], true),
    "svg" => TagDefinition {
      implicit_namespace: Some("svg"),
      ..TagDefinition::new()
    },
    "math" => TagDefinition {
      implicit_namespace: Some("math"),
      ..TagDefinition::new()
    },
    "li" => TagDefinition::closed_by(&["li"], true),
    "dt" => TagDefinition::closed_by(&["dt", "dd"], false),
    "dd" => TagDefinition::closed_by(&["dt", "dd"], true),
    "rb" | "rt" | "rp" => TagDefinition::closed_by(&["rb", "rt", "rtc", "rp"], true),
    "rtc" => TagDefinition::closed_by(&["rb", "rtc", "rp"], true),
    "optgroup" => TagDefinition::closed_by(&["optgroup"], true),
    "option" => TagDefinition::closed_by(&["option", "optgroup"], true),
    "pre" | "listing" => TagDefinition {
      ignore_first_lf: true,
      ..TagDefinition::new()
    },
    "style" | "script" => TagDefinition {
      content: Content::RawText,
      ..TagDefinition::new()
    },
    "title" => TagDefinition {
      content: Content::Title,
      ..TagDefinition::new()
    },
    "textarea" => TagDefinition {
      content: Content::EscapableRawText,
      ignore_first_lf: true,
      ..TagDefinition::new()
    },
    _ if KNOWN_ELEMENTS.binary_search(&lower).is_ok() => KNOWN,
    _ => DEFAULT,
  }
}

/// The text of the named character reference `name` (without `&` and `;`).
pub fn named_entity(name: &str) -> Option<&'static str> {
  NAMED_ENTITIES
    .binary_search_by(|(entity, _)| (*entity).cmp(name))
    .ok()
    .map(|index| NAMED_ENTITIES[index].1)
}

/// A numeric character reference's character: `#x41` or `#65`, without `&` and `;`. Decimal
/// references read their leading digits, as `parseInt` does.
pub fn numeric_entity(reference: &str, hex: bool) -> Option<char> {
  let digits = if hex {
    reference
  } else {
    let end = reference
      .bytes()
      .position(|byte| !byte.is_ascii_digit())
      .unwrap_or(reference.len());
    &reference[..end]
  };
  if digits.is_empty() || digits.len() > 8 {
    return None;
  }
  let code = u32::from_str_radix(digits, if hex { 16 } else { 10 }).ok()?;
  if code > 0x10ffff {
    return None;
  }
  Some(char::from_u32(code).unwrap_or('\u{fffd}'))
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn definitions() {
    assert!(tag_definition("input").is_void);
    assert!(tag_definition("INPUT").is_void);
    assert!(tag_definition("p").is_closed_by_child("DIV"));
    assert!(tag_definition("app-root").can_self_close);
    assert!(!tag_definition("div").can_self_close);
    assert!(tag_definition(":svg:path").can_self_close);
    assert_eq!(tag_definition("svg").implicit_namespace, Some("svg"));
    assert_eq!(tag_definition("title").content("svg"), Content::Parsable);
    assert_eq!(
      tag_definition("textarea").content(""),
      Content::EscapableRawText
    );
  }

  #[test]
  fn entities() {
    assert_eq!(named_entity("amp"), Some("&"));
    assert_eq!(named_entity("ngsp"), Some("\u{e500}"));
    assert_eq!(named_entity("nope"), None);
    assert_eq!(numeric_entity("64", false), Some('@'));
    assert_eq!(numeric_entity("12a", false), Some('\u{c}'));
    assert_eq!(numeric_entity("7d", true), Some('}'));
    assert_eq!(numeric_entity("", true), None);
  }
}
