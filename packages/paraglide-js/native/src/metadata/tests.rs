use std::{
  collections::BTreeMap,
  io,
  path::{Path, PathBuf},
  sync::{
    atomic::{AtomicU32, Ordering},
    Mutex,
  },
};

use super::{
  snippets::{tests::usage, SourceFile, SourceUsage},
  *,
};

const PROJECT: &[u8] = b"project.inlang";
const CODE: &[u8] = b"one\ntwo\nthree\nfour";

fn key<'a>(id: &'a str, path: &[&'a str]) -> MessageKey<'a> {
  MessageKey {
    id: id.as_bytes(),
    path: path.iter().map(|key| key.as_bytes()).collect(),
  }
}

fn flat(id: &str) -> MessageKey<'_> {
  key(id, &[id])
}

fn source<'a>(name: &'a str, usages: Vec<SourceUsage<'a>>) -> SourceFile<'a> {
  SourceFile {
    name: name.as_bytes(),
    code: CODE,
    usages,
  }
}

/// The content of the metadata file, or None if `existing` is not an object.
fn rendered(
  keys: &[MessageKey],
  sources: &[SourceFile],
  existing: &str,
  radius: f64,
) -> Option<String> {
  let ids: Vec<&[u8]> = keys.iter().map(|key| key.id).collect();
  let source = SourceCode::collect(sources, PROJECT, &ids, radius);
  let rendered = render_file(keys, existing.as_bytes(), &source).ok()??;
  String::from_utf8(rendered).ok()
}

/// As `rendered`, without the indent.
fn compact(keys: &[MessageKey], sources: &[SourceFile], existing: &str) -> String {
  rendered(keys, sources, existing, 1.0)
    .unwrap_or_default()
    .split('\n')
    .map(str::trim_start)
    .collect::<Vec<_>>()
    .join("")
    .replace("\": ", "\":")
}

const A1: &str = r#"{"src/a.ts":[{"before":"","target":"one","after":"two"}]}"#;

#[test]
fn each_used_message_gets_the_lines_around_its_usages_by_source_file() {
  let keys = [flat("save"), flat("unused"), flat("cancel")];
  let sources = [
    source("src/b.ts", vec![usage("save", 4)]),
    source("src/a.ts", vec![usage("cancel", 1), usage("save", 2)]),
  ];

  // In the message file's order; source files sorted.
  assert_eq!(
    compact(&keys, &sources, "{}"),
    concat!(
      r#"{"save":{"sourceCode":{"src/a.ts":[{"before":"one","target":"two","after":"three"}],"#,
      r#""src/b.ts":[{"before":"three","target":"four","after":""}]}},"#,
      r#""cancel":{"sourceCode":{"src/a.ts":[{"before":"","target":"one","after":"two"}]}}}"#
    )
  );
}

#[test]
fn is_written_as_json_stringify_writes_it() {
  let keys = [flat("save")];
  let sources = [source("src/a.ts", vec![usage("save", 2)])];
  assert_eq!(
    rendered(
      &keys,
      &sources,
      r#"{"save": {"context": "A \"button\"", "n": [1, {}]}}"#,
      1.0
    )
    .as_deref(),
    Some(concat!(
      "{\n",
      "  \"save\": {\n",
      "    \"context\": \"A \\\"button\\\"\",\n",
      "    \"n\": [\n",
      "      1,\n",
      "      {}\n",
      "    ],\n",
      "    \"sourceCode\": {\n",
      "      \"src/a.ts\": [\n",
      "        {\n",
      "          \"before\": \"one\",\n",
      "          \"target\": \"two\",\n",
      "          \"after\": \"three\"\n",
      "        }\n",
      "      ]\n",
      "    }\n",
      "  }\n",
      "}\n",
    ))
  );
  assert_eq!(rendered(&keys, &[], "{}", 1.0).as_deref(), Some("{}\n"));
}

#[test]
fn the_metadata_is_nested_like_the_message_file() {
  let keys = [key("nav.home", &["nav", "home"]), key("a.b", &["a.b"])];
  let sources = [source(
    "src/a.ts",
    vec![usage("nav.home", 1), usage("a.b", 1)],
  )];
  assert_eq!(
    compact(&keys, &sources, "{}"),
    format!(r#"{{"nav":{{"home":{{"sourceCode":{A1}}}}},"a.b":{{"sourceCode":{A1}}}}}"#)
  );
}

#[test]
fn a_key_named_proto_is_a_key_like_any_other() {
  let sources = [source(
    "src/a.ts",
    vec![usage("__proto__", 1), usage("__proto__.home", 1)],
  )];
  assert_eq!(
    compact(&[flat("__proto__")], &sources, "{}"),
    format!(r#"{{"__proto__":{{"sourceCode":{A1}}}}}"#)
  );
  assert_eq!(
    compact(
      &[key("__proto__.home", &["__proto__", "home"])],
      &sources,
      r#"{ "__proto__": { "home": { "context": "The start page" } } }"#
    ),
    format!(r#"{{"__proto__":{{"home":{{"context":"The start page","sourceCode":{A1}}}}}}}"#)
  );
}

#[test]
fn messages_the_file_does_not_define_and_other_projects_usages_are_left_out() {
  let sources = [source(
    "src/a.ts",
    vec![
      usage("elsewhere", 1),
      SourceUsage {
        project: Some(b"admin.inlang"),
        ..usage("save", 2)
      },
      SourceUsage {
        project: None,
        ..usage("save", 3)
      },
    ],
  )];
  assert_eq!(compact(&[flat("save")], &sources, "{}"), "{}");
}

#[test]
fn hand_written_fields_are_kept_but_not_sourcecode_nor_removed_messages() {
  let existing = r#"{
    "save": { "context": "A button", "maxChars": 10, "sourceCode": { "src/old.ts": [] } },
    "unused": { "context": "Not used yet", "sourceCode": { "src/old.ts": [] } },
    "removed": { "context": "No longer a message" },
    "nav": { "home": { "maxChars": 20 } }
  }"#;
  let keys = [
    flat("save"),
    flat("unused"),
    key("nav.home", &["nav", "home"]),
  ];
  let sources = [source("src/a.ts", vec![usage("save", 1)])];
  assert_eq!(
    compact(&keys, &sources, existing),
    format!(
      r#"{{"save":{{"context":"A button","maxChars":10,"sourceCode":{A1}}},"unused":{{"context":"Not used yet"}},"nav":{{"home":{{"maxChars":20}}}}}}"#
    )
  );
}

#[test]
fn keys_are_in_javascripts_order() {
  // Array indexes first, ascending; a message's own fields before its snippets.
  let keys = [flat("b"), flat("10"), flat("2")];
  let sources = [source(
    "src/a.ts",
    vec![usage("b", 1), usage("10", 1), usage("2", 1)],
  )];
  let existing = r#"{"b": {"z": 1, "1": 2, "a": 3}, "2": {"x": null}}"#;
  assert_eq!(
    compact(&keys, &sources, existing),
    format!(
      r#"{{"2":{{"x":null,"sourceCode":{A1}}},"10":{{"sourceCode":{A1}}},"b":{{"1":2,"z":1,"a":3,"sourceCode":{A1}}}}}"#
    )
  );
}

#[test]
fn a_dynamic_name_goes_to_every_message_it_matches_and_star_alone_to_none() {
  let dynamic = |name, line| SourceUsage {
    dynamic: true,
    ..usage(name, line)
  };
  let keys = [flat("error_404"), flat("error_500"), flat("save")];
  let sources = [source(
    "src/a.ts",
    vec![dynamic("error_*", 1), dynamic("*", 2)],
  )];
  assert_eq!(
    compact(&keys, &sources, "{}"),
    format!(r#"{{"error_404":{{"sourceCode":{A1}}},"error_500":{{"sourceCode":{A1}}}}}"#)
  );
}

#[test]
fn what_is_not_a_json_object_is_not_rendered() {
  for existing in ["", "[]", "null", "{", "\u{feff}{}", "{} x", "\"{}\""] {
    assert_eq!(
      rendered(&[flat("save")], &[], existing, 1.0),
      None,
      "{existing:?}"
    );
  }
}

#[test]
fn a_hand_written_field_too_deep_for_javascript_fails_the_write() {
  let deep = format!(
    r#"{{"save": {{"context": {}{}}}}}"#,
    "[".repeat(json::MAX_DEPTH),
    "]".repeat(json::MAX_DEPTH)
  );
  let source = SourceCode::collect(&[], PROJECT, &[b"save"], 1.0);
  assert!(matches!(
    render_file(&[flat("save")], deep.as_bytes(), &source),
    Err(Failure::TooDeep)
  ));

  // Deep where it is not kept, or not JSON.
  let skipped = format!(
    r#"{{"other": {}{}, "save": {{}}}}"#,
    "[".repeat(100_000),
    "]".repeat(100_000)
  );
  assert!(matches!(
    render_file(&[flat("save")], skipped.as_bytes(), &source),
    Ok(Some(_))
  ));
  assert!(matches!(
    render_file(&[flat("save")], format!("{deep}]").as_bytes(), &source),
    Ok(None)
  ));
}

// ---------------------------------------------------------------- writing

/// Files in memory, whose writes and renames can be made to fail.
#[derive(Default)]
struct MemoryFiles {
  files: Mutex<BTreeMap<PathBuf, Vec<u8>>>,
  unreadable: Vec<PathBuf>,
  /// The write leaves what it wrote of this many bytes, then fails.
  partial_write: Option<usize>,
  fail_rename: bool,
  writes: AtomicU32,
}

impl MemoryFiles {
  fn with(files: &[(&str, &[u8])]) -> Self {
    MemoryFiles {
      files: Mutex::new(
        files
          .iter()
          .map(|(path, content)| (PathBuf::from(path), content.to_vec()))
          .collect(),
      ),
      ..MemoryFiles::default()
    }
  }

  fn writes(&self) -> u32 {
    self.writes.load(Ordering::Relaxed)
  }

  fn listing(&self) -> Vec<String> {
    self
      .files
      .lock()
      .map(|files| {
        files
          .keys()
          .map(|path| path.display().to_string())
          .collect()
      })
      .unwrap_or_default()
  }

  fn content(&self, path: &str) -> Option<String> {
    let files = self.files.lock().ok()?;
    files
      .get(Path::new(path))
      .map(|content| String::from_utf8_lossy(content).into_owned())
  }
}

fn error(kind: io::ErrorKind) -> io::Error {
  io::Error::from(kind)
}

impl Files for MemoryFiles {
  fn read(&self, path: &Path) -> io::Result<Contents> {
    if self.unreadable.iter().any(|unreadable| unreadable == path) {
      return Err(error(io::ErrorKind::PermissionDenied));
    }
    let files = self.files.lock().map_err(|_| error(io::ErrorKind::Other))?;
    files
      .get(path)
      .cloned()
      .map(Contents::Owned)
      .ok_or(error(io::ErrorKind::NotFound))
  }

  fn create(&self, path: &Path) -> Result<Box<dyn Output + '_>, SystemError> {
    self.writes.fetch_add(1, Ordering::Relaxed);
    if let Ok(mut files) = self.files.lock() {
      files.insert(path.to_path_buf(), Vec::new());
    }

    Ok(Box::new(MemoryOutput {
      files: self,
      path: path.to_path_buf(),
      content: Vec::new(),
    }))
  }

  fn rename(&self, from: &Path, to: &Path) -> io::Result<()> {
    if self.fail_rename {
      return Err(error(io::ErrorKind::CrossesDevices));
    }
    let mut files = self.files.lock().map_err(|_| error(io::ErrorKind::Other))?;
    let content = files.remove(from).ok_or(error(io::ErrorKind::NotFound))?;
    files.insert(to.to_path_buf(), content);
    Ok(())
  }

  fn remove(&self, path: &Path) -> io::Result<()> {
    let mut files = self.files.lock().map_err(|_| error(io::ErrorKind::Other))?;
    files
      .remove(path)
      .map(|_| ())
      .ok_or(error(io::ErrorKind::NotFound))
  }
}

/// A file of `MemoryFiles` being written: it fails past `partial_write` bytes, leaving those.
struct MemoryOutput<'f> {
  files: &'f MemoryFiles,
  path: PathBuf,
  content: Vec<u8>,
}

impl MemoryOutput<'_> {
  fn store(&self) {
    if let Ok(mut files) = self.files.files.lock() {
      files.insert(self.path.clone(), self.content.clone());
    }
  }
}

impl Output for MemoryOutput<'_> {
  fn write(&mut self, bytes: &[u8]) -> Result<(), SystemError> {
    self.content.extend_from_slice(bytes);

    if let Some(length) = self
      .files
      .partial_write
      .filter(|&length| self.content.len() > length)
    {
      self.content.truncate(length);
      self.store();
      return Err(SystemError {
        error: error(io::ErrorKind::StorageFull),
        syscall: "write",
        path: None,
        dest: None,
      });
    }

    Ok(())
  }

  fn finish(self: Box<Self>) -> Result<(), SystemError> {
    self.store();
    Ok(())
  }
}

fn project<'a>(inlang_project: &'a [u8], files: Vec<(&str, Vec<MessageKey<'a>>)>) -> Project<'a> {
  Project {
    inlang_project,
    message_files: files
      .into_iter()
      .map(|(metadata, keys)| MessageFile {
        metadata: metadata.to_string(),
        keys,
      })
      .collect(),
  }
}

#[test]
fn writes_each_message_files_metadata_and_no_temporary_file() {
  let files = MemoryFiles::default();
  let sources = [
    source("a.ts", vec![usage("greeting", 1)]),
    source("b.ts", vec![usage("login", 2)]),
  ];
  let projects = [project(
    PROJECT,
    vec![
      ("/m/common.metadata.json", vec![flat("greeting")]),
      ("/m/auth.metadata.json", vec![flat("login")]),
      ("/m/unused.metadata.json", vec![flat("other")]),
    ],
  )];

  assert!(write_all(&sources, &projects, 0.0, &files).is_ok_and(|skipped| skipped.is_empty()));
  // None is created for no usages.
  assert_eq!(
    files.listing(),
    ["/m/auth.metadata.json", "/m/common.metadata.json"]
  );
  assert!(files
    .content("/m/common.metadata.json")
    .is_some_and(|content| content.contains("\"a.ts\"") && !content.contains("b.ts")));
}

#[test]
fn an_unchanged_file_is_not_written_again() {
  let files = MemoryFiles::default();
  let sources = [source("a.ts", vec![usage("greeting", 1)])];
  let projects = [project(
    PROJECT,
    vec![("/m/en.metadata.json", vec![flat("greeting")])],
  )];

  assert!(write_all(&sources, &projects, 1.0, &files).is_ok());
  assert!(write_all(&sources, &projects, 1.0, &files).is_ok());
  assert_eq!(files.writes(), 1);

  // Another radius changes it.
  assert!(write_all(&sources, &projects, 2.0, &files).is_ok());
  assert_eq!(files.writes(), 2);
}

#[test]
fn a_file_that_differs_anywhere_is_written_whole_from_its_parts() {
  // More members than a batch renders at once, each used on a line: `moved` uses one elsewhere.
  let names: Vec<String> = (0..501)
    .map(|index| format!("message_{index:03}"))
    .collect();
  let render_with = |count: usize, moved: Option<usize>| {
    let keys: Vec<MessageKey> = names[..count].iter().map(|name| flat(name)).collect();
    let usages: Vec<SourceUsage> = names[..count]
      .iter()
      .enumerate()
      .map(|(index, name)| usage(name, if moved == Some(index) { 4 } else { 1 }))
      .collect();
    let sources = [source("a.ts", usages)];
    let ids: Vec<&[u8]> = keys.iter().map(|key| key.id).collect();
    let source = SourceCode::collect(&sources, PROJECT, &ids, 0.0);

    render_file(&keys, b"{}", &source)
      .ok()
      .flatten()
      .unwrap_or_default()
  };

  let expected = render_with(500, None);
  assert!(expected.len() > 50_000);
  let cases = [
    ("the same", expected.clone()),
    ("the first message differs", render_with(500, Some(0))),
    ("the last message differs", render_with(500, Some(499))),
    ("one message more", render_with(501, None)),
    ("one message less", render_with(499, None)),
    (
      "the same, then spaces",
      [expected.as_slice(), b"  "].concat(),
    ),
  ];

  let keys: Vec<MessageKey> = names[..500].iter().map(|name| flat(name)).collect();
  let usages: Vec<SourceUsage> = names[..500].iter().map(|name| usage(name, 1)).collect();
  let sources = [source("a.ts", usages)];
  for (case, existing) in cases {
    let files = MemoryFiles::with(&[("/m/en.metadata.json", &existing)]);
    let projects = [Project {
      inlang_project: PROJECT,
      message_files: vec![MessageFile {
        metadata: "/m/en.metadata.json".to_string(),
        keys: keys
          .iter()
          .map(|key| MessageKey {
            id: key.id,
            path: key.path.clone(),
          })
          .collect(),
      }],
    }];

    let written = write_all(&sources, &projects, 0.0, &files);
    assert!(written.is_ok_and(|skipped| skipped.is_empty()), "{case}");
    assert_eq!(files.writes(), u32::from(case != "the same"), "{case}");
    assert_eq!(files.listing(), ["/m/en.metadata.json"], "{case}");
    assert_eq!(
      files.content("/m/en.metadata.json").map(String::into_bytes),
      Some(expected.clone()),
      "{case}"
    );
  }
}

#[test]
fn a_file_that_is_not_utf8_is_compared_as_javascript_reads_it() {
  // A byte that is not UTF-8 reads as U+FFFD, which is what is written back.
  let files = MemoryFiles::with(&[(
    "/m/en.metadata.json",
    b"{\n  \"greeting\": {\n    \"context\": \"\xff\"\n  }\n}\n",
  )]);
  let projects = [project(
    PROJECT,
    vec![("/m/en.metadata.json", vec![flat("greeting")])],
  )];

  assert!(write_all(&[], &projects, 1.0, &files).is_ok());
  assert_eq!(files.writes(), 0);
}

#[test]
fn files_that_cannot_be_read_or_are_not_objects_are_left_alone() {
  let mut files = MemoryFiles::with(&[
    (
      "/m/invalid.metadata.json",
      b"{ \"greeting\": { \"context\": \"mid-edit\" ",
    ),
    ("/m/bom.metadata.json", b"\xef\xbb\xbf{}"),
    ("/m/locked.metadata.json", b"{}"),
  ]);
  files.unreadable = vec![PathBuf::from("/m/locked.metadata.json")];
  let sources = [source("a.ts", vec![usage("greeting", 1)])];
  let keys = || vec![flat("greeting")];
  let projects = [project(
    PROJECT,
    vec![
      ("/m/invalid.metadata.json", keys()),
      ("/m/locked.metadata.json", keys()),
      ("/m/bom.metadata.json", keys()),
      ("/m/new.metadata.json", keys()),
    ],
  )];

  let skipped = write_all(&sources, &projects, 1.0, &files).unwrap_or_default();
  let skipped: Vec<(&str, bool)> = skipped
    .iter()
    .map(|(file, reason)| (file.as_str(), matches!(reason, Skipped::Unreadable(_))))
    .collect();
  assert_eq!(
    skipped,
    [
      ("/m/invalid.metadata.json", false),
      ("/m/locked.metadata.json", true),
      ("/m/bom.metadata.json", false),
    ]
  );
  assert_eq!(
    files.content("/m/invalid.metadata.json").as_deref(),
    Some("{ \"greeting\": { \"context\": \"mid-edit\" ")
  );
  assert!(files.content("/m/new.metadata.json").is_some());
}

#[test]
fn a_rename_that_fails_leaves_no_temporary_file() {
  let mut files = MemoryFiles::with(&[("/m/en.metadata.json", b"{}\n")]);
  files.fail_rename = true;
  let sources = [source("a.ts", vec![usage("greeting", 1)])];
  let projects = [project(
    PROJECT,
    vec![("/m/en.metadata.json", vec![flat("greeting")])],
  )];

  let Err(Failure::System(failure)) = write_all(&sources, &projects, 1.0, &files) else {
    panic!("the write did not fail");
  };
  assert_eq!(failure.error.kind(), io::ErrorKind::CrossesDevices);
  assert_eq!(failure.syscall, "rename");
  assert_eq!(failure.dest.as_deref(), Some("/m/en.metadata.json"));
  assert!(failure.path.is_some_and(|path| path
    .starts_with(&format!("/m/en.metadata.json.{}.", std::process::id()))
    && path.ends_with(".tmp")));
  assert_eq!(files.listing(), ["/m/en.metadata.json"]);
  assert_eq!(
    files.content("/m/en.metadata.json").as_deref(),
    Some("{}\n")
  );

  // A later write is not affected.
  files.fail_rename = false;
  assert!(write_all(&sources, &projects, 1.0, &files).is_ok());
  assert_eq!(files.listing(), ["/m/en.metadata.json"]);
}

#[test]
fn a_temporary_file_that_was_only_partly_written_is_removed() {
  let mut files = MemoryFiles {
    partial_write: Some(10),
    ..MemoryFiles::default()
  };
  let sources = [source("a.ts", vec![usage("greeting", 1)])];
  let projects = [project(
    PROJECT,
    vec![("/m/en.metadata.json", vec![flat("greeting")])],
  )];

  let Err(Failure::System(failure)) = write_all(&sources, &projects, 1.0, &files) else {
    panic!("the write did not fail");
  };
  assert_eq!(failure.error.kind(), io::ErrorKind::StorageFull);
  assert!(files.listing().is_empty());

  files.partial_write = None;
  assert!(write_all(&sources, &projects, 1.0, &files).is_ok());
  assert_eq!(files.listing(), ["/m/en.metadata.json"]);
}

#[test]
fn temporary_names_are_unique() {
  let names: std::collections::HashSet<String> = (0..1000).map(|_| random_uuid()).collect();
  assert_eq!(names.len(), 1000);
  for name in &names {
    assert_eq!(name.len(), 36);
    assert_eq!(&name[14..15], "4");
    assert!("89ab".contains(&name[19..20]));
  }
}

#[test]
fn system_files_write_and_rename() {
  let root = std::env::temp_dir().join(format!("metadata-files-{}", std::process::id()));
  let _ = std::fs::remove_dir_all(&root);
  let _ = std::fs::create_dir_all(&root);
  let file = root.join("en.metadata.json");

  let rendered: [&[u8]; 2] = [b"{", b"}\n"];
  assert!(write_atomically(&SystemFiles, &file, &rendered).is_ok());
  assert_eq!(std::fs::read_to_string(&file).ok().as_deref(), Some("{}\n"));

  // Into a directory that does not exist: the temporary file cannot be made.
  let missing = root.join("missing/en.metadata.json");
  let failure = write_atomically(&SystemFiles, &missing, &rendered).err();
  assert!(failure.is_some_and(
    |failure| failure.syscall == "open" && failure.error.kind() == io::ErrorKind::NotFound
  ));

  let listed: Vec<_> = std::fs::read_dir(&root)
    .map(|entries| entries.flatten().map(|entry| entry.file_name()).collect())
    .unwrap_or_default();
  assert_eq!(listed, ["en.metadata.json"]);

  let _ = std::fs::remove_dir_all(&root);
}

#[test]
fn renders_the_input_javascript_gives() {
  let input = br#"{
    "inlangProject": "project.inlang",
    "keys": [["save", ["save"]], ["nav.home", ["nav", "home"]]],
    "existing": "{\"nav\": {\"home\": {\"context\": \"\\ud800\"}}}",
    "sources": [{ "file": "src/a.ts", "code": "one\r\ntwo\nthree", "usages": [
      { "name": "save", "dynamic": false, "start": 4, "end": 9, "line": 2, "column": 1, "endLine": 2,
        "inlangProject": "project.inlang", "kind": "call", "target": "message", "targetFile": "x" },
      { "name": "nav.*", "dynamic": true, "start": 0, "end": 3, "line": 1, "column": 1, "endLine": 1,
        "inlangProject": "project.inlang" }
    ]}]
  }"#;

  let written = render_input(input, 1.0)
    .ok()
    .and_then(Result::ok)
    .flatten()
    .and_then(|bytes| String::from_utf8(bytes).ok());
  let written = written.unwrap_or_default();
  assert!(written.contains(r#""before": "one","#), "{written}");
  assert!(written.contains(r#""context": "\ud800","#), "{written}");
  assert!(written.starts_with("{\n  \"save\""), "{written}");

  assert!(matches!(render_input(b"{}", 1.0), Err(BadInput(_))));
  assert!(matches!(render_input(b"[", 1.0), Err(BadInput(_))));
}
