//! The metadata files: next to each message file, the source code around the
//! usages of each of its messages, which the gt CLI reads as `sourceCode`.
//!
//! JavaScript hands over what it knows of the projects (their message files and
//! keys); the files' code and usages stay here from the analysis. Each metadata
//! file is written as `JSON.stringify(metadata, null, 2)` would write it, and
//! only if its content changed.

pub mod json;
pub mod render;
pub mod snippets;

use std::{
  borrow::Cow,
  hash::{BuildHasher, Hasher},
  io::{self, Write},
  path::Path,
  sync::atomic::{AtomicU64, Ordering},
};

use rayon::prelude::*;
use rustc_hash::FxHashMap;

use self::{
  json::{KeyPaths, Value},
  render::{render, MessageKey, Rendered},
  snippets::{SourceCode, SourceFile},
};

/// A message file of an inlang project, and the metadata file it gets.
pub struct MessageFile<'a> {
  pub metadata: String,
  pub keys: Vec<MessageKey<'a>>,
}

pub struct Project<'a> {
  /// Project-relative: usages count for the project with this name.
  pub inlang_project: &'a [u8],
  pub message_files: Vec<MessageFile<'a>>,
}

/// Why a metadata file was left as it is.
#[derive(Debug)]
pub enum Skipped {
  /// It could not be read: it may hold fields written by hand.
  Unreadable(io::Error),
  /// It is not the JSON of an object.
  NotAnObject,
}

/// A failed system call.
#[derive(Debug)]
pub struct SystemError {
  pub error: io::Error,
  pub syscall: &'static str,
  pub path: Option<String>,
  pub dest: Option<String>,
}

/// Why the metadata could not be written.
#[derive(Debug)]
pub enum Failure {
  System(SystemError),
  /// A field written by hand nests deeper than `JSON.stringify` can write.
  TooDeep,
}

/// What metadata files are read and written with.
pub trait Files: Sync {
  fn read(&self, path: &Path) -> io::Result<Vec<u8>>;
  /// Writes a new file, or replaces one.
  fn write(&self, path: &Path, chunks: &[Vec<u8>]) -> Result<(), SystemError>;
  fn rename(&self, from: &Path, to: &Path) -> io::Result<()>;
  fn remove(&self, path: &Path) -> io::Result<()>;
}

/// The file system.
pub struct SystemFiles;

impl Files for SystemFiles {
  fn read(&self, path: &Path) -> io::Result<Vec<u8>> {
    std::fs::read(path)
  }

  fn write(&self, path: &Path, chunks: &[Vec<u8>]) -> Result<(), SystemError> {
    let failed = |syscall, error, path: Option<&Path>| SystemError {
      error,
      syscall,
      path: path.map(|path| path.to_string_lossy().into_owned()),
      dest: None,
    };

    let mut file =
      std::fs::File::create(path).map_err(|error| failed("open", error, Some(path)))?;
    for chunk in chunks {
      file
        .write_all(chunk)
        .map_err(|error| failed("write", error, None))?;
    }

    Ok(())
  }

  fn rename(&self, from: &Path, to: &Path) -> io::Result<()> {
    std::fs::rename(from, to)
  }

  fn remove(&self, path: &Path) -> io::Result<()> {
    std::fs::remove_file(path)
  }
}

/// What a metadata file that does not exist counts as, so that none is created
/// for nothing: what metadata with no member is written as.
const NO_METADATA: &[u8] = b"{}\n";

/// Writes the metadata files of `projects` whose content changed. Returns those it
/// had to leave as they are, in order. `sources` are the files with usages.
pub fn write_all(
  sources: &[SourceFile],
  projects: &[Project],
  radius: f64,
  files: &dyn Files,
) -> Result<Vec<(String, Skipped)>, Failure> {
  let mut skipped = Vec::new();

  for project in projects {
    let ids = message_ids(project);
    let source = SourceCode::collect(sources, project.inlang_project, &ids, radius);

    let results: Vec<Result<Option<Skipped>, Failure>> = project
      .message_files
      .par_iter()
      .map(|file| write_metadata(file, &source, files))
      .collect();

    for (file, result) in project.message_files.iter().zip(results) {
      if let Some(reason) = result? {
        skipped.push((file.metadata.clone(), reason));
      }
    }
  }

  Ok(skipped)
}

/// The ids of every message the project's files define, each once: `messageIds`.
fn message_ids<'a>(project: &Project<'a>) -> Vec<&'a [u8]> {
  project
    .message_files
    .iter()
    .flat_map(|file| file.keys.iter().map(|key| key.id))
    .collect()
}

/// The content of a metadata file; None if `existing` is not the JSON of an object.
pub fn render_file(
  keys: &[MessageKey],
  existing: &[u8],
  source: &SourceCode,
) -> Result<Option<Rendered>, Failure> {
  let mut paths = KeyPaths::default();
  for key in keys {
    paths.add(&key.path);
  }

  let Some((existing, too_deep)) = json::parse_object_along(existing, &paths) else {
    return Ok(None);
  };
  if too_deep {
    return Err(Failure::TooDeep);
  }

  Ok(Some(render(keys, &existing, source)))
}

/// Writes a metadata file if its content changed. Returns why it was skipped, if it was.
fn write_metadata(
  file: &MessageFile,
  source: &SourceCode,
  files: &dyn Files,
) -> Result<Option<Skipped>, Failure> {
  let path = Path::new(&file.metadata);

  let read = match files.read(path) {
    Ok(read) => read,
    Err(error) if error.kind() == io::ErrorKind::NotFound => NO_METADATA.to_vec(),
    // Overwriting it could lose fields written by hand.
    Err(error) => return Ok(Some(Skipped::Unreadable(error))),
  };
  // As JavaScript reads it: what is not UTF-8 is U+FFFD.
  let current: Cow<[u8]> = match String::from_utf8_lossy(&read) {
    Cow::Borrowed(_) => Cow::Borrowed(&read),
    Cow::Owned(text) => Cow::Owned(text.into_bytes()),
  };

  let Some(rendered) = render_file(&file.keys, &current, source)? else {
    return Ok(Some(Skipped::NotAnObject));
  };
  if rendered.equals(&current) {
    return Ok(None);
  }

  write_atomically(files, path, &rendered).map_err(Failure::System)?;
  Ok(None)
}

/// Writes `path` as a whole or not at all, for readers: a new file, renamed onto it.
pub fn write_atomically(
  files: &dyn Files,
  path: &Path,
  rendered: &Rendered,
) -> Result<(), SystemError> {
  // A unique name: other processes may write the same file.
  let temporary = format!(
    "{}.{}.{}.tmp",
    path.to_string_lossy(),
    std::process::id(),
    random_uuid()
  );
  let temporary = Path::new(&temporary);

  let written = files.write(temporary, &rendered.chunks).and_then(|()| {
    files.rename(temporary, path).map_err(|error| SystemError {
      error,
      syscall: "rename",
      path: Some(temporary.to_string_lossy().into_owned()),
      dest: Some(path.to_string_lossy().into_owned()),
    })
  });

  if written.is_err() {
    // The failed write is what is reported, not a failed cleanup.
    let _ = files.remove(temporary);
  }

  written
}

/// A version 4 UUID, as `crypto.randomUUID` makes.
fn random_uuid() -> String {
  static COUNTER: AtomicU64 = AtomicU64::new(0);

  let random = |salt: u64| {
    let mut hasher = std::hash::RandomState::new().build_hasher();
    hasher.write_u64(salt);
    hasher.write_u64(COUNTER.fetch_add(1, Ordering::Relaxed));
    hasher.write_u128(
      std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |time| time.as_nanos()),
    );
    hasher.finish()
  };

  let mut bytes = [0u8; 16];
  bytes[..8].copy_from_slice(&random(1).to_le_bytes());
  bytes[8..].copy_from_slice(&random(2).to_le_bytes());
  bytes[6] = (bytes[6] & 0x0F) | 0x40;
  bytes[8] = (bytes[8] & 0x3F) | 0x80;

  let hex: String = bytes.iter().map(|byte| format!("{byte:02x}")).collect();
  format!(
    "{}-{}-{}-{}-{}",
    &hex[..8],
    &hex[8..12],
    &hex[12..16],
    &hex[16..20],
    &hex[20..]
  )
}

// ---------------------------------------------------------------- input

/// The input is not what JavaScript writes.
#[derive(Debug)]
pub struct BadInput(pub &'static str);

/// The object JavaScript wrote as JSON.
pub fn input_object(input: &[u8]) -> Result<Value, BadInput> {
  json::parse(input)
    .filter(|value| value.as_object().is_some())
    .ok_or(BadInput("input"))
}

fn field<'v>(object: &'v json::Object, key: &'static str) -> Result<&'v Value, BadInput> {
  object.get(key.as_bytes()).ok_or(BadInput(key))
}

fn str_field<'v>(object: &'v json::Object, key: &'static str) -> Result<&'v [u8], BadInput> {
  field(object, key)?.as_str().ok_or(BadInput(key))
}

fn array_field<'v>(object: &'v json::Object, key: &'static str) -> Result<&'v [Value], BadInput> {
  field(object, key)?.as_array().ok_or(BadInput(key))
}

fn objects<'v>(
  values: &'v [Value],
  what: &'static str,
) -> impl Iterator<Item = Result<&'v json::Object, BadInput>> {
  values
    .iter()
    .map(move |value| value.as_object().ok_or(BadInput(what)))
}

fn strings<'v>(value: &'v Value, what: &'static str) -> Result<Vec<&'v [u8]>, BadInput> {
  value
    .as_array()
    .ok_or(BadInput(what))?
    .iter()
    .map(|item| item.as_str().ok_or(BadInput(what)))
    .collect()
}

/// `[[id, [key, …]], …]`
fn message_keys(value: &Value) -> Result<Vec<MessageKey<'_>>, BadInput> {
  value
    .as_array()
    .ok_or(BadInput("keys"))?
    .iter()
    .map(|key| match key.as_array() {
      Some([id, path]) => Ok(MessageKey {
        id: id.as_str().ok_or(BadInput("keys"))?,
        path: strings(path, "keys")?,
      }),
      _ => Err(BadInput("keys")),
    })
    .collect()
}

/// `[{ "inlangProject", "messageFiles": [{ "metadata", "keys" }] }]`
fn projects(values: &[Value]) -> Result<Vec<Project<'_>>, BadInput> {
  objects(values, "projects")
    .map(|project| {
      let project = project?;
      let message_files = objects(array_field(project, "messageFiles")?, "messageFiles")
        .map(|file| {
          let file = file?;
          Ok(MessageFile {
            metadata: String::from_utf8_lossy(str_field(file, "metadata")?).into_owned(),
            keys: message_keys(field(file, "keys")?)?,
          })
        })
        .collect::<Result<_, _>>()?;

      Ok(Project {
        inlang_project: str_field(project, "inlangProject")?,
        message_files,
      })
    })
    .collect()
}

/// What JavaScript gives `writeMetadata`: `MetadataInput` (`src/compiler/output/metadata.ts`).
pub struct WriteInput<'a> {
  /// The analyzed files with usages, absolute, and how the metadata names each.
  pub files: Vec<(&'a [u8], &'a [u8])>,
  /// By message file that usages resolve to: the inlang project its usages count for.
  pub target_projects: FxHashMap<&'a [u8], &'a [u8]>,
  pub projects: Vec<Project<'a>>,
}

/// `{ files, names, targets, targetProjects, projects }`, which `input_object` parsed.
pub fn write_input(input: &Value) -> Result<WriteInput<'_>, BadInput> {
  let input = input.as_object().ok_or(BadInput("input"))?;
  let list = |key: &'static str| strings(field(input, key)?, key);

  Ok(WriteInput {
    files: list("files")?.into_iter().zip(list("names")?).collect(),
    target_projects: list("targets")?
      .into_iter()
      .zip(list("targetProjects")?)
      .collect(),
    projects: projects(array_field(input, "projects")?)?,
  })
}

/// For tests, and for JavaScript's: `{ "inlangProject", "keys", "existing", "sources": [{ "file",
/// "code", "usages": [{ "name", "dynamic", "start", "end", "line", "endLine", "inlangProject" }] }] }`.
/// The content a message file's metadata file gets; None if `existing` is not the JSON of an object.
pub fn render_input(
  input: &[u8],
  radius: f64,
) -> Result<Result<Option<Vec<u8>>, Failure>, BadInput> {
  let input = input_object(input)?;
  let input = input.as_object().ok_or(BadInput("input"))?;

  let inlang_project = str_field(input, "inlangProject")?;
  let keys = message_keys(field(input, "keys")?)?;
  let existing = str_field(input, "existing")?;
  let sources = objects(array_field(input, "sources")?, "sources")
    .map(|source| source_file(source?))
    .collect::<Result<Vec<_>, _>>()?;

  let ids: Vec<&[u8]> = keys.iter().map(|key| key.id).collect();
  let source = SourceCode::collect(&sources, inlang_project, &ids, radius);

  Ok(render_file(&keys, existing, &source).map(|rendered| rendered.map(Rendered::into_bytes)))
}

fn source_file(source: &json::Object) -> Result<SourceFile<'_>, BadInput> {
  let number = |usage: &json::Object, key: &'static str| -> Result<f64, BadInput> {
    field(usage, key)?.as_f64().ok_or(BadInput(key))
  };

  let usages = objects(array_field(source, "usages")?, "usages")
    .map(|usage| {
      let usage = usage?;
      Ok(snippets::SourceUsage {
        name: str_field(usage, "name")?,
        dynamic: usage.get(b"dynamic").is_some_and(Value::is_true),
        start: number(usage, "start")?,
        end: number(usage, "end")?,
        line: number(usage, "line")?,
        end_line: number(usage, "endLine")?,
        project: usage.get(b"inlangProject").and_then(Value::as_str),
      })
    })
    .collect::<Result<_, _>>()?;

  Ok(SourceFile {
    name: str_field(source, "file")?,
    code: str_field(source, "code")?,
    usages,
  })
}

#[cfg(test)]
mod tests;
