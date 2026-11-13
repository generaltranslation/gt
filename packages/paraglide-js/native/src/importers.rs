use std::sync::Arc;

use rayon::prelude::*;
use rustc_hash::{FxHashMap, FxHashSet};

use crate::{
  call_sites::{
    argument_of, call_sites_in, component_instances_in, follow_candidate, CallSite, CallSiteIndex,
    Candidate, Site, SiteKind,
  },
  graph::{FileId, Graph, Module, ModuleId},
  ir::{self, Ast, Kind, NodeId, Slot},
  scope::{binding_of, Declaration},
  syntax::{declared_names, import_of, imported_name, module_export_name, unwrap_expression},
};

struct ExportedNames<'a> {
  file: FileId,
  names: Vec<&'a str>,
}

struct Referrers {
  /// In loading order.
  modules: Vec<ModuleId>,
  /// The auto-imported names that stand for the exports.
  globals: Vec<u32>,
  /// The exporting module and every module that may re-export from it.
  exporters: FxHashSet<FileId>,
  /// The names the exports can have in `exporters`, which may rename them.
  exported_as: FxHashSet<Box<str>>,
}

struct Rename {
  imported: Box<str>,
  exported: Box<str>,
}

#[derive(Default)]
pub struct Links {
  /// Each specifier of an import of values, with the file it imports from, in order.
  value_imports: Vec<(FileId, NodeId)>,
  imported_names: Vec<(FileId, Box<str>)>,
  imported_namespaces: Vec<FileId>,
  reexported: Vec<FileId>,
  renames: Vec<Rename>,
}

pub struct Dependents {
  /// The position of each module in loading order, by module.
  loading_order: Vec<u32>,
  shards: Vec<DependentsShard>,
}

#[derive(Default)]
struct DependentsShard {
  /// By file, then by export name.
  importers: FxHashMap<FileId, FxHashMap<Box<str>, Vec<ModuleId>>>,
  namespace_importers: FxHashMap<FileId, Vec<ModuleId>>,
  reexporters: FxHashMap<FileId, Vec<ModuleId>>,
}

impl Dependents {
  fn shard(&self, file: FileId) -> &DependentsShard {
    &self.shards[file as usize % self.shards.len()]
  }

  fn importers(&self, file: FileId) -> Option<&FxHashMap<Box<str>, Vec<ModuleId>>> {
    self.shard(file).importers.get(&file)
  }

  fn namespace_importers(&self, file: FileId) -> &[ModuleId] {
    self
      .shard(file)
      .namespace_importers
      .get(&file)
      .map_or(&[], Vec::as_slice)
  }

  fn reexporters(&self, file: FileId) -> &[ModuleId] {
    self
      .shard(file)
      .reexporters
      .get(&file)
      .map_or(&[], Vec::as_slice)
  }
}

enum IndexKind {
  CallSites,
  Instances(crate::graph::InstantiationSyntax),
}

fn index_of<'g>(graph: &'g Graph, module: &'g Module, kind: &IndexKind) -> &'g CallSiteIndex {
  match kind {
    IndexKind::CallSites => call_sites_in(graph, module),
    IndexKind::Instances(syntax) => component_instances_in(graph, module, *syntax),
  }
}

/// The call sites of a function of `record`, in its module and the modules that import it, found
/// once when first asked for.
pub fn call_sites_of(graph: &Graph, record: &Module, function: NodeId) -> Arc<[CallSite]> {
  let known = crate::unpoisoned(record.cache.call_sites_of.read())
    .get(&function)
    .cloned();
  if let Some(sites) = known {
    return sites;
  }

  if !record.ast.kind(function).is_function() {
    return Arc::from([]);
  }

  // Found outside the lock, since finding them asks about other functions.
  let sites: Arc<[CallSite]> = find_call_sites(graph, record, function).into();
  crate::unpoisoned(record.cache.call_sites_of.write())
    .entry(function)
    .or_insert(sites)
    .clone()
}

fn find_call_sites(graph: &Graph, record: &Module, function: NodeId) -> Vec<CallSite> {
  let own = call_sites_in(graph, record)
    .by_declaration
    .get(&Declaration::Node(function));
  let mut sites: Vec<CallSite> = own
    .into_iter()
    .flatten()
    .map(|&site| CallSite {
      module: record.id,
      site,
      imported: false,
    })
    .collect();

  let names = export_names_of(graph, record, function);
  if names.is_empty() {
    return sites;
  }

  let exported = ExportedNames {
    file: record.file,
    names,
  };
  let referrers = referrers_of(graph, &exported);

  for &importer in &referrers.modules {
    if importer == record.id {
      continue;
    }

    sites_in(
      graph,
      graph.module(importer),
      &exported,
      &referrers,
      &IndexKind::CallSites,
      &mut sites,
    );
  }

  sites
}

/// The props each module that imports `record`'s component renders it with.
pub fn component_props<'g>(graph: &'g Graph, record: &'g Module) -> &'g [Candidate] {
  record.cache.component_props.get_or_init(|| {
    {
      let component = ExportedNames {
        file: record.file,
        names: vec!["default"],
      };
      let referrers = referrers_of(graph, &component);
      let mut props = Vec::new();

      for &importer_id in &referrers.modules {
        if importer_id == record.id {
          continue;
        }

        let importer = graph.module(importer_id);

        let mut sites = Vec::new();
        sites_in(
          graph,
          importer,
          &component,
          &referrers,
          &IndexKind::CallSites,
          &mut sites,
        );
        for site in &sites {
          if site.site.kind == SiteKind::Jsx {
            props.extend(argument_of(graph, site, 0));
          }
        }

        // The components a language tool's generated code instantiates: `new Label({ props })`.
        let Some(instances) = &importer.component_instances else {
          continue;
        };

        let mut sites = Vec::new();
        let kind = IndexKind::Instances(instances.via);
        sites_in(graph, importer, &component, &referrers, &kind, &mut sites);
        for site in &sites {
          if let Some(options) = argument_of(graph, site, 0) {
            props.push(follow_candidate(options, &instances.path));
          }
        }
      }

      props
    }
  })
}

fn referrers_of(graph: &Graph, exported: &ExportedNames) -> Referrers {
  let dependents = dependents(graph);
  let (exporters, exported_as) = reexports_of(graph, exported, dependents);

  let globals: Vec<u32> = graph
    .globals
    .iter()
    .enumerate()
    .filter(|(_, global)| {
      // `*` is the module's namespace, which stands for no single export.
      global.export_name != "*"
        && exporters.contains(&global.file)
        && is_exported(
          graph,
          global.file,
          &global.export_name,
          exported,
          &exporters,
          &mut FxHashSet::default(),
        )
    })
    .map(|(index, _)| index as u32)
    .collect();

  let is_usable_without_import = !globals.is_empty();
  let modules = if is_usable_without_import {
    graph.all().to_vec()
  } else {
    importers_of(&exporters, &exported_as, dependents)
  };

  Referrers {
    modules,
    globals,
    exporters,
    exported_as,
  }
}

fn sites_in(
  graph: &Graph,
  importer: &Module,
  exported: &ExportedNames,
  referrers: &Referrers,
  kind: &IndexKind,
  out: &mut Vec<CallSite>,
) {
  let ast = &importer.ast;
  let imports = &links_of(importer).value_imports;
  if imports.is_empty() && referrers.globals.is_empty() {
    return;
  }

  let index = index_of(graph, importer, kind);
  let mut add = |sites: Option<&Vec<Site>>| {
    for &site in sites.into_iter().flatten() {
      out.push(CallSite {
        module: importer.id,
        site,
        imported: true,
      });
    }
  };

  for &global in &referrers.globals {
    add(index.by_declaration.get(&Declaration::Global(global)));
  }

  for &(from, specifier) in imports {
    if !referrers.exporters.contains(&from) {
      continue;
    }

    let is_exported_name = |name: &str| {
      referrers.exported_as.contains(name)
        && is_exported(
          graph,
          from,
          name,
          exported,
          &referrers.exporters,
          &mut FxHashSet::default(),
        )
    };

    if ast.kind(specifier) != Kind::ImportNamespaceSpecifier {
      if is_exported_name(imported_name(ast, specifier)) {
        add(index.by_declaration.get(&Declaration::Node(specifier)));
      }
      continue;
    }

    let Some(sites_by_member) = index.by_namespace_member.get(&specifier) else {
      continue;
    };

    let mut members: Vec<(&Box<str>, &Vec<Site>)> = sites_by_member.iter().collect();
    members.sort_by_key(|(_, sites)| sites.first().map(|site| site.node));

    for (member, sites) in members {
      if is_exported_name(member) {
        add(Some(sites));
      }
    }
  }
}

/// Whether `file`'s export `name` is one of `exported` through `export { f } from`, `export *` or
/// `import { f } …; export { f }`, reading only `exporters`.
fn is_exported(
  graph: &Graph,
  file: FileId,
  name: &str,
  exported: &ExportedNames,
  exporters: &FxHashSet<FileId>,
  seen: &mut FxHashSet<(FileId, Box<str>)>,
) -> bool {
  if file == exported.file {
    return exported.names.contains(&name);
  }

  let Some(record) = graph.record(file) else {
    return false;
  };
  if !seen.insert((file, name.into())) {
    return false;
  }

  let ast = &record.ast;
  let is_exported_by = |specifier: &str, export_name: &str, seen: &mut FxHashSet<_>| match record
    .resolved_file(specifier)
  {
    Some(from) if exporters.contains(&from) => {
      is_exported(graph, from, export_name, exported, exporters, seen)
    }
    _ => false,
  };
  let source_of = |statement: NodeId| crate::syntax::source_of(ast, statement);

  for statement in ast.children(0) {
    match ast.kind(statement) {
      Kind::ExportAllDeclaration => {
        let reexports_name = ast.child(statement, Slot::Exported).is_none() && name != "default";
        if let (true, Some(source)) = (reexports_name, source_of(statement)) {
          if is_exported_by(source, name, seen) {
            return true;
          }
        }
        continue;
      }
      Kind::ExportNamedDeclaration if !ast.has(statement, ir::TYPE_ONLY) => {}
      _ => continue,
    }

    let specifier = ast
      .children_in(statement, Slot::Specifier)
      .find(|&candidate| {
        ast
          .child(candidate, Slot::Exported)
          .is_some_and(|exported| module_export_name(ast, exported) == name)
      });
    let Some(specifier) = specifier else { continue };
    let Some(local) = ast
      .child(specifier, Slot::Local)
      .map(|local| module_export_name(ast, local))
    else {
      continue;
    };

    if let Some(source) = source_of(statement) {
      return is_exported_by(source, local, seen);
    }

    return match import_of(ast, local) {
      Some((source, imported)) => is_exported_by(source, imported, seen),
      None => false,
    };
  }

  false
}

fn dependents(graph: &Graph) -> &Dependents {
  // `Graph::prepare` builds it on every core; this is for a graph that was not prepared.
  graph
    .cache
    .dependents
    .get_or_init(|| build_dependents(graph, false))
}

/// Builds who imports each file on every core, before any analysis would wait on one thread building it.
pub fn prepare_dependents(graph: &Graph) {
  if graph.cache.dependents.get().is_none() {
    let _ = graph.cache.dependents.set(build_dependents(graph, true));
  }
}

fn build_dependents(graph: &Graph, parallel: bool) -> Dependents {
  let all = graph.all();

  let mut loading_order = vec![u32::MAX; graph.modules.len()];
  for (order, &id) in all.iter().enumerate() {
    loading_order[id as usize] = order as u32;
  }

  let build_shard = |shard: usize, count: usize| {
    let mut built = DependentsShard::default();
    let is_in_shard = |file: FileId| file as usize % count == shard;

    for &id in all {
      let links = links_of(graph.module(id));

      for (file, name) in &links.imported_names {
        if !is_in_shard(*file) {
          continue;
        }

        let by_name = built.importers.entry(*file).or_default();
        match by_name.get_mut(name) {
          Some(importers) => importers.push(id),
          None => {
            by_name.insert(name.clone(), vec![id]);
          }
        }
      }
      for &file in &links.imported_namespaces {
        if is_in_shard(file) {
          built.namespace_importers.entry(file).or_default().push(id);
        }
      }
      for &file in &links.reexported {
        if is_in_shard(file) {
          built.reexporters.entry(file).or_default().push(id);
        }
      }
    }

    built
  };

  let shards = if parallel {
    all.par_iter().for_each(|&id| {
      links_of(graph.module(id));
    });

    let count = rayon::current_num_threads().max(1);
    (0..count)
      .into_par_iter()
      .map(|shard| build_shard(shard, count))
      .collect()
  } else {
    vec![build_shard(0, 1)]
  };

  Dependents {
    loading_order,
    shards,
  }
}

fn importers_of(
  exporters: &FxHashSet<FileId>,
  exported_as: &FxHashSet<Box<str>>,
  dependents: &Dependents,
) -> Vec<ModuleId> {
  let mut found: FxHashSet<ModuleId> = FxHashSet::default();

  for &file in exporters {
    found.extend(dependents.namespace_importers(file));

    if let Some(importers_by_name) = dependents.importers(file) {
      for name in exported_as {
        found.extend(importers_by_name.get(name).into_iter().flatten());
      }
    }
  }

  let mut importers: Vec<ModuleId> = found.into_iter().collect();
  importers.sort_by_key(|&importer| dependents.loading_order[importer as usize]);

  importers
}

fn reexports_of(
  graph: &Graph,
  exported: &ExportedNames,
  dependents: &Dependents,
) -> (FxHashSet<FileId>, FxHashSet<Box<str>>) {
  let mut exporters: FxHashSet<FileId> = FxHashSet::default();
  exporters.insert(exported.file);
  let mut renames: Vec<&Rename> = Vec::new();

  // Grows while it is read: re-exports of re-exports.
  let mut queue = vec![exported.file];
  let mut next = 0;

  while next < queue.len() {
    let exporter = queue[next];
    next += 1;

    for &id in dependents.reexporters(exporter) {
      let record = graph.module(id);
      if !exporters.insert(record.file) {
        continue;
      }

      queue.push(record.file);
      renames.extend(links_of(record).renames.iter());
    }
  }

  (exporters, names_after_renames(&exported.names, &renames))
}

fn names_after_renames(names: &[&str], renames: &[&Rename]) -> FxHashSet<Box<str>> {
  let mut exported_as: FxHashSet<Box<str>> = names.iter().map(|&name| name.into()).collect();
  let mut renamed_further = true;

  while renamed_further {
    let size_before = exported_as.len();

    for rename in renames {
      if exported_as.contains(&rename.imported) {
        exported_as.insert(rename.exported.clone());
      }
    }

    renamed_further = exported_as.len() > size_before;
  }

  exported_as
}

fn links_of(record: &Module) -> &Links {
  record.cache.links.get_or_init(|| {
    let ast = &record.ast;
    let mut links = LinksBuilder::default();
    let file_of = |specifier: &str| record.resolved_file(specifier);
    let source_of = |statement: NodeId| crate::syntax::source_of(ast, statement);

    for statement in ast.children(0) {
      match ast.kind(statement) {
        Kind::ImportDeclaration => {
          if ast.has(statement, ir::TYPE_ONLY) {
            continue;
          }
          let Some(file) = source_of(statement).and_then(file_of) else {
            continue;
          };

          for specifier in ast.children_in(statement, Slot::Specifier) {
            links.links.value_imports.push((file, specifier));

            if ast.kind(specifier) == Kind::ImportNamespaceSpecifier {
              if links.namespaces.insert(file) {
                links.links.imported_namespaces.push(file);
              }
            } else {
              let name = imported_name(ast, specifier);
              if links.names.insert((file, name)) {
                links.links.imported_names.push((file, name.into()));
              }
            }
          }
        }

        Kind::ExportAllDeclaration => {
          // `export * as ns` exports a namespace, not the module's exports.
          if ast.child(statement, Slot::Exported).is_some() {
            continue;
          }
          if let Some(file) = source_of(statement).and_then(file_of) {
            links.reexport(file);
          }
        }

        Kind::ExportNamedDeclaration if !ast.has(statement, ir::TYPE_ONLY) => {
          add_named_exports(ast, statement, source_of(statement), &file_of, &mut links);
        }

        _ => {}
      }
    }

    links.links
  })
}

/// `Links` being built, where each item is added once.
#[derive(Default)]
struct LinksBuilder<'a> {
  links: Links,
  names: FxHashSet<(FileId, &'a str)>,
  namespaces: FxHashSet<FileId>,
  reexported: FxHashSet<FileId>,
}

impl LinksBuilder<'_> {
  fn reexport(&mut self, file: FileId) {
    if self.reexported.insert(file) {
      self.links.reexported.push(file);
    }
  }
}

fn add_named_exports(
  ast: &Ast,
  statement: NodeId,
  source: Option<&str>,
  file_of: &dyn Fn(&str) -> Option<FileId>,
  links: &mut LinksBuilder<'_>,
) {
  for specifier in ast.children_in(statement, Slot::Specifier) {
    let (Some(local), Some(exported)) = (
      ast.child(specifier, Slot::Local),
      ast.child(specifier, Slot::Exported),
    ) else {
      continue;
    };
    let local = module_export_name(ast, local);

    let imported = match source {
      Some(source) => Some((source, local)),
      None => import_of(ast, local),
    };
    let Some((source, imported_name)) = imported else {
      continue;
    };
    let Some(file) = file_of(source) else {
      continue;
    };

    links.reexport(file);
    links.links.renames.push(Rename {
      imported: imported_name.into(),
      exported: module_export_name(ast, exported).into(),
    });
  }
}

/// `export function f`, `export { f as g }`, `export default f`
fn export_names_of<'g>(graph: &'g Graph, record: &'g Module, function: NodeId) -> Vec<&'g str> {
  function_exports(graph, record)
    .get(&function)
    .map(|names| names.iter().map(|name| &**name).collect())
    .unwrap_or_default()
}

/// The names each function of a module is exported under, in the order they are exported.
fn function_exports<'g>(
  graph: &'g Graph,
  record: &'g Module,
) -> &'g FxHashMap<NodeId, Vec<Box<str>>> {
  record.cache.function_exports.get_or_init(|| {
    let ast = &record.ast;
    let mut exports: FxHashMap<NodeId, Vec<Box<str>>> = FxHashMap::default();
    let function_of = |local: &str| match binding_of(graph, record, local, None)?.declaration {
      Some(Declaration::Node(function)) => Some(function),
      _ => None,
    };
    let mut export = |function: Option<NodeId>, name: &str| {
      if let Some(function) = function {
        exports.entry(function).or_default().push(name.into());
      }
    };

    for statement in ast.children(0) {
      match ast.kind(statement) {
        Kind::ExportDefaultDeclaration => {
          let Some(declaration) = ast.child(statement, Slot::Declaration) else {
            continue;
          };
          let value = unwrap_expression(ast, declaration);

          if ast.kind(value).is_function() {
            export(Some(value), "default");
          } else if ast.kind(value) == Kind::Identifier {
            export(function_of(ast.text(value)), "default");
          }
        }

        Kind::ExportNamedDeclaration => {
          let has_source = ast.child(statement, Slot::Source).is_some();
          if has_source {
            continue;
          }

          if let Some(declaration) = ast.child(statement, Slot::Declaration) {
            let mut declared = Vec::new();
            declared_names(ast, declaration, &mut declared);
            for name in declared {
              export(function_of(name), name);
            }
          }

          for specifier in ast.children_in(statement, Slot::Specifier) {
            let (Some(local), Some(exported)) = (
              ast.child(specifier, Slot::Local),
              ast.child(specifier, Slot::Exported),
            ) else {
              continue;
            };

            export(
              function_of(module_export_name(ast, local)),
              module_export_name(ast, exported),
            );
          }
        }

        _ => {}
      }
    }

    exports
  })
}
