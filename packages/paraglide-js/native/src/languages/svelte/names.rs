//! Names in markup as Svelte 5's parser tells them apart: elements, components and special
//! elements, void elements, and the elements an opening tag closes.

use super::js::char_at;

/// What an opening tag is, as Svelte names its node.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum ElementKind {
  /// An HTML, SVG or custom element.
  Regular,
  Component,
  /// `<title>` in `<svelte:head>`.
  Title,
  /// `<slot>`, Svelte 4's.
  Slot,
  SvelteHead,
  SvelteOptions,
  SvelteWindow,
  SvelteDocument,
  SvelteBody,
  SvelteElement,
  SvelteComponent,
  SvelteSelf,
  SvelteFragment,
  SvelteBoundary,
}

impl ElementKind {
  /// The special element named `name`, which starts with `svelte:`.
  pub fn special(name: &[u8]) -> Option<ElementKind> {
    Some(match name {
      b"svelte:head" => ElementKind::SvelteHead,
      b"svelte:options" => ElementKind::SvelteOptions,
      b"svelte:window" => ElementKind::SvelteWindow,
      b"svelte:document" => ElementKind::SvelteDocument,
      b"svelte:body" => ElementKind::SvelteBody,
      b"svelte:element" => ElementKind::SvelteElement,
      b"svelte:component" => ElementKind::SvelteComponent,
      b"svelte:self" => ElementKind::SvelteSelf,
      b"svelte:fragment" => ElementKind::SvelteFragment,
      b"svelte:boundary" => ElementKind::SvelteBoundary,
      _ => return None,
    })
  }

  /// One of the special elements that only the top level may have, once.
  pub fn root_only_bit(self) -> u8 {
    match self {
      ElementKind::SvelteHead => 1,
      ElementKind::SvelteOptions => 2,
      ElementKind::SvelteWindow => 4,
      ElementKind::SvelteDocument => 8,
      ElementKind::SvelteBody => 16,
      _ => 0,
    }
  }
}

/// `<br>` and the like, which have no content or closing tag.
pub fn is_void(name: &[u8]) -> bool {
  matches!(
    name,
    b"area"
      | b"base"
      | b"br"
      | b"col"
      | b"command"
      | b"embed"
      | b"hr"
      | b"img"
      | b"input"
      | b"keygen"
      | b"link"
      | b"meta"
      | b"param"
      | b"source"
      | b"track"
      | b"wbr"
  ) || name.eq_ignore_ascii_case(b"!doctype")
}

/// Whether an opening tag `next` closes the element `current` that is still open, as `<p>` closes
/// an open `<p>`.
pub fn closing_tag_omitted(current: &[u8], next: &[u8]) -> bool {
  let closed_by: &[&[u8]] = match current {
    b"li" => &[b"li"],
    b"dt" | b"dd" => &[b"dt", b"dd"],
    b"p" => &[
      b"address",
      b"article",
      b"aside",
      b"blockquote",
      b"div",
      b"dl",
      b"fieldset",
      b"footer",
      b"form",
      b"h1",
      b"h2",
      b"h3",
      b"h4",
      b"h5",
      b"h6",
      b"header",
      b"hgroup",
      b"hr",
      b"main",
      b"menu",
      b"nav",
      b"ol",
      b"p",
      b"pre",
      b"section",
      b"table",
      b"ul",
    ],
    b"rt" | b"rp" => &[b"rt", b"rp"],
    b"optgroup" => &[b"optgroup"],
    b"option" => &[b"option", b"optgroup"],
    b"thead" | b"tbody" => &[b"tbody", b"tfoot"],
    b"tfoot" => &[b"tbody"],
    b"tr" => &[b"tr", b"tbody"],
    b"td" | b"th" => &[b"td", b"th", b"tr"],
    _ => return false,
  };

  closed_by.contains(&next)
}

/// An HTML element, `!DOCTYPE`, or a namespaced name such as `svelte:head`.
pub fn is_valid_element_name(name: &[u8]) -> bool {
  is_doctype_name(name) || is_namespaced_name(name) || is_valid_tag_name(name)
}

/// `/^![a-zA-Z]+$/`
fn is_doctype_name(name: &[u8]) -> bool {
  name.len() > 1 && name[0] == b'!' && name[1..].iter().all(u8::is_ascii_alphabetic)
}

/// `/^[a-zA-Z][a-zA-Z0-9]*:[a-zA-Z][a-zA-Z0-9-]*[a-zA-Z0-9]$/`
fn is_namespaced_name(name: &[u8]) -> bool {
  let Some(colon) = name.iter().position(|&byte| byte == b':') else {
    return false;
  };
  let (namespace, local) = (&name[..colon], &name[colon + 1..]);

  namespace.first().is_some_and(u8::is_ascii_alphabetic)
    && namespace.iter().all(u8::is_ascii_alphanumeric)
    && local.len() >= 2
    && local[0].is_ascii_alphabetic()
    && local[local.len() - 1].is_ascii_alphanumeric()
    && local
      .iter()
      .all(|&byte| byte.is_ascii_alphanumeric() || byte == b'-')
}

/// `REGEX_VALID_TAG_NAME`: letters and digits, then optionally `-` and more characters.
fn is_valid_tag_name(name: &[u8]) -> bool {
  if !name.first().is_some_and(u8::is_ascii_alphabetic) {
    return false;
  }
  let Some(dash) = name.iter().position(|&byte| !byte.is_ascii_alphanumeric()) else {
    return true;
  };
  if name[dash] != b'-' {
    return false;
  }

  name[dash + 1..]
    .iter()
    .all(|&byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'-' | b'_') || byte >= 0x80)
}

/// `regex_valid_component_name`: a capitalized name, or a member chain such as `ui.Button`.
pub fn is_component_name(name: &[u8]) -> bool {
  let Some((first, _)) = char_at(name, 0) else {
    return false;
  };

  if first.is_uppercase() {
    return each_char(name, |character| {
      is_id_continue(character) || character == '.'
    });
  }

  let mut segments = name.split(|&byte| byte == b'.');
  let Some(head) = segments.next() else {
    return false;
  };
  let head_is_identifier = char_at(head, 0).is_some_and(|(character, _)| character.is_alphabetic())
    && each_char(head, is_id_continue);
  let mut tail = 0;
  for segment in segments {
    if segment.is_empty() || !each_char(segment, is_id_continue) {
      return false;
    }
    tail += 1;
  }

  head_is_identifier && tail > 0
}

fn is_id_continue(character: char) -> bool {
  character.is_alphanumeric() || matches!(character, '_' | '$' | '\u{200c}' | '\u{200d}')
}

fn each_char(text: &[u8], test: impl Fn(char) -> bool) -> bool {
  std::str::from_utf8(text).is_ok_and(|text| text.chars().all(test))
}

/// A JavaScript identifier: what may be written as a variable or a property key unquoted.
pub fn is_identifier(text: &[u8]) -> bool {
  let Ok(text) = std::str::from_utf8(text) else {
    return false;
  };
  let mut characters = text.chars();
  let Some(first) = characters.next() else {
    return false;
  };

  (first.is_alphabetic() || first == '_' || first == '$')
    && characters.all(is_id_continue)
    && !is_reserved(text.as_bytes())
}

/// Identifiers joined by dots, e.g. `actions.tooltip`.
pub fn is_member_chain(text: &[u8]) -> bool {
  text.split(|&byte| byte == b'.').all(is_identifier)
}

/// The words Svelte does not take as an identifier.
pub fn is_reserved(word: &[u8]) -> bool {
  matches!(
    word,
    b"arguments"
      | b"await"
      | b"break"
      | b"case"
      | b"catch"
      | b"class"
      | b"const"
      | b"continue"
      | b"debugger"
      | b"default"
      | b"delete"
      | b"do"
      | b"else"
      | b"enum"
      | b"eval"
      | b"export"
      | b"extends"
      | b"false"
      | b"finally"
      | b"for"
      | b"function"
      | b"if"
      | b"implements"
      | b"import"
      | b"in"
      | b"instanceof"
      | b"interface"
      | b"let"
      | b"new"
      | b"null"
      | b"package"
      | b"private"
      | b"protected"
      | b"public"
      | b"return"
      | b"static"
      | b"super"
      | b"switch"
      | b"this"
      | b"throw"
      | b"true"
      | b"try"
      | b"typeof"
      | b"var"
      | b"void"
      | b"while"
      | b"with"
      | b"yield"
  )
}
