use std::sync::{Arc, Condvar, Mutex};

use rayon::prelude::*;
use rustc_hash::{FxHashMap, FxHashSet};

use crate::{
  graph::{
    outdir_candidate, ComponentFields, ComponentInstances, FileId, Graph, Module, ModuleCache,
    ModuleId, PropsReads, SourceFile,
  },
  ir::Ast,
  languages::{builder::expression_at, Generated, Language, NativeLanguages, Skipped},
  lower::{lower, lower_located, Lang, SyntaxError},
  mapping::{remap, Mapping},
  resolve::NativeResolver,
  syntax::{loaded_specifiers, ModuleSyntax},
};

pub struct GeneratedCode {
  pub code: String,
  pub lang: Lang,
  pub mappings: Vec<Mapping>,
  /// The length of `code` in UTF-16 code units.
  pub length: usize,
}

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
  ReadScript {
    code: String,
  },
  Unreadable,
  /// A script that JavaScript read.
  Script {
    code: String,
  },
  /// A file that JavaScript read, which a language written here may claim, e.g. a Vue component.
  Source {
    code: String,
  },
  Generated {
    code: String,
    generated: Box<GeneratedSource>,
  },
  /// A file in a format that is not analyzed: a module without code of its own.
  Empty {
    code: String,
  },
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

/// Which languages claim which files.
#[derive(Default)]
pub struct Claims {
  /// The script extensions that a language of JavaScript's claims for some files.
  pub detected: Vec<DetectedExtension>,
  /// The languages whose files are written here.
  pub native: NativeLanguages,
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
  prepare_generated_located(code).map_err(|error| error.message)
}

fn prepare_generated_located(code: &GeneratedCode) -> Result<PreparedModule, SyntaxError> {
  let ast = lower_located(&code.code, code.lang)?;
  let specifiers = loaded_specifiers(&ast);
  let syntax = ModuleSyntax::of(&ast);
  let mut module = PreparedModule {
    ast,
    specifiers,
    syntax,
  };
  remap(&mut module.ast, &code.mappings, code.length);

  Ok(module)
}

/// As many template expressions of one file as are skipped before the file is.
const MAX_SKIPPED_EXPRESSIONS: usize = 20;

/// Writes a file of `language` and parses what is written. A template expression that does not
/// parse (a file being edited) is written as its fallback, and the rest of the file is analyzed;
/// a client script that does not parse is left out, of the modules and of what is returned.
fn generate_parsed(
  file: &str,
  code: &str,
  language: Language,
) -> Result<(GeneratedSource, Vec<PreparedModule>), String> {
  let mut skipped = Skipped::default();

  loop {
    let Generated {
      source: mut generated,
      expressions,
    } = language.generate(file, code, &skipped)?;

    let main = match prepare_generated_located(&generated.main) {
      Ok(main) => main,
      Err(error) => {
        let unparsable = error
          .offset
          .filter(|_| skipped.len() < MAX_SKIPPED_EXPRESSIONS)
          .and_then(|offset| expression_at(&expressions, &skipped, offset));

        match unparsable {
          Some(expression) => {
            skipped.insert(expression);
            continue;
          }
          None => {
            return Err(format!(
              "{} code does not parse: {}",
              language.name(),
              error.message
            ));
          }
        }
      }
    };

    let mut modules = Vec::with_capacity(1 + generated.scripts.len());
    modules.push(main);
    let mut scripts = Vec::with_capacity(generated.scripts.len());
    for script in std::mem::take(&mut generated.scripts) {
      if let Ok(module) = prepare_generated(&script) {
        modules.push(module);
        scripts.push(script);
      }
    }
    generated.scripts = scripts;

    return Ok((generated, modules));
  }
}

/// What the analysis writes for a file of `language`, as `generate_parsed` writes it.
pub fn generate_source(
  file: &str,
  code: &str,
  language: Language,
) -> Result<GeneratedSource, String> {
  generate_parsed(file, code, language).map(|(generated, _)| generated)
}

fn prepare_native(file: &str, code: String, language: Language, keep: bool) -> Outcome {
  let (generated, modules) = match generate_parsed(file, &code, language) {
    Ok(parsed) => parsed,
    Err(error) => return Outcome::Skipped(error),
  };

  Outcome::Prepared(Box::new(PreparedFile {
    source: SourceFile::new(code, true, keep),
    modules,
    component_fields: generated.component_fields,
    scope_objects: generated.scope_objects,
    props: generated.props,
    component_instances: generated.component_instances,
  }))
}

fn prepare_script(file: &str, code: String, keep: bool) -> Outcome {
  let module = match prepare_module(&code, Lang::of_script(file)) {
    Ok(module) => module,
    Err(error) => return Outcome::Skipped(error),
  };

  Outcome::Prepared(Box::new(PreparedFile {
    source: SourceFile::new(code, false, keep),
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

  const FIRST_READ: usize = 16 * 1024;

  let mut source = std::fs::File::open(file).ok()?;
  let mut bytes: Vec<u8> = Vec::with_capacity(FIRST_READ);
  let read = source
    .by_ref()
    .take(FIRST_READ as u64)
    .read_to_end(&mut bytes)
    .ok()?;

  if read == FIRST_READ {
    let size = source
      .metadata()
      .map_or(0, |metadata| metadata.len() as usize);
    bytes.reserve_exact(size.saturating_sub(bytes.len()));
    source.read_to_end(&mut bytes).ok()?;
  }

  Some(match String::from_utf8(bytes) {
    Ok(text) => text,
    Err(error) => String::from_utf8_lossy(error.as_bytes()).into_owned(),
  })
}

/// macOS serializes file opens, so more concurrent opens only wait on each other.
#[cfg(target_os = "macos")]
const MAX_CONCURRENT_OPENS: usize = 4;

const READ_BATCH: usize = 16;

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
    crate::unpoisoned(self.free.lock())
  }

  fn pass<T>(&self, work: impl FnOnce() -> T) -> T {
    let mut free = self.lock();
    while *free == 0 {
      free = crate::unpoisoned(self.freed.wait(free));
    }
    *free -= 1;
    drop(free);

    let result = work();

    *self.lock() += 1;
    self.freed.notify_one();

    result
  }
}

fn read_gate() -> Option<&'static Gate> {
  #[cfg(target_os = "macos")]
  {
    static GATE: std::sync::OnceLock<Gate> = std::sync::OnceLock::new();
    Some(GATE.get_or_init(|| Gate::new(MAX_CONCURRENT_OPENS)))
  }
  #[cfg(not(target_os = "macos"))]
  {
    None
  }
}

fn read_batch(requests: &mut [Request], outcomes: &[Option<Outcome>], gate: Option<&Gate>) {
  let is_read_here = |request: &Request, outcome: &Option<Outcome>| {
    outcome.is_none() && matches!(request.input, Input::Read)
  };

  let read = |requests: &mut [Request]| {
    for (request, outcome) in requests.iter_mut().zip(outcomes) {
      if is_read_here(request, outcome) {
        request.input = match read_text(&request.file) {
          Some(code) => Input::ReadScript { code },
          None => Input::Unreadable,
        };
      }
    }
  };

  let reads_any = requests
    .iter()
    .zip(outcomes)
    .any(|(request, outcome)| is_read_here(request, outcome));

  match gate {
    Some(gate) if reads_any => gate.pass(|| read(requests)),
    _ => read(requests),
  }
}

/// `keep`: the text of what JavaScript gave is kept, as it may not be on disk.
fn prepare(request: &mut Request, claims: &Claims, keep: bool) -> Outcome {
  let file = request.file.as_str();

  match std::mem::replace(&mut request.input, Input::Unreadable) {
    Input::Read | Input::Unreadable => Outcome::Unreadable,

    Input::ReadScript { code } => {
      if let Some(language) = claims.native.of(file, &code) {
        return prepare_native(file, code, language, false);
      }
      // Read here for a language whose tooling is JavaScript's.
      if !crate::languages::is_script(file) {
        return Outcome::NeedsJs;
      }

      let may_be_claimed = claims.detected.iter().any(|language| {
        file.ends_with(language.extension.as_str())
          && language
            .hints
            .iter()
            .all(|hint| code.contains(hint.as_str()))
      });
      if may_be_claimed {
        return Outcome::NeedsJs;
      }

      prepare_script(file, code, false)
    }

    Input::Script { code } => prepare_script(file, code, keep),

    Input::Source { code } => match claims.native.of(file, &code) {
      Some(language) => prepare_native(file, code, language, keep),
      None if crate::languages::is_script(file) => prepare_script(file, code, keep),
      None => prepare_empty(code, keep),
    },

    Input::Empty { code } => prepare_empty(code, keep),

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
        source: SourceFile::new(code, true, keep),
        modules,
        component_fields: generated.component_fields,
        scope_objects: generated.scope_objects,
        props: generated.props,
        component_instances: generated.component_instances,
      }))
    }
  }
}

/// A file in a format that is not analyzed: a module without code of its own.
fn prepare_empty(code: String, keep: bool) -> Outcome {
  match prepare_module("", Lang::Js) {
    Ok(module) => Outcome::Prepared(Box::new(PreparedFile {
      source: SourceFile::new(code, false, keep),
      modules: vec![module],
      component_fields: Vec::new(),
      scope_objects: Vec::new(),
      props: None,
      component_instances: None,
    })),
    Err(error) => Outcome::Skipped(error),
  }
}

fn read_and_prepare(
  requests: &mut [Request],
  outcomes: &mut [Option<Outcome>],
  claims: &Claims,
  keep: bool,
) {
  let gate = read_gate();

  crate::on_pool(|| {
    requests
      .par_chunks_mut(READ_BATCH)
      .zip(outcomes.par_chunks_mut(READ_BATCH))
      .for_each(|(batch, outcomes)| {
        read_batch(batch, outcomes, gate);
        for (request, outcome) in batch.iter_mut().zip(outcomes) {
          if outcome.is_none() {
            *outcome = Some(prepare(request, claims, keep));
          }
        }
      });
  });
}

/// Scripts read and parsed ahead of `load`, while JavaScript is still listing the project's files.
pub struct Prefetch {
  /// Which languages claim which files, as `load` is given them.
  claims: Arc<Claims>,
  state: Mutex<PrefetchState>,
  finished: Condvar,
}

#[derive(Default)]
struct PrefetchState {
  /// Batches being prepared.
  running: usize,
  prepared: FxHashMap<String, Outcome>,
}

impl Prefetch {
  pub fn new(claims: Arc<Claims>) -> Self {
    Prefetch {
      claims,
      state: Mutex::default(),
      finished: Condvar::new(),
    }
  }

  fn lock(&self) -> std::sync::MutexGuard<'_, PrefetchState> {
    crate::unpoisoned(self.state.lock())
  }

  /// Starts preparing `files` in the background, skipping any that may be Paraglide's output since
  /// outdirs are known only once every file is listed.
  pub fn start(self: &Arc<Self>, mut files: Vec<String>) {
    files.retain(|file| outdir_candidate(file).is_none());
    if files.is_empty() {
      return;
    }

    self.lock().running += 1;
    let prefetch = self.clone();

    rayon::spawn(move || {
      let mut requests: Vec<Request> = files
        .into_iter()
        .map(|file| Request {
          file,
          order: 0,
          input: Input::Read,
        })
        .collect();
      let mut outcomes: Vec<Option<Outcome>> = requests.iter().map(|_| None).collect();
      // A panic leaves files to their load.
      let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        read_and_prepare(&mut requests, &mut outcomes, &prefetch.claims, false)
      }));

      let mut state = prefetch.lock();
      for (request, outcome) in requests.into_iter().zip(outcomes) {
        if let Some(outcome) = outcome {
          state.prepared.insert(request.file, outcome);
        }
      }
      state.running -= 1;
      drop(state);
      prefetch.finished.notify_all();
    });
  }

  fn wait(&self) -> std::sync::MutexGuard<'_, PrefetchState> {
    let mut state = self.lock();
    while state.running > 0 {
      state = crate::unpoisoned(self.finished.wait(state));
    }
    state
  }

  fn take(&self, requests: &[Request]) -> Vec<Option<Outcome>> {
    let mut state = self.wait();

    requests
      .iter()
      .map(|request| match request.input {
        Input::Read => state.prepared.remove(&request.file),
        _ => None,
      })
      .collect()
  }

  /// Forgets what was prepared and not loaded, once it is prepared.
  pub fn clear(&self) {
    let leftovers = std::mem::take(&mut self.wait().prepared);
    drop(leftovers);
  }
}

/// Reads and parses `requests` into the graph, taking from `prefetch` those it prepared.
pub fn load(
  graph: &mut Graph,
  mut requests: Vec<Request>,
  claims: &Claims,
  prefetch: Option<&Prefetch>,
) -> LoadResult {
  let mut seen = FxHashSet::default();
  requests.retain(|request| {
    let file = graph.file_id(&request.file);

    !graph.loading.contains(&file) && seen.insert(file)
  });

  let mut outcomes = match prefetch {
    Some(prefetch) => prefetch.take(&requests),
    None => requests.iter().map(|_| None).collect(),
  };
  let keep = !graph.options.sources_on_disk;
  read_and_prepare(&mut requests, &mut outcomes, claims, keep);

  let mut result = LoadResult::default();
  let mut added = false;

  for (request, outcome) in requests.into_iter().zip(outcomes) {
    let file = graph.file_id(&request.file);

    match outcome.unwrap_or(Outcome::Unreadable) {
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

pub fn unlinked(graph: &Graph) -> Vec<ModuleId> {
  graph
    .modules
    .iter()
    .filter(|module| !module.is_linked)
    .map(|module| module.id)
    .collect()
}

pub struct Unresolved {
  pub specifier: String,
  pub importer: String,
}

/// Returns the imports that do not resolve, each once.
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

#[cfg(test)]
mod tests {
  use super::*;
  use crate::graph::GraphOptions;

  fn graph() -> Graph {
    Graph::new(GraphOptions {
      targets: Vec::new(),
      outdirs: Vec::new(),
      source_extensions: Vec::new(),
      sources_on_disk: true,
    })
  }

  fn read(file: &str) -> Request {
    Request {
      file: file.to_string(),
      order: 0,
      input: Input::Read,
    }
  }

  fn loaded(graph: &Graph, result: &LoadResult, files: &[String]) -> Vec<String> {
    files
      .iter()
      .map(|file| {
        if result.needs_js.contains(file) {
          return "needs JavaScript".to_string();
        }
        if let Some((_, error)) = result.skipped.iter().find(|(skipped, _)| skipped == file) {
          return format!("skipped: {error}");
        }
        match graph.known_file(file).and_then(|id| graph.record(id)) {
          Some(module) => format!(
            "{} nodes, {} specifiers, {} bytes",
            module.ast.nodes.len(),
            module.specifiers.len(),
            module.source.length()
          ),
          None => "not loaded".to_string(),
        }
      })
      .collect()
  }

  #[test]
  fn prefetched_files_load_as_files_read_then() {
    let root = std::env::temp_dir().join(format!("prefetch-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&root);
    let _ = std::fs::create_dir_all(root.join("directory.ts"));
    let write = |name: &str, code: &str| {
      let _ = std::fs::write(root.join(name), code);
      root.join(name).to_string_lossy().into_owned()
    };

    let files = vec![
      write(
        "a.ts",
        "import { m } from './paraglide/messages.js';\nexport const t = m.a();\n",
      ),
      write("b.tsx", "export const B = () => <p>{'b'}</p>;\n"),
      write("broken.ts", "export const = ;\n"),
      write(
        "component.ts",
        "@Component({ template: '' }) export class C {}\n",
      ),
      write("not-utf8.ts", "export const t = \"\u{fffd}\";\n"),
      root.join("directory.ts").to_string_lossy().into_owned(),
      root.join("missing.ts").to_string_lossy().into_owned(),
    ];
    let _ = std::fs::write(root.join("not-utf8.ts"), b"export const t = \"\xff\";\n");
    let detected = Arc::new(Claims {
      detected: vec![DetectedExtension {
        extension: ".ts".to_string(),
        hints: vec!["@Component".to_string()],
      }],
      native: NativeLanguages::default(),
    });

    let mut plain = graph();
    let result = load(
      &mut plain,
      files.iter().map(|file| read(file)).collect(),
      &detected,
      None,
    );
    let expected = loaded(&plain, &result, &files);
    assert!(
      expected
        .iter()
        .any(|outcome| outcome.starts_with("skipped")),
      "{expected:?}"
    );
    assert!(
      expected.contains(&"needs JavaScript".to_string()),
      "{expected:?}"
    );
    assert!(expected.contains(&"not loaded".to_string()), "{expected:?}");

    let prefetch = Arc::new(Prefetch::new(detected.clone()));
    let leftover = write("leftover.ts", "export {};\n");
    prefetch.start(files[..3].to_vec());
    prefetch.start([&files[3..], std::slice::from_ref(&leftover)].concat());

    let mut prefetched = graph();
    let result = load(
      &mut prefetched,
      files.iter().map(|file| read(file)).collect(),
      &detected,
      Some(&prefetch),
    );
    assert_eq!(loaded(&prefetched, &result, &files), expected);
    assert_eq!(prefetch.wait().prepared.len(), 1);
    prefetch.clear();
    assert!(prefetch.wait().prepared.is_empty());

    // A file JavaScript read keeps its own code, not the prefetched one.
    prefetch.start(vec![files[0].clone(), files[1].clone()]);
    let mut mixed = graph();
    let mut requests: Vec<Request> = files.iter().map(|file| read(file)).collect();
    requests[1].input = Input::Script {
      code: "export const other = 1;".to_string(),
    };
    let result = load(&mut mixed, requests, &detected, Some(&prefetch));
    let outcomes = loaded(&mixed, &result, &files);
    assert_eq!(outcomes[0], expected[0]);
    assert_ne!(outcomes[1], expected[1]);
    assert_eq!(outcomes[2..], expected[2..]);
    // The prefetched `b.tsx` was not taken: it was not read here.
    assert_eq!(prefetch.wait().prepared.len(), 1);

    let _ = std::fs::remove_dir_all(&root);
  }

  #[test]
  fn files_that_may_be_paraglides_are_not_prefetched() {
    let root = std::env::temp_dir().join(format!("prefetch-outdir-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&root);
    let _ = std::fs::create_dir_all(root.join("paraglide/messages"));
    let files: Vec<String> = [
      "app.ts",
      "paraglide/runtime.js",
      "paraglide/server.js",
      "paraglide/messages.js",
      "paraglide/messages/_index.js",
      "paraglide/messages/hello.js",
    ]
    .iter()
    .map(|name| {
      let _ = std::fs::write(root.join(name), "export const a = 1;\n");
      root.join(name).to_string_lossy().into_owned()
    })
    .collect();

    let prefetch = Arc::new(Prefetch::new(Arc::default()));
    prefetch.start(files.clone());

    let prepared: Vec<String> = prefetch.wait().prepared.keys().cloned().collect();
    assert_eq!(prepared, vec![files[0].clone()]);

    let _ = std::fs::remove_dir_all(&root);
  }
}
