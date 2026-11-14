use std::sync::{mpsc, Arc, Mutex, MutexGuard};

use napi::{bindgen_prelude::*, Env, Task};
use napi_derive::napi;
use rayon::prelude::*;
use rustc_hash::{FxHashMap, FxHashSet};
use serde::Serialize;

use crate::{
  analyze::{analyze_file, Usage},
  eval::{CustomSymbol, CustomTargets},
  graph::{
    ComponentFields, ComponentInstances, FileId, Graph, GraphOptions, InstantiationSyntax,
    PropsReads, Target, TargetKind,
  },
  languages::{Language, NativeLanguages},
  load::{
    link, link_with, load, unlinked, Claims, DetectedExtension, GeneratedCode, GeneratedSource,
    Input, LoadResult, Prefetch, Request, Unresolved,
  },
  lower::Lang,
  mapping::Mapping,
  metadata::{self, snippets::SourceFile, Failure, Skipped, SystemError, SystemFiles},
  resolve::{ImportAlias, NativeResolver, ResolverOptions},
};

#[napi(object)]
pub struct NativeTarget {
  pub name: String,
  /// "messages" or "custom".
  pub kind: String,
}

#[napi(object)]
pub struct NativeAlias {
  pub find: String,
  pub replacement: String,
  pub exact: Option<bool>,
}

#[napi(object)]
pub struct NativeResolverOptions {
  pub aliases: Vec<NativeAlias>,
  pub root_directory: Option<String>,
  pub conditions: Vec<String>,
  pub builtins: Vec<String>,
  /// Some aliases are regular expressions: JavaScript applies them.
  pub aliases_in_js: bool,
  /// The names of the directories whose files' unresolved imports are not reported.
  pub ignored_directories: Vec<String>,
}

#[napi(object)]
pub struct NativeDetect {
  pub extension: String,
  pub hints: Vec<String>,
}

#[napi(object)]
pub struct NativeGraphOptions {
  pub targets: Vec<NativeTarget>,
  pub outdirs: Vec<String>,
  pub source_extensions: Vec<String>,
  pub detect: Vec<NativeDetect>,
  /// Without one, JavaScript resolves the imports.
  pub resolver: Option<NativeResolverOptions>,
  /// The code JavaScript gives is the files' on disk, read again when needed rather than kept.
  pub sources_on_disk: Option<bool>,
  /// The built-in languages whose files are written here, by name, in the order they claim files.
  /// Those `nativeLanguages()` does not list are left to JavaScript's tooling.
  pub native_languages: Option<Vec<String>>,
}

#[napi(object)]
pub struct NativeGeneratedCode {
  pub code: String,
  pub lang: String,
  /// `generated, source, length, sourceLength` of each mapping.
  pub mappings: Int32Array,
}

#[napi(object)]
pub struct NativeComponentFields {
  pub specifier: String,
  pub class_name: Option<String>,
  pub start: Option<i32>,
  pub end: Option<i32>,
}

#[napi(object)]
pub struct NativePropsReads {
  pub calls: Option<Vec<String>>,
  pub members: Option<Vec<String>>,
  pub variables: Option<Vec<i32>>,
  pub undeclared: Option<bool>,
}

#[napi(object)]
pub struct NativeComponentInstances {
  pub via: String,
  pub path: Vec<String>,
}

#[napi(object)]
pub struct NativeGeneratedSource {
  pub main: NativeGeneratedCode,
  pub scripts: Vec<NativeGeneratedCode>,
  pub language: String,
  pub component_fields: Option<Vec<NativeComponentFields>>,
  pub scope_objects: Option<Vec<String>>,
  pub props: Option<NativePropsReads>,
  pub component_instances: Option<NativeComponentInstances>,
}

#[napi(object)]
pub struct NativeSkipped {
  pub file: String,
  pub error: String,
}

#[napi(object)]
pub struct NativeLoadResult {
  /// Files a language may claim: JavaScript loads them.
  pub needs_js: Vec<String>,
  pub skipped: Vec<NativeSkipped>,
  /// The specifiers JavaScript's aliases are asked about.
  pub alias_queries: Vec<String>,
}

#[napi(object)]
pub struct NativePending {
  pub importers: Vec<String>,
  /// How many of `specifiers` each importer has.
  pub counts: Vec<u32>,
  pub specifiers: Vec<String>,
}

#[napi(object)]
pub struct NativeTargetFile {
  /// As the graph knows the file.
  pub path: String,
  /// Absolute, with forward slashes.
  pub file: String,
  pub outdir: Option<String>,
  pub outdir_path: Option<String>,
}

#[napi(object)]
pub struct NativeGlobal {
  pub name: String,
  pub file: String,
  pub export_name: String,
}

#[napi(object)]
pub struct NativeCustomSymbol {
  /// "value" or "namespace".
  pub kind: String,
  pub name: Option<String>,
  pub methods: Option<Vec<String>>,
}

#[napi(object)]
pub struct NativeAnalysis {
  /// The analyzed files that have usages, whose code and usages are kept for `writeMetadata`.
  pub files: Vec<String>,
  /// How many usages each has.
  pub counts: Vec<u32>,
  /// The usages of each as a JSON list, one text per file so that a project's usages are not
  /// limited by the length of one JavaScript string.
  pub usages: Vec<String>,
  /// The files that the usages' `targetFile` name by index.
  pub paths: Vec<String>,
  /// The files that changed on disk since they were loaded, whose usages are left out.
  pub changed: Vec<String>,
}

#[napi(object)]
pub struct NativeStats {
  pub modules: u32,
  pub files: u32,
  pub nodes: f64,
  pub tree_bytes: f64,
}

struct Recorded {
  source: Arc<crate::graph::SourceFile>,
  /// Each one's `target_file` is its file's number in `State::targets`, since file ids do not
  /// outlive `release`.
  usages: Vec<Usage>,
}

/// Target files numbered in the order they are first named, which unlike file ids outlive
/// `release`.
#[derive(Default)]
struct TargetFiles {
  paths: Vec<String>,
  numbers: FxHashMap<Box<str>, u32>,
}

impl TargetFiles {
  fn number(&mut self, path: &str) -> u32 {
    if let Some(&number) = self.numbers.get(path) {
      return number;
    }

    let number = self.paths.len() as u32;
    self.paths.push(path.to_string());
    self.numbers.insert(path.into(), number);
    number
  }
}

struct State {
  graph: Graph,
  /// The analyzed files with usages, by path; a later analysis replaces a file's.
  recorded: FxHashMap<Box<str>, Recorded>,
  targets: TargetFiles,
  resolver: Option<NativeResolver>,
  ignored_directories: FxHashSet<String>,
  claims: Arc<Claims>,
  /// What JavaScript read or generated, until the next load parses it.
  queue: Vec<Request>,
}

#[napi]
pub struct NativeGraph {
  state: Arc<Mutex<State>>,
  /// Apart from the state: files are prefetched while a load holds it.
  prefetch: Arc<Prefetch>,
}

/// Deeply nested code is read by functions that call themselves, which need a large stack.
const WORKER_STACK_BYTES: usize = 16 << 20;

fn start_workers() {
  static STARTED: std::sync::Once = std::sync::Once::new();

  STARTED.call_once(|| {
    let mut builder = rayon::ThreadPoolBuilder::new().stack_size(WORKER_STACK_BYTES);
    // The analysis never runs on the main thread: `0` is as few threads as it can, one.
    let configured = std::env::var("PARAGLIDE_CONTEXT_THREADS").ok();
    if let Some(threads) = configured.as_deref().and_then(crate::configured_threads) {
      builder = builder.num_threads(threads.max(1));
    }

    // If another addon set the pool up first, its threads are used as they are.
    let _ = builder.build_global();
  });
}

/// A panic in `work` becomes an error in JavaScript instead of ending the process.
fn guarded<T>(work: impl FnOnce() -> T) -> Result<T> {
  std::panic::catch_unwind(std::panic::AssertUnwindSafe(work)).map_err(|payload| {
    let reason = payload
      .downcast_ref::<&str>()
      .map(|reason| reason.to_string())
      .or_else(|| payload.downcast_ref::<String>().cloned())
      .unwrap_or_else(|| "unknown".to_string());

    Error::from_reason(format!(
      "the analysis stopped on an internal error: {reason}"
    ))
  })
}

fn lock(state: &Mutex<State>) -> MutexGuard<'_, State> {
  crate::unpoisoned(state.lock())
}

fn to_target(target: NativeTarget) -> Target {
  let kind = match target.kind.as_str() {
    "messages" => TargetKind::Messages,
    _ => TargetKind::Custom,
  };

  Target {
    name: Arc::from(target.name),
    kind,
  }
}

fn to_generated_code(code: NativeGeneratedCode) -> GeneratedCode {
  let mappings = code
    .mappings
    .as_chunks::<4>()
    .0
    .iter()
    .map(|mapping| Mapping {
      generated: mapping[0],
      source: mapping[1],
      length: mapping[2],
      source_length: mapping[3],
    })
    .collect();
  let length = crate::positions::utf16_length(&code.code);

  GeneratedCode {
    lang: Lang::parse(&code.lang),
    mappings,
    length,
    code: code.code,
  }
}

fn to_generated_source(source: NativeGeneratedSource) -> GeneratedSource {
  GeneratedSource {
    main: to_generated_code(source.main),
    scripts: source.scripts.into_iter().map(to_generated_code).collect(),
    language: source.language,
    component_fields: source
      .component_fields
      .unwrap_or_default()
      .into_iter()
      .map(|fields| ComponentFields {
        specifier: fields.specifier,
        class_name: fields.class_name,
        range: fields.start.zip(fields.end),
      })
      .collect(),
    scope_objects: source.scope_objects.unwrap_or_default(),
    props: source.props.map(|props| PropsReads {
      calls: props.calls.unwrap_or_default(),
      members: props.members.unwrap_or_default(),
      variables: props.variables.unwrap_or_default(),
      undeclared: props.undeclared.unwrap_or(false),
    }),
    component_instances: source
      .component_instances
      .map(|instances| ComponentInstances {
        via: if instances.via == "new" {
          InstantiationSyntax::New
        } else {
          InstantiationSyntax::Call
        },
        path: instances.path.into_iter().map(Arc::from).collect(),
      }),
  }
}

fn to_load_result(result: LoadResult, alias_queries: Vec<String>) -> NativeLoadResult {
  NativeLoadResult {
    needs_js: result.needs_js,
    skipped: result
      .skipped
      .into_iter()
      .map(|(file, error)| NativeSkipped { file, error })
      .collect(),
    alias_queries,
  }
}

pub struct LoadTask {
  state: Arc<Mutex<State>>,
  prefetch: Arc<Prefetch>,
  requests: Vec<Request>,
}

impl Task for LoadTask {
  type Output = NativeLoadResult;
  type JsValue = NativeLoadResult;

  fn compute(&mut self) -> Result<Self::Output> {
    guarded(|| {
      let mut state = lock(&self.state);
      let state = &mut *state;

      let mut requests = std::mem::take(&mut state.queue);
      requests.append(&mut self.requests);
      requests.sort_by_key(|request| request.order);

      let result = load(
        &mut state.graph,
        requests,
        &state.claims,
        Some(&self.prefetch),
      );

      let mut alias_queries = Vec::new();
      if let Some(resolver) = state
        .resolver
        .as_mut()
        .filter(|resolver| resolver.aliases_in_js)
      {
        let mut asked: FxHashSet<&str> = FxHashSet::default();

        for id in unlinked(&state.graph) {
          for specifier in &state.graph.module(id).specifiers {
            let is_new = !resolver.aliased.contains_key(specifier)
              && !resolver.is_builtin(specifier)
              && asked.insert(specifier);
            if is_new {
              alias_queries.push(specifier.to_string());
            }
          }
        }
      }

      Ok(to_load_result(result, alias_queries))
    })?
  }

  fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
    Ok(output)
  }
}

pub struct ResolveTask {
  state: Arc<Mutex<State>>,
  queries: Vec<String>,
  aliased: Vec<String>,
}

impl Task for ResolveTask {
  type Output = Vec<String>;
  type JsValue = Vec<String>;

  fn compute(&mut self) -> Result<Self::Output> {
    guarded(|| {
      let mut state = lock(&self.state);
      let state = &mut *state;
      let Some(resolver) = state.resolver.as_mut() else {
        return Ok(Vec::new());
      };

      for (query, aliased) in self.queries.drain(..).zip(self.aliased.drain(..)) {
        resolver.aliased.insert(query.into(), aliased.into());
      }

      let unresolved = link(&mut state.graph, resolver);

      Ok(reported_unresolved(unresolved, &state.ignored_directories))
    })?
  }

  fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
    Ok(output)
  }
}

/// The imports to tell JavaScript about, as `specifier, importer` pairs: every
/// import that may be Paraglide's, and for any other specifier its first
/// importer among the app's own files.
fn reported_unresolved(unresolved: Vec<Unresolved>, ignored: &FxHashSet<String>) -> Vec<String> {
  let mut reported = Vec::new();
  let mut seen_specifiers: FxHashSet<String> = FxHashSet::default();
  let mut seen_pairs: FxHashSet<(String, String)> = FxHashSet::default();

  for Unresolved {
    specifier,
    importer,
  } in unresolved
  {
    let may_be_paraglide = specifier.contains("paraglide");

    let is_reported = if may_be_paraglide {
      seen_pairs.insert((specifier.clone(), importer.clone()))
    } else {
      let is_app_import = !importer
        .split(['/', '\\'])
        .any(|segment| ignored.contains(segment));

      is_app_import && seen_specifiers.insert(specifier.clone())
    };

    if is_reported {
      reported.push(specifier);
      reported.push(importer);
    }
  }

  reported
}

#[derive(Serialize)]
struct UsageJson<'a> {
  target: &'a str,
  name: &'a str,
  #[serde(skip_serializing_if = "std::ops::Not::not")]
  dynamic: bool,
  kind: &'static str,
  start: u32,
  end: u32,
  line: u32,
  column: u32,
  #[serde(rename = "endLine")]
  end_line: u32,
  /// An index of `NativeAnalysis::paths`: the file's number in `TargetFiles`.
  #[serde(rename = "targetFile")]
  target_file: u32,
}

struct WrittenFile {
  file: String,
  count: u32,
  json: String,
}

fn to_analysis(
  graph: &Graph,
  targets: &TargetFiles,
  files: &[String],
  analyzed: &[Vec<Usage>],
) -> NativeAnalysis {
  let written: Vec<Option<WrittenFile>> = files
    .par_iter()
    .zip(analyzed)
    .map(|(file, usages)| {
      if usages.is_empty() {
        return None;
      }

      let rows: Vec<UsageJson> = usages
        .iter()
        .map(|usage| UsageJson {
          target: &graph.options.targets[usage.target as usize].name,
          name: &usage.name,
          dynamic: usage.dynamic,
          kind: usage.kind.as_str(),
          start: usage.start,
          end: usage.end,
          line: usage.line,
          column: usage.column,
          end_line: usage.end_line,
          target_file: usage.target_file,
        })
        .collect();

      // Writing to a `String` does not fail.
      let json = serde_json::to_string(&rows).unwrap_or_default();

      Some(WrittenFile {
        file: file.clone(),
        count: usages.len() as u32,
        json,
      })
    })
    .collect();

  let mut analysis = NativeAnalysis {
    files: Vec::new(),
    counts: Vec::new(),
    usages: Vec::new(),
    paths: targets.paths.clone(),
    changed: Vec::new(),
  };
  for written in written.into_iter().flatten() {
    analysis.files.push(written.file);
    analysis.counts.push(written.count);
    analysis.usages.push(written.json);
  }

  analysis
}

fn analyze_files(
  state: &mut State,
  files: Vec<String>,
  custom: Option<&dyn CustomTargets>,
) -> NativeAnalysis {
  state.graph.prepare();
  let State {
    graph,
    targets,
    recorded,
    ..
  } = state;
  let ids = file_ids(graph, &files);

  let analyze =
    |file: Option<FileId>| file.map_or(Some(Vec::new()), |file| analyze_file(graph, file, custom));
  let found: Vec<Option<Vec<Usage>>> =
    crate::on_pool(|| analyze_widely_imported_first(graph, &ids, analyze));

  let mut changed = Vec::new();
  let mut analyzed: Vec<Vec<Usage>> = Vec::with_capacity(found.len());
  for (file, usages) in files.iter().zip(found) {
    if usages.is_none() {
      changed.push(file.clone());
    }
    analyzed.push(usages.unwrap_or_default());
  }

  let mut numbers: FxHashMap<FileId, u32> = FxHashMap::default();
  for usage in analyzed.iter_mut().flatten() {
    usage.target_file = *numbers
      .entry(usage.target_file)
      .or_insert_with(|| targets.number(graph.file(usage.target_file)));
  }

  let mut analysis = to_analysis(graph, targets, &files, &analyzed);
  analysis.changed = changed;

  for (file, usages) in files.into_iter().zip(analyzed) {
    let record = graph.known_file(&file).and_then(|id| graph.record(id));
    match record {
      Some(record) if !usages.is_empty() => {
        let source = record.source.clone();
        recorded.insert(file.into_boxed_str(), Recorded { source, usages });
      }
      _ => {
        recorded.remove(file.as_str());
      }
    }
  }

  analysis
}

/// From this many importers on, a file is analyzed ahead of the others, as a job of its own: the
/// functions of a file that thousands of modules import have thousands of call sites to read.
const WIDELY_IMPORTED: usize = 1000;

/// `analyze` of each of `files`, in order, the most widely imported started first.
fn analyze_widely_imported_first<T: Send + Sync>(
  graph: &Graph,
  files: &[Option<FileId>],
  analyze: impl Fn(Option<FileId>) -> T + Sync,
) -> Vec<T> {
  let mut widely_imported: Vec<(usize, usize)> = files
    .par_iter()
    .enumerate()
    .filter_map(|(index, file)| {
      let importers = crate::importers::importer_count(graph, (*file)?);
      (importers >= WIDELY_IMPORTED).then_some((importers, index))
    })
    .collect();
  if widely_imported.is_empty() {
    return files.par_iter().map(|&file| analyze(file)).collect();
  }

  // Most imported first: other threads take a thread's jobs oldest first.
  widely_imported.sort_unstable_by(|a, b| b.cmp(a));
  let mut is_widely_imported = vec![false; files.len()];
  for &(_, index) in &widely_imported {
    is_widely_imported[index] = true;
  }

  let found: Vec<std::sync::OnceLock<T>> =
    files.iter().map(|_| std::sync::OnceLock::new()).collect();
  let analyze = &analyze;
  let found_ref = &found;
  rayon::scope(|scope| {
    for &(_, index) in &widely_imported {
      let file = files[index];
      scope.spawn(move |_| {
        let _ = found_ref[index].set(analyze(file));
      });
    }

    files
      .par_iter()
      .enumerate()
      .filter(|(index, _)| !is_widely_imported[*index])
      .for_each(|(index, &file)| {
        let _ = found_ref[index].set(analyze(file));
      });
  });

  found
    .into_iter()
    .map(|result| result.into_inner().expect("every file is analyzed"))
    .collect()
}

fn finish_loading(state: &State, prefetch: &Prefetch) {
  if let Some(resolver) = &state.resolver {
    resolver.clear_cache_later();
  }

  prefetch.clear();
  crate::lower::release_allocators();
}

fn file_ids(graph: &Graph, files: &[String]) -> Vec<Option<FileId>> {
  files.iter().map(|file| graph.known_file(file)).collect()
}

pub struct AnalyzeTask {
  state: Arc<Mutex<State>>,
  prefetch: Arc<Prefetch>,
  files: Vec<String>,
}

impl Task for AnalyzeTask {
  type Output = NativeAnalysis;
  type JsValue = NativeAnalysis;

  fn compute(&mut self) -> Result<Self::Output> {
    guarded(|| {
      let mut state = lock(&self.state);
      finish_loading(&state, &self.prefetch);

      let files = std::mem::take(&mut self.files);
      Ok(analyze_files(&mut state, files, None))
    })?
  }

  fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
    Ok(output)
  }
}

type CustomSymbolFunction<'a> =
  Function<'a, FnArgs<(u32, String, String, Vec<String>)>, Option<NativeCustomSymbol>>;

struct Question {
  target: u32,
  file: String,
  export: String,
  path: Vec<String>,
  answer: mpsc::SyncSender<Option<CustomSymbol>>,
}

enum Message<T> {
  Ask(Question),
  Done(T),
}

/// Asks the main thread, where JavaScript runs, what the custom targets' exports are.
struct AskedTargets<T> {
  questions: mpsc::Sender<Message<T>>,
}

impl<T: Send> CustomTargets for AskedTargets<T> {
  fn symbol(
    &self,
    target: u32,
    file: &str,
    export: &str,
    path: &[Arc<str>],
  ) -> Option<CustomSymbol> {
    let (answer, answered) = mpsc::sync_channel(1);
    let question = Question {
      target,
      file: file.to_string(),
      export: export.to_string(),
      path: path.iter().map(|name| name.to_string()).collect(),
      answer,
    };

    self.questions.send(Message::Ask(question)).ok()?;
    answered.recv().ok().flatten()
  }
}

/// Runs `work` on the analysis' threads while this thread answers its questions with `symbol`,
/// whose first error is the result once `work` is done.
fn with_custom_targets<T: Send>(
  symbol: &CustomSymbolFunction<'_>,
  work: impl FnOnce(&AskedTargets<Result<T>>) -> Result<T> + Send,
) -> Result<T> {
  let (questions, asked) = mpsc::channel();
  let mut thrown: Option<Error> = None;

  let result = rayon::in_place_scope(|scope| {
    let done = questions.clone();
    scope.spawn(move |_| {
      let targets = AskedTargets { questions };
      let result = work(&targets);
      let _ = done.send(Message::Done(result));
    });

    loop {
      match asked.recv() {
        Ok(Message::Ask(question)) => {
          let answer = match &thrown {
            Some(_) => None,
            None => ask(symbol, &question).unwrap_or_else(|error| {
              thrown = Some(error);
              None
            }),
          };
          let _ = question.answer.send(answer);
        }
        Ok(Message::Done(result)) => break result,
        Err(_) => break Err(Error::from_reason("the analysis stopped without a result")),
      }
    }
  });

  match thrown {
    Some(error) => Err(error),
    None => result,
  }
}

fn ask(symbol: &CustomSymbolFunction<'_>, question: &Question) -> Result<Option<CustomSymbol>> {
  let arguments = FnArgs::from((
    question.target,
    question.file.clone(),
    question.export.clone(),
    question.path.clone(),
  ));

  Ok(symbol.call(arguments)?.map(|symbol| {
    if symbol.kind == "value" {
      CustomSymbol::Value {
        name: symbol.name.unwrap_or_default(),
        methods: symbol.methods.unwrap_or_default(),
      }
    } else {
      CustomSymbol::Namespace
    }
  }))
}

#[napi(object)]
pub struct NativeSystemError {
  /// The system's number for the error, on a system whose numbers JavaScript knows.
  pub errno: Option<i32>,
  /// The error's code, for a number JavaScript does not know.
  pub code: String,
  pub syscall: String,
  pub path: Option<String>,
  pub dest: Option<String>,
}

#[napi(object)]
pub struct NativeSkippedMetadata {
  pub file: String,
  /// Why it could not be read; none if it is not the JSON of an object.
  pub error: Option<NativeSystemError>,
}

#[napi(object)]
pub struct NativeMetadataResult {
  /// The metadata files that were left as they are, in order.
  pub skipped: Vec<NativeSkippedMetadata>,
  /// The first write that failed: then some files may not be written.
  pub failure: Option<NativeSystemError>,
  /// A field written by hand nests deeper than `JSON.stringify` can write.
  pub too_deep: bool,
  /// The analyzed files that changed on disk since, whose snippets are left out.
  pub changed: Vec<String>,
}

/// `ENOENT` for a file that is not found, as libuv names errors.
fn error_code(error: &std::io::Error) -> &'static str {
  use std::io::ErrorKind;

  match error.kind() {
    ErrorKind::NotFound => "ENOENT",
    ErrorKind::PermissionDenied => "EACCES",
    ErrorKind::AlreadyExists => "EEXIST",
    ErrorKind::IsADirectory => "EISDIR",
    ErrorKind::NotADirectory => "ENOTDIR",
    ErrorKind::DirectoryNotEmpty => "ENOTEMPTY",
    ErrorKind::StorageFull => "ENOSPC",
    ErrorKind::ReadOnlyFilesystem => "EROFS",
    ErrorKind::CrossesDevices => "EXDEV",
    ErrorKind::ResourceBusy => "EBUSY",
    ErrorKind::InvalidFilename => "ENAMETOOLONG",
    ErrorKind::Interrupted => "EINTR",
    ErrorKind::QuotaExceeded => "EDQUOT",
    _ => "EIO",
  }
}

fn to_system_error(
  error: &std::io::Error,
  syscall: &str,
  path: Option<String>,
  dest: Option<String>,
) -> NativeSystemError {
  NativeSystemError {
    // Windows' numbers are not those JavaScript knows.
    errno: if cfg!(windows) {
      None
    } else {
      error.raw_os_error()
    },
    code: error_code(error).to_string(),
    syscall: syscall.to_string(),
    path,
    dest,
  }
}

pub struct WriteMetadataTask {
  state: Arc<Mutex<State>>,
  input: String,
  radius: f64,
}

impl Task for WriteMetadataTask {
  type Output = NativeMetadataResult;
  type JsValue = NativeMetadataResult;

  fn compute(&mut self) -> Result<Self::Output> {
    guarded(|| write_metadata(&lock(&self.state), self.input.as_bytes(), self.radius))?
  }

  fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
    Ok(output)
  }
}

fn bad_input(metadata::BadInput(what): metadata::BadInput) -> Error {
  Error::from_reason(format!("the metadata input is not as expected: `{what}`"))
}

/// `input` is the JSON of `{ files, names, targets, targetProjects, projects }`.
fn write_metadata(state: &State, input: &[u8], radius: f64) -> Result<NativeMetadataResult> {
  let input = metadata::input_object(input).map_err(bad_input)?;
  let metadata::WriteInput {
    files,
    target_projects,
    projects,
  } = metadata::write_input(&input).map_err(bad_input)?;

  // Only a message's usage counts, in the project its outdir is paired with.
  let is_message: Vec<bool> = state
    .graph
    .options
    .targets
    .iter()
    .map(|target| &*target.name == "message")
    .collect();
  let project_of_target: Vec<Option<&[u8]>> = state
    .targets
    .paths
    .iter()
    .map(|path| target_projects.get(path.as_bytes()).copied())
    .collect();

  // Each file's text, read again unless it was kept; none if it changed since its analysis.
  let texts: Vec<Option<(&Recorded, std::borrow::Cow<str>)>> = files
    .par_iter()
    .map(|&(file, _)| {
      let path = std::str::from_utf8(file).ok()?;
      let recorded = state.recorded.get(path)?;
      Some((recorded, recorded.source.text(path)?))
    })
    .collect();

  let mut changed = Vec::new();
  let mut sources: Vec<SourceFile> = Vec::with_capacity(files.len());
  for (&(file, name), text) in files.iter().zip(&texts) {
    let Some((recorded, text)) = text else {
      let path = String::from_utf8_lossy(file);
      if state.recorded.contains_key(&*path) {
        changed.push(path.into_owned());
      }
      continue;
    };

    let usages = recorded
      .usages
      .iter()
      .map(|usage| metadata::snippets::SourceUsage {
        name: usage.name.as_bytes(),
        dynamic: usage.dynamic,
        start: f64::from(usage.start),
        end: f64::from(usage.end),
        line: f64::from(usage.line),
        end_line: f64::from(usage.end_line),
        project: is_message[usage.target as usize]
          .then(|| project_of_target[usage.target_file as usize])
          .flatten(),
      })
      .collect();

    sources.push(SourceFile {
      name,
      code: text.as_bytes(),
      usages,
    });
  }

  let mut result = NativeMetadataResult {
    skipped: Vec::new(),
    failure: None,
    too_deep: false,
    changed,
  };

  match metadata::write_all(&sources, &projects, radius, &SystemFiles) {
    Ok(skipped) => {
      result.skipped = skipped
        .into_iter()
        .map(|(file, reason)| NativeSkippedMetadata {
          error: match reason {
            Skipped::Unreadable(error) => {
              Some(to_system_error(&error, "open", Some(file.clone()), None))
            }
            Skipped::NotAnObject => None,
          },
          file,
        })
        .collect();
    }
    Err(Failure::System(SystemError {
      error,
      syscall,
      path,
      dest,
    })) => result.failure = Some(to_system_error(&error, syscall, path, dest)),
    Err(Failure::TooDeep) => result.too_deep = true,
  }

  Ok(result)
}

/// For tests: a metadata file as `writeMetadata` writes it from the JSON of
/// `{ inlangProject, keys, existing, sources }`, or none if `existing` is not the JSON of an
/// object.
/// What the analysis writes for `file`, of the built-in language named `language`, as a language's
/// `generate` returns it; fails when the file is not valid in the language.
#[napi]
pub fn generate_source(
  file: String,
  code: String,
  language: String,
) -> Result<NativeGeneratedSource> {
  let language = Language::named(&language)
    .ok_or_else(|| Error::from_reason(format!("no built-in language is named {language}")))?;
  start_workers();
  // On the pool, whose threads have the stack that deeply nested code needs.
  let generated =
    guarded(|| crate::on_pool(|| crate::load::generate_source(&file, &code, language)))?
      .map_err(Error::from_reason)?;

  Ok(to_native_source(generated))
}

fn to_native_code(code: GeneratedCode) -> NativeGeneratedCode {
  let mappings: Vec<i32> = code
    .mappings
    .iter()
    .flat_map(|mapping| {
      [
        mapping.generated,
        mapping.source,
        mapping.length,
        mapping.source_length,
      ]
    })
    .collect();
  let lang = match code.lang {
    Lang::Js => "js",
    Lang::Jsx => "jsx",
    Lang::Ts => "ts",
    Lang::Tsx => "tsx",
  };

  NativeGeneratedCode {
    code: code.code,
    lang: lang.to_string(),
    mappings: Int32Array::new(mappings),
  }
}

fn to_native_source(source: GeneratedSource) -> NativeGeneratedSource {
  NativeGeneratedSource {
    main: to_native_code(source.main),
    scripts: source.scripts.into_iter().map(to_native_code).collect(),
    language: source.language,
    component_fields: Some(
      source
        .component_fields
        .into_iter()
        .map(|fields| NativeComponentFields {
          specifier: fields.specifier,
          class_name: fields.class_name,
          start: fields.range.map(|(start, _)| start),
          end: fields.range.map(|(_, end)| end),
        })
        .collect(),
    ),
    scope_objects: Some(source.scope_objects),
    props: source.props.map(|props| NativePropsReads {
      calls: Some(props.calls),
      members: Some(props.members),
      variables: Some(props.variables),
      undeclared: Some(props.undeclared),
    }),
    component_instances: source
      .component_instances
      .map(|instances| NativeComponentInstances {
        via: match instances.via {
          InstantiationSyntax::New => "new",
          InstantiationSyntax::Call => "call",
        }
        .to_string(),
        path: instances.path.iter().map(|name| name.to_string()).collect(),
      }),
  }
}

/// The built-in languages whose files the analysis writes itself, by name.
#[napi]
pub fn native_languages() -> Vec<String> {
  NativeLanguages::new(Language::ALL)
    .languages()
    .iter()
    .map(|language| language.name().to_string())
    .collect()
}

#[napi]
pub fn render_metadata(input: String, radius: f64) -> Result<Option<String>> {
  start_workers();
  guarded(|| match metadata::render_input(input.as_bytes(), radius) {
    Err(bad) => Err(bad_input(bad)),
    Ok(Err(_)) => Err(Error::from_reason("Maximum call stack size exceeded")),
    // What is written is UTF-8: lone surrogates are escaped.
    Ok(Ok(rendered)) => Ok(rendered.map(|bytes| String::from_utf8_lossy(&bytes).into_owned())),
  })?
}

#[napi]
impl NativeGraph {
  #[napi(constructor)]
  pub fn new(options: NativeGraphOptions) -> Self {
    start_workers();

    let graph = Graph::new(GraphOptions {
      targets: options.targets.into_iter().map(to_target).collect(),
      outdirs: options.outdirs,
      source_extensions: options.source_extensions,
      sources_on_disk: options.sources_on_disk.unwrap_or(false),
    });

    let ignored_directories = options
      .resolver
      .as_ref()
      .map(|resolver| resolver.ignored_directories.iter().cloned().collect())
      .unwrap_or_default();

    let resolver = options.resolver.map(|resolver| {
      NativeResolver::new(ResolverOptions {
        aliases: resolver
          .aliases
          .into_iter()
          .map(|alias| ImportAlias {
            find: alias.find,
            replacement: alias.replacement,
            exact: alias.exact.unwrap_or(false),
          })
          .collect(),
        root_directory: resolver.root_directory,
        conditions: resolver.conditions,
        builtins: resolver.builtins,
        aliases_in_js: resolver.aliases_in_js,
      })
    });

    let claims = Arc::new(Claims {
      detected: options
        .detect
        .into_iter()
        .map(|detect| DetectedExtension {
          extension: detect.extension,
          hints: detect.hints,
        })
        .collect(),
      native: NativeLanguages::new(
        options
          .native_languages
          .unwrap_or_default()
          .iter()
          .filter_map(|name| Language::named(name)),
      ),
    });

    Self {
      state: Arc::new(Mutex::new(State {
        graph,
        recorded: FxHashMap::default(),
        targets: TargetFiles::default(),
        resolver,
        ignored_directories,
        claims: claims.clone(),
        queue: Vec::new(),
      })),
      prefetch: Arc::new(Prefetch::new(claims)),
    }
  }

  // ---------------------------------------------------------------- outdirs

  /// The directories that may be the outdirs of `files` and were not asked about yet.
  #[napi]
  pub fn outdir_candidates(&self, files: Vec<String>) -> Vec<String> {
    lock(&self.state).graph.outdir_candidates(&files)
  }

  #[napi]
  pub fn add_outdir(&self, directory: String) {
    lock(&self.state).graph.add_outdir(&directory);
  }

  /// Longest first.
  #[napi]
  pub fn outdirs(&self) -> Vec<String> {
    lock(&self.state).graph.outdirs.clone()
  }

  /// The files that are not in an outdir.
  #[napi]
  pub fn not_generated(&self, files: Vec<String>) -> Vec<String> {
    let state = lock(&self.state);

    files
      .into_iter()
      .filter(|file| !state.graph.is_generated(file))
      .collect()
  }

  // ---------------------------------------------------------------- loading

  #[napi]
  pub fn queue_script(&self, file: String, order: u32, code: String) {
    self.queue(file, order, Input::Script { code });
  }

  /// A file in a format that is not analyzed.
  #[napi]
  pub fn queue_empty(&self, file: String, order: u32, code: String) {
    self.queue(file, order, Input::Empty { code });
  }

  /// A file that JavaScript read, which is written here if a native language claims it, and is
  /// otherwise a script, or a file in a format that is not analyzed.
  #[napi]
  pub fn queue_source(&self, file: String, order: u32, code: String) {
    self.queue(file, order, Input::Source { code });
  }

  #[napi]
  pub fn queue_generated(
    &self,
    file: String,
    order: u32,
    code: String,
    generated: NativeGeneratedSource,
  ) {
    let generated = Box::new(to_generated_source(generated));
    self.queue(file, order, Input::Generated { code, generated });
  }

  fn queue(&self, file: String, order: u32, input: Input) {
    let order = order as u64;
    lock(&self.state).queue.push(Request { file, order, input });
  }

  /// Starts reading and parsing scripts that are about to be loaded, for `load` to take, and
  /// returns at once.
  #[napi]
  pub fn prefetch(&self, files: Vec<String>) {
    self.prefetch.start(files);
  }

  /// Reads and parses the scripts `files` and what was queued, where `orders` are the positions of
  /// `files` among the loaded files.
  #[napi(ts_return_type = "Promise<NativeLoadResult>")]
  pub fn load(&self, files: Vec<String>, orders: Vec<u32>) -> AsyncTask<LoadTask> {
    let requests = files
      .into_iter()
      .zip(orders)
      .map(|(file, order)| Request {
        file,
        order: order as u64,
        input: Input::Read,
      })
      .collect();

    AsyncTask::new(LoadTask {
      state: self.state.clone(),
      prefetch: self.prefetch.clone(),
      requests,
    })
  }

  /// `aliased` is what JavaScript's aliases make of `queries`, and the result is the unresolved
  /// imports to report as `specifier, importer` pairs.
  #[napi(ts_return_type = "Promise<Array<string>>")]
  pub fn resolve(&self, queries: Vec<String>, aliased: Vec<String>) -> AsyncTask<ResolveTask> {
    AsyncTask::new(ResolveTask {
      state: self.state.clone(),
      queries,
      aliased,
    })
  }

  /// What the loaded modules load, for JavaScript to resolve.
  #[napi]
  pub fn pending_specifiers(&self) -> NativePending {
    let state = lock(&self.state);
    let graph = &state.graph;
    let mut pending = NativePending {
      importers: Vec::new(),
      counts: Vec::new(),
      specifiers: Vec::new(),
    };

    for id in unlinked(graph) {
      let module = graph.module(id);

      pending.importers.push(graph.file(module.file).to_string());
      pending.counts.push(module.specifiers.len() as u32);
      pending.specifiers.extend(
        module
          .specifiers
          .iter()
          .map(|specifier| specifier.to_string()),
      );
    }

    pending
  }

  /// The file of each of `pending_specifiers`' specifiers.
  #[napi]
  pub fn set_resolved(&self, files: Vec<Option<String>>) {
    let mut state = lock(&self.state);
    let modules = unlinked(&state.graph);

    link_with(&mut state.graph, &modules, files);
  }

  /// The files that the modules of `files` load, each once.
  #[napi]
  pub fn dependencies(&self, files: Vec<String>) -> Vec<String> {
    let state = lock(&self.state);
    let graph = &state.graph;
    let ids: Vec<FileId> = file_ids(graph, &files).into_iter().flatten().collect();

    graph
      .dependencies_of(&ids)
      .into_iter()
      .map(|file| graph.file(file).to_string())
      .collect()
  }

  /// The files to parse for their exports: the app's own sources that are not Paraglide's.
  #[napi]
  pub fn followable(&self, files: Vec<String>) -> Vec<String> {
    let mut state = lock(&self.state);
    let graph = &mut state.graph;

    files
      .into_iter()
      .filter(|file| {
        let id = graph.file_id(file);
        graph.should_follow(id)
      })
      .collect()
  }

  #[napi]
  pub fn is_loaded(&self, files: Vec<String>) -> Vec<bool> {
    let state = lock(&self.state);
    let graph = &state.graph;

    file_ids(graph, &files)
      .into_iter()
      .map(|file| file.is_some_and(|file| graph.records.contains_key(&file)))
      .collect()
  }

  // ---------------------------------------------------------------- targets

  #[napi]
  pub fn target_of(&self, file: String) -> Option<String> {
    let mut state = lock(&self.state);
    let graph = &mut state.graph;
    let id = graph.file_id(&file);

    graph
      .target_of(id)
      .map(|target| graph.options.targets[target as usize].name.to_string())
  }

  /// The files the custom targets were not asked about, for the outdirs known now.
  #[napi]
  pub fn custom_target_queries(&self, files: Vec<String>) -> Vec<NativeTargetFile> {
    let mut state = lock(&self.state);
    let graph = &mut state.graph;
    let mut queries = Vec::new();

    if !graph.has_custom_targets() {
      return queries;
    }

    // Every file an import resolves to, or an auto-import names, may be a target's.
    let mut asked: Vec<FileId> = files.iter().map(|file| graph.file_id(file)).collect();
    asked.extend(graph.globals.iter().map(|global| global.file));
    for module in &graph.modules {
      asked.extend(module.resolved.values().flatten());
    }

    let mut seen = FxHashSet::default();
    for file in asked {
      if graph.custom_matches.contains_key(&file) || !seen.insert(file) {
        continue;
      }

      let path = graph.file(file).to_string();
      let target_file = graph.target_file(&path);

      queries.push(NativeTargetFile {
        path,
        file: target_file.file,
        outdir: target_file.outdir,
        outdir_path: target_file.outdir_path,
      });
    }

    queries
  }

  /// The last custom target that matches each file; -1 for none.
  #[napi]
  pub fn set_custom_matches(&self, files: Vec<String>, targets: Vec<i32>) {
    let mut state = lock(&self.state);
    let graph = &mut state.graph;

    for (file, target) in files.into_iter().zip(targets) {
      let id = graph.file_id(&file);
      graph.custom_matches.insert(id, u32::try_from(target).ok());
    }

    graph.invalidate();
  }

  /// Names every module can use without importing them.
  #[napi]
  pub fn set_globals(&self, globals: Vec<NativeGlobal>) {
    let globals = globals
      .into_iter()
      .map(|global| (global.name, global.file, global.export_name))
      .collect();

    lock(&self.state).graph.set_globals(globals);
  }

  // ---------------------------------------------------------------- analysis

  /// The usages in each of `files`, which must have been loaded.
  #[napi(ts_return_type = "Promise<NativeAnalysis>")]
  pub fn analyze(&self, files: Vec<String>) -> AsyncTask<AnalyzeTask> {
    AsyncTask::new(AnalyzeTask {
      state: self.state.clone(),
      prefetch: self.prefetch.clone(),
      files,
    })
  }

  /// As `analyze`, waiting for the result: `symbol` says what the custom targets export, and an error it throws is thrown.
  #[napi]
  pub fn analyze_with_custom_targets(
    &self,
    files: Vec<String>,
    #[napi(
      ts_arg_type = "(target: number, file: string, exportName: string, path: Array<string>) => NativeCustomSymbol | undefined | null"
    )]
    symbol: CustomSymbolFunction<'_>,
  ) -> Result<NativeAnalysis> {
    let mut state = lock(&self.state);
    finish_loading(&state, &self.prefetch);
    let state = &mut *state;

    with_custom_targets(&symbol, move |custom| {
      guarded(|| analyze_files(state, files, Some(custom)))
    })
  }

  /// Frees the modules on a thread of its own, keeping what `writeMetadata` writes and the targets
  /// and outdirs.
  #[napi]
  pub fn release(&self) {
    let modules = lock(&self.state).graph.take();
    std::thread::spawn(move || drop(modules));
    self.prefetch.clear();
  }

  // ---------------------------------------------------------------- metadata

  /// Writes the metadata file of each message file of `input`'s projects, where `input` is the JSON
  /// of `MetadataInput` (`src/compiler/output/metadata.ts`).
  #[napi(ts_return_type = "Promise<NativeMetadataResult>")]
  pub fn write_metadata(&self, input: String, radius: f64) -> AsyncTask<WriteMetadataTask> {
    AsyncTask::new(WriteMetadataTask {
      state: self.state.clone(),
      input,
      radius,
    })
  }

  #[napi]
  pub fn stats(&self) -> NativeStats {
    let state = lock(&self.state);
    let graph = &state.graph;

    NativeStats {
      modules: graph.modules.len() as u32,
      files: graph.records.len() as u32,
      nodes: graph
        .modules
        .iter()
        .map(|module| module.ast.nodes.len())
        .sum::<usize>() as f64,
      tree_bytes: graph
        .modules
        .iter()
        .map(|module| module.ast.memory())
        .sum::<usize>() as f64,
    }
  }
}

/// For tests: the lowered tree as "Kind start end" lines, in walk order.
#[napi]
pub fn debug_tree(code: String, lang: String) -> Result<String> {
  use std::fmt::Write;

  let ast = crate::lower::lower(&code, Lang::parse(&lang)).map_err(Error::from_reason)?;
  let mut out = String::new();

  for (id, node) in ast.nodes.iter().enumerate() {
    let _ = writeln!(out, "{:?} {} {}", node.kind, node.start, ast.end(id as u32));
  }

  Ok(out)
}
