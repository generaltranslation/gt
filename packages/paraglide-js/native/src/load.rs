//! Reads and parses files into modules. Each file is prepared on its own, so
//! that all of a round's files are prepared at once; adding them to the graph
//! and resolving what they load are steps after it.

use std::sync::{Arc, Condvar, Mutex};

use rayon::prelude::*;
use rustc_hash::{FxHashMap, FxHashSet};

use crate::{
  graph::{
    ComponentFields, ComponentInstances, FileId, Graph, Module, ModuleCache, ModuleId, PropsReads,
    SourceFile,
  },
  ir::Ast,
  lower::{lower, Lang},
  mapping::{remap, Mapping},
  resolve::NativeResolver,
  syntax::{loaded_specifiers, ModuleSyntax},
};

/// Code a language's tooling wrote for a file, and where each part of it comes from.
pub struct GeneratedCode {
  pub code: String,
  pub lang: Lang,
  pub mappings: Vec<Mapping>,
  /// The length of `code` in UTF-16 code units.
  pub length: usize,
}

/// A component file as one module, written by the framework's own tooling.
pub struct GeneratedSource {
  pub main: GeneratedCode,
  /// Modules of their own in the file, e.g. an Astro page's client scripts.
  pub scripts: Vec<GeneratedCode>,
  pub language: String,
  pub component_fields: Vec<ComponentFields>,
  pub scope_objects: Vec<String>,
  pub props: Option<PropsReads>,
  pub component_instances: Option<ComponentInstances>,
}

pub enum Input {
  /// A script that is read here.
  Read,
  /// A script that was read here: a language may still claim it.
  ReadScript { code: String },
  /// A file that could not be read.
  Unreadable,
  /// A script that JavaScript read.
  Script { code: String },
  Generated {
    code: String,
    generated: Box<GeneratedSource>,
  },
  /// A file in a format that is not analyzed: a module without code of its own.
  Empty { code: String },
}

pub struct Request {
  pub file: String,
  /// The file's position among the loaded ones.
  pub order: u64,
  pub input: Input,
}

/// A script extension that a language claims for some files, e.g. Angular components in `.ts` files.
pub struct DetectedExtension {
  pub extension: String,
  /// What a file must contain to be the language's; with none, every file may be.
  pub hints: Vec<String>,
}

struct PreparedModule {
  ast: Ast,
  specifiers: Vec<Box<str>>,
  syntax: ModuleSyntax,
}

struct PreparedFile {
  source: SourceFile,
  modules: Vec<PreparedModule>,
  component_fields: Vec<ComponentFields>,
  scope_objects: Vec<String>,
  props: Option<PropsReads>,
  component_instances: Option<ComponentInstances>,
}

enum Outcome {
  Prepared(Box<PreparedFile>),
  /// A language may claim the file: JavaScript decides.
  NeedsJs,
  Unreadable,
  Skipped(String),
}

#[derive(Default)]
pub struct LoadResult {
  pub needs_js: Vec<String>,
  /// The files that do not parse, and why.
  pub skipped: Vec<(String, String)>,
}

fn prepare_module(code: &str, lang: Lang) -> Result<PreparedModule, String> {
  let ast = lower(code, lang)?;
  let specifiers = loaded_specifiers(&ast);
  let syntax = ModuleSyntax::of(&ast);

  Ok(PreparedModule {
    ast,
    specifiers,
    syntax,
  })
}

fn prepare_generated(code: &GeneratedCode) -> Result<PreparedModule, String> {
  let mut module = prepare_module(&code.code, code.lang)?;
  remap(&mut module.ast, &code.mappings, code.length);

  Ok(module)
}

fn plain_source(code: String) -> SourceFile {
  SourceFile {
    code: Arc::from(code),
    generated: false,
  }
}

fn prepare_script(file: &str, code: String) -> Outcome {
  let module = match prepare_module(&code, Lang::of_script(file)) {
    Ok(module) => module,
    Err(error) => return Outcome::Skipped(error),
  };

  Outcome::Prepared(Box::new(PreparedFile {
    source: plain_source(code),
    modules: vec![module],
    component_fields: Vec::new(),
    scope_objects: Vec::new(),
    props: None,
    component_instances: None,
  }))
}

/// A file's text; invalid UTF-8 is replaced, as Node replaces it.
pub fn read_text(file: &str) -> Option<String> {
  use std::io::Read;

  // Most sources fit: one read, and no call for the file's size.
  const FIRST_READ: usize = 16 * 1024;

  let mut source = std::fs::File::open(file).ok()?;
  let mut bytes: Vec<u8> = Vec::with_capacity(FIRST_READ);

  loop {
    let free = bytes.capacity() - bytes.len();
    let read = source
      .by_ref()
      .take(free as u64)
      .read_to_end(&mut bytes)
      .ok()?;

    // A file ends where a read gets less than it asks for.
    if read < free {
      break;
    }
    bytes.reserve(bytes.capacity());
  }

  Some(match String::from_utf8(bytes) {
    Ok(text) => text,
    Err(error) => String::from_utf8_lossy(error.as_bytes()).into_owned(),
  })
}

/// How many files are opened at once. macOS opens files one after the other
/// whatever asks: more threads opening only wait on each other, at full load.
#[cfg(target_os = "macos")]
const MAX_CONCURRENT_OPENS: usize = 4;

/// How many files a thread reads before it parses them: others read meanwhile.
const READ_BATCH: usize = 16;

/// Lets a bounded number of threads through at a time.
struct Gate {
  free: Mutex<usize>,
  freed: Condvar,
}

impl Gate {
  fn new(permits: usize) -> Self {
    Self {
      free: Mutex::new(permits),
      freed: Condvar::new(),
    }
  }

  fn lock(&self) -> std::sync::MutexGuard<'_, usize> {
    self
      .free
      .lock()
      .unwrap_or_else(|poisoned| poisoned.into_inner())
  }

  fn pass<T>(&self, work: impl FnOnce() -> T) -> T {
    let mut free = self.lock();
    while *free == 0 {
      free = self
        .freed
        .wait(free)
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    }
    *free -= 1;
    drop(free);

    let result = work();

    *self.lock() += 1;
    self.freed.notify_one();

    result
  }
}

/// The gate file reads go through; none where reads run side by side.
fn read_gate() -> Option<Gate> {
  #[cfg(target_os = "macos")]
  {
    Some(Gate::new(MAX_CONCURRENT_OPENS))
  }
  #[cfg(not(target_os = "macos"))]
  {
    None
  }
}

/// Reads the files of a batch that are read here, and makes each a script JavaScript could have read.
fn read_batch(requests: &mut [Request], gate: Option<&Gate>) {
  let read = |requests: &mut [Request]| {
    for request in requests {
      if matches!(request.input, Input::Read) {
        request.input = match read_text(&request.file) {
          Some(code) => Input::ReadScript { code },
          None => Input::Unreadable,
        };
      }
    }
  };

  let reads_any = requests
    .iter()
    .any(|request| matches!(request.input, Input::Read));

  match gate {
    Some(gate) if reads_any => gate.pass(|| read(requests)),
    _ => read(requests),
  }
}

fn prepare(request: &mut Request, detected: &[DetectedExtension]) -> Outcome {
  let file = request.file.as_str();

  match std::mem::replace(&mut request.input, Input::Unreadable) {
    Input::Read | Input::Unreadable => Outcome::Unreadable,

    Input::ReadScript { code } => {
      let may_be_claimed = detected.iter().any(|language| {
        file.ends_with(language.extension.as_str())
          && language
            .hints
            .iter()
            .all(|hint| code.contains(hint.as_str()))
      });
      if may_be_claimed {
        return Outcome::NeedsJs;
      }

      prepare_script(file, code)
    }

    Input::Script { code } => prepare_script(file, code),

    Input::Empty { code } => match prepare_module("", Lang::Js) {
      Ok(module) => Outcome::Prepared(Box::new(PreparedFile {
        source: plain_source(code),
        modules: vec![module],
        component_fields: Vec::new(),
        scope_objects: Vec::new(),
        props: None,
        component_instances: None,
      })),
      Err(error) => Outcome::Skipped(error),
    },

    Input::Generated { code, generated } => {
      let generated = *generated;
      let mut modules = Vec::with_capacity(1 + generated.scripts.len());

      for script in std::iter::once(&generated.main).chain(&generated.scripts) {
        match prepare_generated(script) {
          Ok(module) => modules.push(module),
          Err(error) => {
            return Outcome::Skipped(format!(
              "{} tooling produced unparsable code: {error}",
              generated.language
            ));
          }
        }
      }

      Outcome::Prepared(Box::new(PreparedFile {
        source: SourceFile {
          code: Arc::from(code),
          generated: true,
        },
        modules,
        component_fields: generated.component_fields,
        scope_objects: generated.scope_objects,
        props: generated.props,
        component_instances: generated.component_instances,
      }))
    }
  }
}

/// Reads and parses the files of `requests`, and adds their modules to the graph.
pub fn load(
  graph: &mut Graph,
  mut requests: Vec<Request>,
  detected: &[DetectedExtension],
) -> LoadResult {
  // Each file is loaded once.
  let mut seen = FxHashSet::default();
  requests.retain(|request| {
    let file = graph.file_id(&request.file);

    !graph.loading.contains(&file) && seen.insert(file)
  });

  let gate = read_gate();
  let outcomes: Vec<Outcome> = requests
    .par_chunks_mut(READ_BATCH)
    .flat_map_iter(|batch| {
      read_batch(batch, gate.as_ref());
      batch
        .iter_mut()
        .map(|request| prepare(request, detected))
        .collect::<Vec<_>>()
    })
    .collect();

  let mut result = LoadResult::default();
  let mut added = false;

  for (request, outcome) in requests.into_iter().zip(outcomes) {
    let file = graph.file_id(&request.file);

    match outcome {
      // JavaScript loads the file: it is not marked as loading here.
      Outcome::NeedsJs => result.needs_js.push(request.file),
      Outcome::Unreadable => {
        graph.loading.insert(file);
      }
      Outcome::Skipped(error) => {
        graph.loading.insert(file);
        result.skipped.push((request.file, error));
      }
      Outcome::Prepared(prepared) => {
        graph.loading.insert(file);
        add_file(graph, file, request.order, *prepared);
        added = true;
      }
    }
  }

  if added {
    graph.invalidate();
  }

  result
}

fn add_file(graph: &mut Graph, file: FileId, order: u64, prepared: PreparedFile) {
  let PreparedFile {
    source,
    modules,
    component_fields,
    scope_objects,
    props,
    component_instances,
  } = prepared;

  let source = Arc::new(source);
  let record_id = graph.modules.len() as ModuleId;
  let mut script_ids = Vec::new();

  let mut shared = Some((component_fields, scope_objects, props, component_instances));

  for (index, module) in modules.into_iter().enumerate() {
    let id = record_id + index as ModuleId;
    if index > 0 {
      script_ids.push(id);
    }

    // What the language says about the file is about its own module, not its scripts.
    let (mut component_fields, scope_objects, props, component_instances) =
      shared.take().unwrap_or_default();

    let mut specifiers = module.specifiers;
    for fields in &mut component_fields {
      let specifier = fields.specifier.as_str();
      if !specifier.is_empty() && !specifiers.iter().any(|known| &**known == specifier) {
        specifiers.push(specifier.into());
      }
    }

    graph.modules.push(Module {
      id,
      file,
      source: source.clone(),
      ast: module.ast,
      scope_objects,
      component_fields,
      props,
      component_instances,
      scripts: Vec::new(),
      specifiers,
      resolved: FxHashMap::default(),
      is_linked: false,
      syntax: module.syntax,
      cache: ModuleCache::default(),
    });
  }

  graph.modules[record_id as usize].scripts = script_ids;
  graph.records.insert(file, record_id);
  graph.order.insert(file, order);
}

/// The modules whose specifiers are not resolved yet.
pub fn unlinked(graph: &Graph) -> Vec<ModuleId> {
  graph
    .modules
    .iter()
    .filter(|module| !module.is_linked)
    .map(|module| module.id)
    .collect()
}

/// An import that did not resolve.
pub struct Unresolved {
  pub specifier: String,
  pub importer: String,
}

/// Resolves what the loaded modules load. Returns the imports that do not resolve, each once.
pub fn link(graph: &mut Graph, resolver: &NativeResolver) -> Vec<Unresolved> {
  let modules = unlinked(graph);

  let resolutions: Vec<Vec<Option<String>>> = modules
    .par_iter()
    .map(|&id| {
      let module = graph.module(id);
      let importer = graph.file(module.file);

      module
        .specifiers
        .iter()
        .map(|specifier| {
          // Builtins are never Paraglide.
          if resolver.is_builtin(specifier) {
            None
          } else {
            resolver.resolve(specifier, importer)
          }
        })
        .collect()
    })
    .collect();

  let mut unresolved = Vec::new();

  for (id, files) in modules.into_iter().zip(resolutions) {
    let specifiers = graph.module(id).specifiers.clone();
    let importer = graph.file(graph.module(id).file).to_string();
    let mut resolved = FxHashMap::default();

    for (specifier, file) in specifiers.iter().zip(files) {
      if file.is_none() && !resolver.is_builtin(specifier) {
        unresolved.push(Unresolved {
          specifier: specifier.to_string(),
          importer: importer.clone(),
        });
      }

      let file = file.map(|file| graph.file_id(&file));
      resolved.insert(specifier.clone(), file);
    }

    let module = &mut graph.modules[id as usize];
    module.resolved = resolved;
    module.is_linked = true;
  }

  graph.invalidate();

  unresolved
}

/// Records what JavaScript resolved the specifiers of the unlinked modules to, in their order.
pub fn link_with(graph: &mut Graph, modules: &[ModuleId], files: Vec<Option<String>>) {
  let mut files = files.into_iter();

  for &id in modules {
    let specifiers = graph.module(id).specifiers.clone();
    let mut resolved = FxHashMap::default();

    for specifier in specifiers {
      let file = files.next().flatten().map(|file| graph.file_id(&file));
      resolved.insert(specifier, file);
    }

    let module = &mut graph.modules[id as usize];
    module.resolved = resolved;
    module.is_linked = true;
  }

  graph.invalidate();
}
