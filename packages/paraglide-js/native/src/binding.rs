//! What JavaScript calls. Long steps run off the main thread, on every core.

use std::sync::{Arc, Mutex, MutexGuard};

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
  load::{
    link, link_with, load, unlinked, DetectedExtension, GeneratedCode, GeneratedSource, Input,
    LoadResult, Request, Unresolved,
  },
  lower::Lang,
  mapping::Mapping,
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
  /// The analyzed files that have usages.
  pub files: Vec<String>,
  /// The code of each.
  pub codes: Vec<String>,
  /// How many usages each has.
  pub counts: Vec<u32>,
  /// The usages of each, as a JSON list of lists.
  pub usages: String,
  /// The files that the usages' `targetFile` name by index.
  pub paths: Vec<String>,
}

#[napi(object)]
pub struct NativeStats {
  pub modules: u32,
  pub files: u32,
  pub nodes: f64,
  /// Bytes held by the modules' trees.
  pub tree_bytes: f64,
}

struct State {
  graph: Graph,
  resolver: Option<NativeResolver>,
  ignored_directories: FxHashSet<String>,
  detected: Vec<DetectedExtension>,
  /// What JavaScript read or generated, until the next load parses it.
  queue: Vec<Request>,
}

#[napi]
pub struct NativeGraph {
  state: Arc<Mutex<State>>,
}

/// The stack of each thread that parses and analyzes: deeply nested code is read by functions that call themselves.
const WORKER_STACK_BYTES: usize = 16 << 20;

/// Sets up the threads the analysis runs on, once.
fn start_workers() {
  static STARTED: std::sync::Once = std::sync::Once::new();

  STARTED.call_once(|| {
    // If another addon set the pool up first, its threads are used as they are.
    let _ = rayon::ThreadPoolBuilder::new()
      .stack_size(WORKER_STACK_BYTES)
      .build_global();
  });
}

/// Runs a step of the analysis; a bug in it is an error in JavaScript, not the end of the process.
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
  // A panic while the lock is held leaves the graph as it was: it is only read after.
  state
    .lock()
    .unwrap_or_else(|poisoned| poisoned.into_inner())
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
  let length = code.code.encode_utf16().count();

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

      let result = load(&mut state.graph, requests, &state.detected);

      // JavaScript's aliases are asked about each specifier once.
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
  /// An index of `NativeAnalysis::paths`.
  #[serde(rename = "targetFile")]
  target_file: u32,
}

/// A file's usages, written for JavaScript.
struct WrittenFile {
  file: String,
  code: String,
  count: u32,
  json: Vec<u8>,
}

/// The usages of the files that have any, for JavaScript. Each file's are
/// written on a core of its own.
fn to_analysis(graph: &Graph, files: Vec<String>, analyzed: Vec<Vec<Usage>>) -> NativeAnalysis {
  // The target files, numbered in the order they are first named.
  let mut path_indexes: FxHashMap<FileId, u32> = FxHashMap::default();
  let mut paths: Vec<String> = Vec::new();
  for usage in analyzed.iter().flatten() {
    path_indexes.entry(usage.target_file).or_insert_with(|| {
      paths.push(graph.file(usage.target_file).to_string());
      paths.len() as u32 - 1
    });
  }

  let written: Vec<Option<WrittenFile>> = files
    .into_par_iter()
    .zip(analyzed)
    .map(|(file, usages)| {
      if usages.is_empty() {
        return None;
      }
      let record = graph.known_file(&file).and_then(|id| graph.record(id))?;

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
          target_file: path_indexes[&usage.target_file],
        })
        .collect();

      let mut json = Vec::with_capacity(usages.len() * 160);
      // Writing to a `Vec` does not fail.
      let _ = serde_json::to_writer(&mut json, &rows);

      Some(WrittenFile {
        file,
        code: record.source.code.to_string(),
        count: usages.len() as u32,
        json,
      })
    })
    .collect();

  let written: Vec<_> = written.into_iter().flatten().collect();
  let length = written
    .iter()
    .map(|written| written.json.len() + 1)
    .sum::<usize>();
  let mut json: Vec<u8> = Vec::with_capacity(length + 2);
  json.push(b'[');

  let mut with_usages = Vec::with_capacity(written.len());
  let mut codes = Vec::with_capacity(written.len());
  let mut counts = Vec::with_capacity(written.len());

  for written in written {
    if !with_usages.is_empty() {
      json.push(b',');
    }
    json.extend_from_slice(&written.json);

    with_usages.push(written.file);
    codes.push(written.code);
    counts.push(written.count);
  }

  json.push(b']');

  NativeAnalysis {
    files: with_usages,
    codes,
    counts,
    usages: String::from_utf8(json).unwrap_or_default(),
    paths,
  }
}

fn file_ids(graph: &Graph, files: &[String]) -> Vec<Option<FileId>> {
  files.iter().map(|file| graph.known_file(file)).collect()
}

pub struct AnalyzeTask {
  state: Arc<Mutex<State>>,
  files: Vec<String>,
}

impl Task for AnalyzeTask {
  type Output = NativeAnalysis;
  type JsValue = NativeAnalysis;

  fn compute(&mut self) -> Result<Self::Output> {
    guarded(|| {
      let mut state = lock(&self.state);
      state.graph.prepare();

      // The analysis resolves nothing: what was read of the file system is given
      // back while it runs, before its own memory is at its peak.
      if let Some(resolver) = &state.resolver {
        resolver.clear_cache_later();
      }

      let graph = &state.graph;
      let files = std::mem::take(&mut self.files);

      let analyzed: Vec<Vec<Usage>> = file_ids(graph, &files)
        .into_par_iter()
        .map(|file| {
          file
            .map(|file| analyze_file(graph, file, None))
            .unwrap_or_default()
        })
        .collect();

      Ok(to_analysis(graph, files, analyzed))
    })?
  }

  fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
    Ok(output)
  }
}

type CustomSymbolFunction<'a> =
  Function<'a, FnArgs<(u32, String, String, Vec<String>)>, Option<NativeCustomSymbol>>;

/// Asks JavaScript what a custom target's exports are.
struct JsTargets<'a> {
  symbol: CustomSymbolFunction<'a>,
}

impl CustomTargets for JsTargets<'_> {
  fn symbol(
    &self,
    target: u32,
    file: &str,
    export: &str,
    path: &[Arc<str>],
  ) -> Option<CustomSymbol> {
    let path: Vec<String> = path.iter().map(|name| name.to_string()).collect();
    let arguments = FnArgs::from((target, file.to_string(), export.to_string(), path));
    let symbol = self.symbol.call(arguments).ok().flatten()?;

    Some(if symbol.kind == "value" {
      CustomSymbol::Value {
        name: symbol.name.unwrap_or_default(),
        methods: symbol.methods.unwrap_or_default(),
      }
    } else {
      CustomSymbol::Namespace
    })
  }
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

    let detected = options
      .detect
      .into_iter()
      .map(|detect| DetectedExtension {
        extension: detect.extension,
        hints: detect.hints,
      })
      .collect();

    Self {
      state: Arc::new(Mutex::new(State {
        graph,
        resolver,
        ignored_directories,
        detected,
        queue: Vec::new(),
      })),
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

  /// A script that JavaScript read.
  #[napi]
  pub fn queue_script(&self, file: String, order: u32, code: String) {
    let request = Request {
      file,
      order: order as u64,
      input: Input::Script { code },
    };
    lock(&self.state).queue.push(request);
  }

  /// A file in a format that is not analyzed.
  #[napi]
  pub fn queue_empty(&self, file: String, order: u32, code: String) {
    let request = Request {
      file,
      order: order as u64,
      input: Input::Empty { code },
    };
    lock(&self.state).queue.push(request);
  }

  /// A component file, as the code its language's tooling wrote for it.
  #[napi]
  pub fn queue_generated(
    &self,
    file: String,
    order: u32,
    code: String,
    generated: NativeGeneratedSource,
  ) {
    let input = Input::Generated {
      code,
      generated: Box::new(to_generated_source(generated)),
    };
    lock(&self.state).queue.push(Request {
      file,
      order: order as u64,
      input,
    });
  }

  /// Reads the scripts `files`, and parses them and what was queued. `orders`
  /// are the positions of `files` among the loaded files.
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
      requests,
    })
  }

  /// Resolves what the loaded modules load. `aliased` is what JavaScript's
  /// aliases make of `queries`. Resolves with the unresolved imports to report,
  /// as `specifier, importer` pairs.
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

  /// Whether each file was loaded.
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

  /// The name of the target a file belongs to.
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

  /// The usages in each of `files`, which were loaded.
  #[napi(ts_return_type = "Promise<NativeAnalysis>")]
  pub fn analyze(&self, files: Vec<String>) -> AsyncTask<AnalyzeTask> {
    AsyncTask::new(AnalyzeTask {
      state: self.state.clone(),
      files,
    })
  }

  /// As `analyze`, on this thread: `symbol` says what the custom targets export.
  #[napi]
  pub fn analyze_with_custom_targets(
    &self,
    files: Vec<String>,
    #[napi(
      ts_arg_type = "(target: number, file: string, exportName: string, path: Array<string>) => NativeCustomSymbol | undefined | null"
    )]
    symbol: CustomSymbolFunction<'_>,
  ) -> Result<NativeAnalysis> {
    guarded(|| self.analyze_here(files, symbol))
  }

  fn analyze_here(&self, files: Vec<String>, symbol: CustomSymbolFunction<'_>) -> NativeAnalysis {
    let mut state = lock(&self.state);
    state.graph.prepare();
    let graph = &state.graph;
    let custom = JsTargets { symbol };

    let analyzed: Vec<Vec<Usage>> = file_ids(graph, &files)
      .into_iter()
      .map(|file| {
        file
          .map(|file| analyze_file(graph, file, Some(&custom)))
          .unwrap_or_default()
      })
      .collect();

    to_analysis(graph, files, analyzed)
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

  for node in &ast.nodes {
    let _ = writeln!(out, "{:?} {} {}", node.kind, node.start, node.end);
  }

  Ok(out)
}
