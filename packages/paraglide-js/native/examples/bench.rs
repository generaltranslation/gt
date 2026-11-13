//! Times the analysis on a directory of scripts, without Node.
//!   cargo run --release --no-default-features --example bench -- <project> [outdir]

use std::{path::Path, time::Instant};

use paraglide_context_native::{
  analyze::analyze_file,
  graph::{Graph, GraphOptions, Target, TargetKind},
  load::{link, load, Input, Request},
  resolve::{NativeResolver, ResolverOptions},
};
use rayon::prelude::*;

/// Without mimalloc (`--no-default-features`): the system's allocator, counting the
/// bytes in use, for `CACHES=1`.
#[cfg(not(feature = "mimalloc"))]
mod counting {
  use std::{
    alloc::{GlobalAlloc, Layout, System},
    sync::atomic::{AtomicIsize, Ordering},
  };

  pub static IN_USE: AtomicIsize = AtomicIsize::new(0);

  pub struct Counting;

  unsafe impl GlobalAlloc for Counting {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
      IN_USE.fetch_add(layout.size() as isize, Ordering::Relaxed);
      unsafe { System.alloc(layout) }
    }

    unsafe fn dealloc(&self, pointer: *mut u8, layout: Layout) {
      IN_USE.fetch_sub(layout.size() as isize, Ordering::Relaxed);
      unsafe { System.dealloc(pointer, layout) }
    }

    unsafe fn realloc(&self, pointer: *mut u8, layout: Layout, size: usize) -> *mut u8 {
      IN_USE.fetch_add(size as isize - layout.size() as isize, Ordering::Relaxed);
      unsafe { System.realloc(pointer, layout, size) }
    }
  }

  #[global_allocator]
  static GLOBAL: Counting = Counting;

  pub fn megabytes() -> isize {
    IN_USE.load(Ordering::Relaxed) >> 20
  }
}

fn collect(directory: &Path, files: &mut Vec<String>) {
  let Ok(entries) = std::fs::read_dir(directory) else {
    return;
  };

  for entry in entries.flatten() {
    let path = entry.path();
    let name = entry.file_name();
    let name = name.to_string_lossy();

    if path.is_dir() {
      if name != "node_modules" && name != ".git" && name != "paraglide" {
        collect(&path, files);
      }
    } else if paraglide_context_native::paths::is_script(&name) {
      files.push(path.to_string_lossy().into_owned());
    }
  }
}

fn rss() -> String {
  let output = std::process::Command::new("ps")
    .args(["-o", "rss=", "-p", &std::process::id().to_string()])
    .output();

  match output {
    Ok(output) => {
      let kilobytes: usize = String::from_utf8_lossy(&output.stdout)
        .trim()
        .parse()
        .unwrap_or(0);
      format!("rss {} MB", kilobytes >> 10)
    }
    Err(_) => String::new(),
  }
}

fn main() {
  let mut arguments = std::env::args().skip(1);
  let Some(project) = arguments.next() else {
    eprintln!("usage: bench <project> [outdir]");
    return;
  };
  let outdir = arguments
    .next()
    .unwrap_or_else(|| format!("{project}/src/paraglide"));
  let preread = std::env::var("PREREAD").is_ok();

  let mut files = Vec::new();
  let started = Instant::now();
  collect(Path::new(&project), &mut files);
  files.sort();
  println!("list: {:?} ({} files)", started.elapsed(), files.len());

  let target = |name: &str, kind: TargetKind| Target {
    name: name.into(),
    kind,
  };
  let mut graph = Graph::new(GraphOptions {
    targets: vec![target("message", TargetKind::Messages)],
    outdirs: vec![outdir],
    source_extensions: Vec::new(),
    sources_on_disk: true,
  });

  let started = Instant::now();
  let requests: Vec<Request> = if preread {
    let codes: Vec<String> = files
      .par_iter()
      .map(|file| paraglide_context_native::load::read_text(file).unwrap_or_default())
      .collect();
    println!("read: {:?}", started.elapsed());

    files
      .iter()
      .zip(codes)
      .enumerate()
      .map(|(order, (file, code))| Request {
        file: file.clone(),
        order: order as u64,
        input: Input::Script { code },
      })
      .collect()
  } else {
    files
      .iter()
      .enumerate()
      .map(|(order, file)| Request {
        file: file.clone(),
        order: order as u64,
        input: Input::Read,
      })
      .collect()
  };

  let started = Instant::now();
  let result = load(&mut graph, requests, &[], None);
  println!(
    "load: {:?} ({} skipped) {}",
    started.elapsed(),
    result.skipped.len(),
    rss()
  );

  let resolver = NativeResolver::new(ResolverOptions {
    aliases: Vec::new(),
    root_directory: None,
    conditions: ["import", "module", "browser", "default"]
      .map(String::from)
      .to_vec(),
    builtins: Vec::new(),
    aliases_in_js: false,
  });
  let started = Instant::now();
  let unresolved = link(&mut graph, &resolver);
  println!(
    "resolve: {:?} ({} unresolved) {}",
    started.elapsed(),
    unresolved.len(),
    rss()
  );

  let ids: Vec<u32> = files
    .iter()
    .filter_map(|file| graph.known_file(file))
    .collect();
  let started = Instant::now();
  graph.prepare();
  let usages: usize = ids
    .par_iter()
    .map(|&file| analyze_file(&graph, file, None).map_or(0, |usages| usages.len()))
    .sum();
  println!(
    "analyze: {:?} ({usages} usages) {}",
    started.elapsed(),
    rss()
  );

  let started = Instant::now();
  let again: usize = ids
    .par_iter()
    .map(|&file| analyze_file(&graph, file, None).map_or(0, |usages| usages.len()))
    .sum();
  println!("analyze again: {:?} ({again} usages)", started.elapsed());

  // FRESH=n: n more analyses, each with its caches emptied first, for a profiler.
  let fresh: usize = std::env::var("FRESH")
    .ok()
    .and_then(|runs| runs.parse().ok())
    .unwrap_or(0);
  if fresh > 0 {
    let mut fastest = std::time::Duration::MAX;
    for _ in 0..fresh {
      graph.invalidate();
      let started = Instant::now();
      graph.prepare();
      let _: usize = ids
        .par_iter()
        .map(|&file| analyze_file(&graph, file, None).map_or(0, |usages| usages.len()))
        .sum();
      fastest = fastest.min(started.elapsed());
    }
    println!("analyze fresh: {fastest:?} (fastest of {fresh})");
  }

  let nodes: usize = graph
    .modules
    .iter()
    .map(|module| module.ast.nodes.len())
    .sum();
  let bytes: usize = graph.modules.iter().map(|module| module.ast.memory()).sum();
  let code: usize = graph
    .modules
    .iter()
    .map(|module| module.source.length())
    .sum();
  println!(
    "sizes: Module {} bytes, Node {} bytes",
    std::mem::size_of::<paraglide_context_native::graph::Module>(),
    std::mem::size_of::<paraglide_context_native::ir::Node>()
  );
  println!(
    "modules: {}, nodes: {nodes}, trees: {} MB, code: {} MB",
    graph.modules.len(),
    bytes >> 20,
    code >> 20
  );

  // `CACHES=1`, without mimalloc: the bytes each of the analysis' caches holds.
  #[cfg(not(feature = "mimalloc"))]
  if std::env::var("CACHES").is_ok() {
    use std::sync::OnceLock;

    fn freed(
      graph: &mut Graph,
      name: &str,
      drop_it: &mut dyn FnMut(&mut paraglide_context_native::graph::Module),
    ) {
      let before = counting::megabytes();
      graph.modules.iter_mut().for_each(drop_it);
      println!("  {name:<20} {:>8} MB", before - counting::megabytes());
    }
    println!("in use: {} MB", counting::megabytes());
    {
      use paraglide_context_native::scope::{BindingKind, CachedBinding};
      let (mut variables, mut asked, mut shadows, mut other) = (0usize, 0usize, 0usize, 0usize);
      let mut kinds: std::collections::BTreeMap<&str, usize> = Default::default();
      for module in &graph.modules {
        let Some(bindings) = module.cache.bindings.get() else {
          continue;
        };
        variables += bindings.len();
        for binding in bindings {
          match binding.get() {
            None => {}
            Some(
              CachedBinding::Shadow { .. }
              | CachedBinding::Const { .. }
              | CachedBinding::Parameter { .. },
            ) => {
              asked += 1;
              shadows += 1;
            }
            Some(CachedBinding::Other(binding)) => {
              asked += 1;
              other += 1;
              let kind = match &binding.kind {
                BindingKind::Shadow => "Shadow",
                BindingKind::Lazy(_) => "Lazy",
                BindingKind::Alias { path, .. } if path.is_empty() => "Alias (no path)",
                BindingKind::Alias { .. } => "Alias (path)",
                BindingKind::Values {
                  source: paraglide_context_native::scope::ValuesSource::Parameter { path, .. },
                  ..
                } if path.is_empty() => "Values: parameter (no path)",
                BindingKind::Values {
                  source: paraglide_context_native::scope::ValuesSource::Parameter { .. },
                  ..
                } => "Values: parameter (path)",
                BindingKind::Values {
                  source: paraglide_context_native::scope::ValuesSource::Reassignable { writes },
                  ..
                } if writes.len() <= 1 => "Values: let, one write or none",
                BindingKind::Values {
                  source: paraglide_context_native::scope::ValuesSource::Reassignable { .. },
                  ..
                } => "Values: let, writes",
                BindingKind::Values { .. } => "Values: other",
              };
              *kinds.entry(kind).or_default() += 1;
            }
          }
        }
      }
      println!(
        "  variables {variables}, bindings asked {asked}, kept inline {shadows}, boxed {other}; sizes: slot {} B, Binding {} B",
        std::mem::size_of::<OnceLock<CachedBinding>>(),
        std::mem::size_of::<paraglide_context_native::scope::Binding>()
      );
      println!("  boxed by kind: {kinds:?}");
    }
    freed(&mut graph, "bindings", &mut |module| {
      module.cache.bindings = OnceLock::new()
    });
    freed(&mut graph, "field_scopes", &mut |module| {
      module.cache.field_scopes = OnceLock::new()
    });
    freed(&mut graph, "call_sites", &mut |module| {
      module.cache.call_sites = OnceLock::new()
    });
    freed(&mut graph, "new_instances", &mut |module| {
      module.cache.new_instances = OnceLock::new()
    });
    freed(&mut graph, "call_instances", &mut |module| {
      module.cache.call_instances = OnceLock::new()
    });
    freed(&mut graph, "links", &mut |module| {
      module.cache.links = OnceLock::new()
    });
    freed(&mut graph, "commonjs", &mut |module| {
      module.cache.commonjs = OnceLock::new()
    });
    freed(&mut graph, "component_props", &mut |module| {
      module.cache.component_props = OnceLock::new()
    });
    freed(&mut graph, "call_sites_of", &mut |module| {
      module.cache.call_sites_of = Default::default()
    });
    freed(&mut graph, "function_exports", &mut |module| {
      module.cache.function_exports = OnceLock::new()
    });
    let before = counting::megabytes();
    graph.invalidate();
    println!(
      "  {:<20} {:>8} MB",
      "graph caches",
      before - counting::megabytes()
    );
    freed(&mut graph, "nodes", &mut |module| {
      module.ast.nodes = Vec::new()
    });
    freed(&mut graph, "parsed positions", &mut |module| {
      module.ast.parsed = None
    });
    freed(&mut graph, "syntax", &mut |module| {
      module.syntax = Default::default()
    });
    freed(&mut graph, "resolved", &mut |module| {
      module.resolved = Default::default()
    });
    let before = counting::megabytes();
    let modules = std::mem::take(&mut graph.modules);
    drop(modules);
    println!(
      "  {:<20} {:>8} MB",
      "rest of modules",
      before - counting::megabytes()
    );
    println!("in use after: {} MB", counting::megabytes());
  }

  // `KINDS=1`: how many nodes of each kind, most first.
  if std::env::var("KINDS").is_ok() {
    let mut counts: std::collections::HashMap<_, usize> = std::collections::HashMap::new();
    for module in &graph.modules {
      for node in &module.ast.nodes {
        *counts.entry(node.kind).or_default() += 1;
      }
    }
    let mut counts: Vec<_> = counts.into_iter().collect();
    counts.sort_by_key(|&(_, count)| std::cmp::Reverse(count));
    for (kind, count) in counts.iter().take(40) {
      let kind = format!("{kind:?}");
      println!(
        "  {kind:<28} {count:>12} {:>5.1}%",
        *count as f64 * 100.0 / nodes as f64
      );
    }
  }
}
