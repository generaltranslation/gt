//! A metadata file's content, shaped like its message file and written as
//! `JSON.stringify(metadata, null, 2)` writes it.

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

/// Writes a message file's metadata in order, as parts, holding only one batch of the top level's
/// members at a time.
pub fn render<E>(
  keys: &[MessageKey],
  existing: &Object,
  source: &SourceCode,
  emit: &mut dyn FnMut(&[u8]) -> Result<(), E>,
) -> Result<(), E> {
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
    return emit(NO_METADATA);
  }

  let order = order(&metadata);
  let batch = rayon::current_num_threads().max(1) * 4;

  emit(b"{")?;
  for (index, members) in order.chunks(batch).enumerate() {
    let rendered: Vec<Vec<u8>> = members
      .par_iter()
      .enumerate()
      .map(|(offset, &member)| {
        let mut out = Vec::new();
        if index + offset > 0 {
          out.push(b',');
        }
        let (key, value) = &metadata.members()[member];
        write_member(&mut out, key, value, source, 1);
        out
      })
      .collect();

    for part in &rendered {
      emit(part)?;
    }
  }
  emit(b"\n}\n")
}

/// The whole of `render`'s output.
pub fn render_to_vec(keys: &[MessageKey], existing: &Object, source: &SourceCode) -> Vec<u8> {
  let mut out = Vec::new();
  let _ = render::<std::convert::Infallible>(keys, existing, source, &mut |part| {
    out.extend_from_slice(part);
    Ok(())
  });

  out
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
