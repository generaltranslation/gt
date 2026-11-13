//! A metadata file's content: shaped like its message file, with under each
//! message that is used the source code around its usages, and the fields
//! written by hand kept. As `JSON.stringify(metadata, null, 2)` writes it.

use rayon::prelude::*;

use super::{
  json::{js_order, newline, write_string, write_value, Object, Value},
  snippets::{Group, SourceCode},
  NO_METADATA,
};

/// A message of a message file: `{ "nav": { "home": "Home" } }` has `nav.home` at `["nav", "home"]`.
pub struct MessageKey<'a> {
  pub id: &'a [u8],
  pub path: Vec<&'a [u8]>,
}

/// The metadata, as `renderMetadataFile` builds it.
enum Out<'a> {
  Object(OutObject<'a>),
  /// A field written by hand.
  Value(&'a Value),
  /// A message's `sourceCode`.
  SourceCode(&'a [Group]),
}

/// An object of the metadata: members are set as `Object.defineProperty` sets them.
type OutObject<'a> = Object<&'a [u8], Out<'a>>;

/// The object at `key`, made if it is not one: a step of `setAtPath`.
fn child<'o, 'a>(object: &'o mut OutObject<'a>, key: &'a [u8]) -> &'o mut OutObject<'a> {
  let position = match object.position(key) {
    Some(position) if matches!(object.members()[position].1, Out::Object(_)) => position,
    _ => object.insert(key, Out::Object(OutObject::default())),
  };

  match object.value_at_mut(position) {
    Out::Object(child) => child,
    // An object, just above.
    _ => unreachable!(),
  }
}

/// The positions of an object's members in the order JavaScript enumerates them.
fn order(object: &OutObject) -> Vec<usize> {
  let members = object.members();
  js_order(members.len(), |member| members[member].0)
}

/// A metadata file's content, in pieces: the large ones are written on every core.
pub struct Rendered {
  pub chunks: Vec<Vec<u8>>,
}

impl Rendered {
  fn len(&self) -> usize {
    self.chunks.iter().map(Vec::len).sum()
  }

  /// Whether the content is `text`.
  pub fn equals(&self, text: &[u8]) -> bool {
    if self.len() != text.len() {
      return false;
    }

    let mut rest = text;
    self.chunks.iter().all(|chunk| {
      let (head, tail) = rest.split_at(chunk.len());
      rest = tail;
      head == chunk.as_slice()
    })
  }

  pub fn into_bytes(self) -> Vec<u8> {
    self.chunks.concat()
  }
}

/// A message file's metadata: for each of its `keys`, the fields of `existing`
/// written by hand, and the snippets of `source`.
pub fn render(keys: &[MessageKey], existing: &Object, source: &SourceCode) -> Rendered {
  let mut metadata = OutObject::default();

  for key in keys {
    // `setAtPath` sets nothing at no path.
    let Some((last, parents)) = key.path.split_last() else {
      continue;
    };

    let mut entry = hand_written_fields(existing, &key.path);
    if let Some(groups) = source.of(key.id) {
      entry.insert(&b"sourceCode"[..], Out::SourceCode(groups));
    }

    if entry.is_empty() {
      continue;
    }

    let mut parent = &mut metadata;
    for key in parents {
      parent = child(parent, key);
    }
    parent.insert(last, Out::Object(entry));
  }

  if metadata.is_empty() {
    return Rendered {
      chunks: vec![NO_METADATA.to_vec()],
    };
  }

  // Each of the top level's members on a core of its own.
  let order = order(&metadata);
  let members: Vec<Vec<u8>> = order
    .par_iter()
    .enumerate()
    .map(|(position, &member)| {
      let mut out = Vec::new();
      if position > 0 {
        out.push(b',');
      }
      let (key, value) = &metadata.members()[member];
      write_member(&mut out, key, value, source, 1);
      out
    })
    .collect();

  let mut chunks = Vec::with_capacity(members.len() + 2);
  chunks.push(b"{".to_vec());
  chunks.extend(members);
  chunks.push(b"\n}\n".to_vec());

  Rendered { chunks }
}

/// A message's fields in the existing file other than `sourceCode`, e.g. `context`
/// and `maxChars`: `valueAtPath`, if it is an object.
fn hand_written_fields<'a>(existing: &'a Object, path: &[&[u8]]) -> OutObject<'a> {
  let mut entry = OutObject::default();

  let mut value: Option<&Object> = Some(existing);
  for key in path {
    value = value
      .and_then(|object| object.get(key))
      .and_then(Value::as_object);
  }

  let Some(object) = value else {
    return entry;
  };

  for (key, value) in object.members() {
    if &**key != b"sourceCode" {
      entry.insert(&**key, Out::Value(value));
    }
  }

  entry
}

fn write_member(out: &mut Vec<u8>, key: &[u8], value: &Out, source: &SourceCode, level: usize) {
  newline(out, level);
  write_string(out, key, false);
  out.extend_from_slice(b": ");
  write_out(out, value, source, level);
}

fn write_out(out: &mut Vec<u8>, value: &Out, source: &SourceCode, level: usize) {
  match value {
    Out::Value(value) => write_value(out, value, level),
    Out::Object(object) if object.is_empty() => out.extend_from_slice(b"{}"),
    Out::Object(object) => {
      out.push(b'{');
      for (position, member) in order(object).into_iter().enumerate() {
        if position > 0 {
          out.push(b',');
        }
        let (key, value) = &object.members()[member];
        write_member(out, key, value, source, level + 1);
      }
      newline(out, level);
      out.push(b'}');
    }
    Out::SourceCode(groups) => write_source_code(out, groups, source, level),
  }
}

/// `{ "src/a.ts": [{ "before": …, "target": …, "after": … }] }`
fn write_source_code(out: &mut Vec<u8>, groups: &[Group], source: &SourceCode, level: usize) {
  out.push(b'{');

  let order = js_order(groups.len(), |group| source.group(&groups[group]).0.name);
  for (position, group) in order.into_iter().enumerate() {
    if position > 0 {
      out.push(b',');
    }

    let (file, snippets) = source.group(&groups[group]);
    newline(out, level + 1);
    write_string(out, file.name, false);
    out.extend_from_slice(b": [");

    for (index, snippet) in snippets.iter().enumerate() {
      if index > 0 {
        out.push(b',');
      }
      newline(out, level + 2);
      out.push(b'{');
      for (name, span, comma) in [
        (&b"before"[..], snippet.before, true),
        (b"target", snippet.target, true),
        (b"after", snippet.after, false),
      ] {
        newline(out, level + 3);
        out.push(b'"');
        out.extend_from_slice(name);
        out.extend_from_slice(b"\": ");
        write_string(out, &file.code[span.start..span.end], true);
        if comma {
          out.push(b',');
        }
      }
      newline(out, level + 2);
      out.push(b'}');
    }

    newline(out, level + 1);
    out.push(b']');
  }

  newline(out, level);
  out.push(b'}');
}
