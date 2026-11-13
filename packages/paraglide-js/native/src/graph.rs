use std::{
  borrow::Cow,
  sync::{Arc, OnceLock, RwLock},
};

use rustc_hash::{FxHashMap, FxHashSet};

use crate::{
  call_sites::{CallSite, CallSiteIndex, Candidate},
  component_fields::FieldScope,
  importers::{Dependents, Links},
  ir::{Ast, NodeId},
  paths::{basename, dirname, is_within, relative_within, to_posix},
  scope::CachedBinding,
  syntax::{CommonJsExports, ModuleSyntax},
};

pub type ModuleId = u32;
pub type FileId = u32;

/// A class whose fields a template reads undeclared.
#[derive(Clone, Debug)]
pub struct ComponentFields {
  /// The module that declares the class, relative to the file; "" for the file.
  pub specifier: String,
  pub class_name: Option<String>,
  /// The part of the file that reads the fields; none for the whole file.
  pub range: Option<(i32, i32)>,
}

/// Where a component reads the props its call sites pass.
#[derive(Clone, Debug, Default)]
pub struct PropsReads {
  pub calls: Vec<String>,
  pub members: Vec<String>,
  pub variables: Vec<i32>,
  pub undeclared: bool,
}

#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
pub enum InstantiationSyntax {
  New,
  Call,
}

#[derive(Clone, Debug)]
pub struct ComponentInstances {
  pub via: InstantiationSyntax,
  pub path: Vec<Arc<str>>,
}

pub struct SourceFile {
  pub text: SourceText,
  /// Written by a language's tooling: nodes that are not in the file are at -1.
  pub generated: bool,
}

/// A file's text, kept only when it cannot be read again: most of a project's code is needed once
/// it is parsed only for the lines around usages.
pub enum SourceText {
  Kept(String),
  OnDisk { length: usize, hash: u64 },
}

impl SourceFile {
  pub fn new(code: String, generated: bool, keep: bool) -> Self {
    let text = if keep {
      SourceText::Kept(code)
    } else {
      SourceText::OnDisk {
        length: code.len(),
        hash: text_hash(&code),
      }
    };

    Self { text, generated }
  }

  /// In UTF-8 bytes.
  pub fn length(&self) -> usize {
    match &self.text {
      SourceText::Kept(code) => code.len(),
      SourceText::OnDisk { length, .. } => *length,
    }
  }

  /// The text `path` had when it was loaded; none if it changed since, or cannot be read.
  pub fn text(&self, path: &str) -> Option<Cow<'_, str>> {
    match &self.text {
      SourceText::Kept(code) => Some(Cow::Borrowed(code)),
      SourceText::OnDisk { length, hash } => {
        let code = crate::load::read_text(path)?;
        let is_same = code.len() == *length && text_hash(&code) == *hash;

        is_same.then_some(Cow::Owned(code))
      }
    }
  }
}

fn text_hash(text: &str) -> u64 {
  use std::hash::BuildHasher;

  rustc_hash::FxBuildHasher.hash_one(text)
}

/// A module: a file's, or one of the other modules in the same file, e.g. an Astro page's client scripts.
pub struct Module {
  pub id: ModuleId,
  pub file: FileId,
  pub source: Arc<SourceFile>,
  pub ast: Ast,
  pub scope_objects: Vec<String>,
  pub component_fields: Vec<ComponentFields>,
  pub props: Option<PropsReads>,
  pub component_instances: Option<ComponentInstances>,
  /// The file's other modules, for the file's own module.
  pub scripts: Vec<ModuleId>,
  /// The specifiers of every module it loads values from, in the order they appear.
  pub specifiers: Vec<Box<str>>,
  pub resolved: FxHashMap<Box<str>, Option<FileId>>,
  pub is_linked: bool,
  pub syntax: ModuleSyntax,
  pub cache: ModuleCache,
}

impl Module {
  #[inline]
  pub fn resolved_file(&self, specifier: &str) -> Option<FileId> {
    self.resolved.get(specifier).copied().flatten()
  }
}

/// Derived from a module and the graph around it, so emptied when the graph changes.
#[derive(Default)]
pub struct ModuleCache {
  pub bindings: OnceLock<Vec<OnceLock<CachedBinding>>>,
  pub field_scopes: OnceLock<Vec<FieldScope>>,
  pub call_sites: OnceLock<CallSiteIndex>,
  pub new_instances: OnceLock<CallSiteIndex>,
  pub call_instances: OnceLock<CallSiteIndex>,
  pub links: OnceLock<Links>,
  pub commonjs: OnceLock<Option<CommonJsExports>>,
  pub component_props: OnceLock<Vec<Candidate>>,
  pub call_sites_of: RwLock<FxHashMap<NodeId, Arc<[CallSite]>>>,
  /// The names each function of the module is exported under.
  pub function_exports: OnceLock<FxHashMap<NodeId, Vec<Box<str>>>>,
}

pub struct TargetFile {
  /// Absolute, with forward slashes.
  pub file: String,
  /// The Paraglide outdir containing the file.
  pub outdir: Option<String>,
  /// Relative to `outdir`, e.g. "messages.js".
  pub outdir_path: Option<String>,
}

#[derive(Clone, Copy)]
pub enum TargetKind {
  /// `messages.js` (with the `m` namespace) and every module in `messages/`.
  Messages,
  /// Defined in JavaScript, which says what it matches and exports.
  Custom,
}

#[derive(Clone)]
pub struct Target {
  pub name: Arc<str>,
  pub kind: TargetKind,
}

#[derive(Clone, Copy, Debug)]
pub struct TargetMatch {
  pub target: u32,
  /// The file is an outdir's `messages.js`, whose `m` is the messages' namespace.
  pub is_messages_module: bool,
}

/// A name every module can use without importing it.
pub struct Global {
  pub name: String,
  pub file: FileId,
  /// "*" for the module namespace.
  pub export_name: String,
}

#[derive(Default)]
pub struct GraphCache {
  pub targets: Vec<OnceLock<Option<TargetMatch>>>,
  /// The names each file exports, by file; `None` when they are unknown.
  pub export_names: Vec<OnceLock<Option<FxHashSet<Box<str>>>>>,
  pub dependents: OnceLock<Dependents>,
  pub all: OnceLock<Vec<ModuleId>>,
}

impl GraphCache {
  /// For the files known now: what is asked about a later one is worked out each time.
  fn new(files: usize) -> Self {
    let mut cache = Self::default();
    cache.targets.resize_with(files, OnceLock::new);
    cache.export_names.resize_with(files, OnceLock::new);

    cache
  }
}

#[derive(Clone)]
pub struct GraphOptions {
  pub targets: Vec<Target>,
  /// Outdirs that are used without verification.
  pub outdirs: Vec<String>,
  /// The extensions of the formats that are followed besides scripts, e.g. ".vue".
  pub source_extensions: Vec<String>,
  /// What JavaScript gives is what is on disk: its text is read again when needed, not kept.
  pub sources_on_disk: bool,
}

pub struct Graph {
  pub options: GraphOptions,

  pub files: Vec<Box<str>>,
  file_ids: FxHashMap<Box<str>, FileId>,

  pub modules: Vec<Module>,
  /// Each file's own module.
  pub records: FxHashMap<FileId, ModuleId>,
  /// The position of each record among the loaded ones.
  pub order: FxHashMap<FileId, u64>,
  /// Files whose load was started: each is read once.
  pub loading: FxHashSet<FileId>,

  /// Longest first, so that a nested outdir wins over its parent.
  pub outdirs: Vec<String>,
  outdir_detections: FxHashSet<String>,

  pub globals: Vec<Global>,
  pub globals_by_name: FxHashMap<Box<str>, u32>,

  /// What the custom targets match, by file, for the outdirs known when it was asked.
  pub custom_matches: FxHashMap<FileId, Option<u32>>,

  pub cache: GraphCache,
}

const GENERATED_FILES: [&str; 4] = ["messages.js", "runtime.js", "server.js", "registry.js"];

impl Graph {
  pub fn new(options: GraphOptions) -> Self {
    let mut graph = Self {
      options,
      files: Vec::new(),
      file_ids: FxHashMap::default(),
      modules: Vec::new(),
      records: FxHashMap::default(),
      order: FxHashMap::default(),
      loading: FxHashSet::default(),
      outdirs: Vec::new(),
      outdir_detections: FxHashSet::default(),
      globals: Vec::new(),
      globals_by_name: FxHashMap::default(),
      custom_matches: FxHashMap::default(),
      cache: GraphCache::default(),
    };

    for outdir in graph.options.outdirs.clone() {
      graph.add_outdir(&outdir);
    }

    graph
  }

  /// Empties the graph and returns what it held: it is then as new, with the
  /// same targets and the outdirs it knows.
  pub fn take(&mut self) -> Graph {
    let options = GraphOptions {
      targets: self.options.targets.clone(),
      // The outdirs it knows, verified or not: none is added again.
      outdirs: Vec::new(),
      source_extensions: self.options.source_extensions.clone(),
      sources_on_disk: self.options.sources_on_disk,
    };
    let mut emptied = Graph::new(options);
    emptied.outdirs = std::mem::take(&mut self.outdirs);
    emptied.outdir_detections = std::mem::take(&mut self.outdir_detections);

    std::mem::replace(self, emptied)
  }

  // ---------------------------------------------------------------- files

  pub fn file_id(&mut self, file: &str) -> FileId {
    if let Some(&id) = self.file_ids.get(file) {
      return id;
    }

    let id = self.files.len() as FileId;
    self.files.push(file.into());
    self.file_ids.insert(file.into(), id);

    id
  }

  pub fn known_file(&self, file: &str) -> Option<FileId> {
    self.file_ids.get(file).copied()
  }

  #[inline]
  pub fn file(&self, id: FileId) -> &str {
    &self.files[id as usize]
  }

  #[inline]
  pub fn module(&self, id: ModuleId) -> &Module {
    &self.modules[id as usize]
  }

  /// The file's own module; its scripts are in `Module::scripts`.
  pub fn record(&self, file: FileId) -> Option<&Module> {
    self.records.get(&file).map(|&id| self.module(id))
  }

  /// A file's module, then its scripts.
  pub fn modules_of(&self, record: &Module) -> impl Iterator<Item = ModuleId> + '_ {
    std::iter::once(record.id).chain(record.scripts.clone())
  }

  /// Every module in loading order, a file's scripts after its module.
  pub fn all(&self) -> &[ModuleId] {
    self.cache.all.get_or_init(|| {
      let mut records: Vec<(u64, ModuleId)> = self
        .records
        .iter()
        .map(|(file, &module)| (self.order[file], module))
        .collect();
      records.sort_unstable();

      let mut all = Vec::with_capacity(self.modules.len());
      for (_, id) in records {
        all.push(id);
        all.extend(self.module(id).scripts.iter().copied());
      }

      all
    })
  }

  /// Must be called when the graph changes, since the derived data describes the graph as it was.
  pub fn invalidate(&mut self) {
    self.cache = GraphCache::new(self.files.len());

    for module in &mut self.modules {
      module.cache = ModuleCache::default();
    }
  }

  // ---------------------------------------------------------------- outdirs

  /// The directories that may be the outdirs of `files` and were not asked about yet.
  pub fn outdir_candidates(&mut self, files: &[String]) -> Vec<String> {
    let mut candidates = Vec::new();

    for file in files {
      if let Some(directory) = outdir_candidate(file) {
        if self.outdir_detections.insert(directory.to_string()) {
          candidates.push(directory.to_string());
        }
      }
    }

    candidates
  }

  pub fn add_outdir(&mut self, directory: &str) {
    if self.outdirs.iter().any(|outdir| outdir == directory) {
      return;
    }

    self.outdirs.push(directory.to_string());
    // Stable: outdirs of the same length stay in the order they were found.
    self
      .outdirs
      .sort_by_key(|outdir| std::cmp::Reverse(crate::positions::utf16_length(outdir)));

    self.custom_matches.clear();
    self.invalidate();
  }

  pub fn is_generated(&self, file: &str) -> bool {
    self.outdirs.iter().any(|outdir| is_within(outdir, file))
  }

  // ---------------------------------------------------------------- targets

  pub fn has_custom_targets(&self) -> bool {
    self
      .options
      .targets
      .iter()
      .any(|target| matches!(target.kind, TargetKind::Custom))
  }

  pub fn target_file(&self, file: &str) -> TargetFile {
    let outdir = self
      .outdirs
      .iter()
      .find(|directory| is_within(directory, file));

    TargetFile {
      file: to_posix(file).into_owned(),
      outdir: outdir.map(|outdir| to_posix(outdir).into_owned()),
      outdir_path: outdir.and_then(|outdir| relative_within(outdir, file).map(Cow::into_owned)),
    }
  }

  /// Where `file` is in its outdir, the innermost: `messages.js`, `messages/en.js`.
  fn outdir_path<'f>(&self, file: &'f str) -> Option<Cow<'f, str>> {
    self
      .outdirs
      .iter()
      .find_map(|outdir| relative_within(outdir, file))
  }

  /// The index of the file's target.
  pub fn target_of(&self, file: FileId) -> Option<u32> {
    self.target_match(file).map(|found| found.target)
  }

  pub fn target_match(&self, file: FileId) -> Option<TargetMatch> {
    match self.cache.targets.get(file as usize) {
      Some(target) => *target.get_or_init(|| self.find_target(file)),
      None => self.find_target(file),
    }
  }

  /// Builds what every module's analysis reads, and must not be called from a thread of the pool,
  /// which it runs on.
  pub fn prepare(&mut self) {
    if self.cache.targets.len() < self.files.len() {
      self.invalidate();
    }

    self.all();
    crate::importers::prepare_dependents(self);
  }

  /// The last one, so that `[...defaultTargets, custom]` overrides a built-in target.
  fn find_target(&self, file: FileId) -> Option<TargetMatch> {
    let outdir_path = self.outdir_path(self.file(file));
    let outdir_path = outdir_path.as_deref().unwrap_or("");

    let native = self
      .options
      .targets
      .iter()
      .rposition(|target| match &target.kind {
        TargetKind::Messages => {
          outdir_path == "messages.js"
            || (outdir_path.starts_with("messages/") && outdir_path.ends_with(".js"))
        }
        TargetKind::Custom => false,
      });
    let custom = self.custom_matches.get(&file).copied().flatten();

    let target = match (native, custom) {
      (Some(native), Some(custom)) => Some((native as u32).max(custom)),
      (Some(native), None) => Some(native as u32),
      (None, custom) => custom,
    };

    target.map(|target| TargetMatch {
      target,
      is_messages_module: outdir_path == "messages.js",
    })
  }

  /// Whether to parse a module to follow its exports: a file of the app, in a format that is analyzed.
  pub fn should_follow(&self, file: FileId) -> bool {
    let path = self.file(file);

    self.target_of(file).is_none() && self.is_app_source(path) && !self.is_generated(path)
  }

  pub fn is_app_source(&self, file: &str) -> bool {
    self.is_source_file(file) && !crate::paths::is_dependency(file)
  }

  pub fn is_source_file(&self, file: &str) -> bool {
    if crate::paths::is_script(file) {
      return true;
    }

    !crate::paths::is_declaration_file(file)
      && self
        .options
        .source_extensions
        .iter()
        .any(|extension| file.ends_with(extension.as_str()))
  }

  // ---------------------------------------------------------------- globals

  pub fn set_globals(&mut self, globals: Vec<(String, String, String)>) {
    self.globals.clear();
    self.globals_by_name.clear();

    for (name, file, export_name) in globals {
      if self.globals_by_name.contains_key(name.as_str()) {
        continue;
      }

      let file = self.file_id(&file);
      self
        .globals_by_name
        .insert(name.as_str().into(), self.globals.len() as u32);
      self.globals.push(Global {
        name,
        file,
        export_name,
      });
    }

    self.invalidate();
  }

  // ---------------------------------------------------------------- dependencies

  /// The files that the modules of `files` load, each once, in the order they are loaded.
  pub fn dependencies_of(&self, files: &[FileId]) -> Vec<FileId> {
    let mut seen = FxHashSet::default();
    let mut dependencies = Vec::new();

    for file in files {
      let Some(record) = self.record(*file) else {
        continue;
      };

      for id in self.modules_of(record) {
        let module = self.module(id);

        for specifier in &module.specifiers {
          if let Some(Some(dependency)) = module.resolved.get(specifier) {
            if seen.insert(*dependency) {
              dependencies.push(*dependency);
            }
          }
        }
      }
    }

    dependencies
  }
}

/// `…/paraglide/runtime.js` → `…/paraglide`; `…/paraglide/messages/a.js` and
/// Paraglide 1's `…/paraglide/messages/en/a.js` → `…/paraglide`
pub fn outdir_candidate(file: &str) -> Option<&str> {
  let parent = dirname(file);
  if GENERATED_FILES.contains(&basename(file)) {
    return Some(parent);
  }

  let grandparent = dirname(parent);

  [parent, grandparent]
    .into_iter()
    .find(|directory| basename(directory) == "messages")
    .map(dirname)
}

/// For tests: a graph of one script, whose every import resolves to an outdir's `messages.js`.
#[cfg(test)]
pub fn script_graph(file: &str, code: String) -> Graph {
  use crate::load::{link_with, load, unlinked, Input, Request};

  let mut graph = Graph::new(GraphOptions {
    targets: vec![Target {
      name: "message".into(),
      kind: TargetKind::Messages,
    }],
    outdirs: vec!["/app/src/paraglide".into()],
    source_extensions: Vec::new(),
    sources_on_disk: false,
  });
  let request = Request {
    file: file.to_string(),
    order: 0,
    input: Input::Script { code },
  };
  load(&mut graph, vec![request], &[], None);

  let modules = unlinked(&graph);
  let specifiers = modules
    .iter()
    .map(|&id| graph.module(id).specifiers.len())
    .sum();
  let messages = Some("/app/src/paraglide/messages.js".to_string());
  link_with(&mut graph, &modules, vec![messages; specifiers]);
  graph.prepare();

  graph
}

#[cfg(test)]
pub fn module_of<'g>(graph: &'g Graph, file: &str) -> &'g Module {
  let file = graph.known_file(file).unwrap_or_default();
  graph.module(
    graph
      .record(file)
      .map(|record| record.id)
      .unwrap_or_default(),
  )
}
