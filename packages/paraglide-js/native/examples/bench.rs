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
  let result = load(&mut graph, requests, &[]);
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
    .map(|&file| analyze_file(&graph, file, None).len())
    .sum();
  println!(
    "analyze: {:?} ({usages} usages) {}",
    started.elapsed(),
    rss()
  );

  let started = Instant::now();
  let again: usize = ids
    .par_iter()
    .map(|&file| analyze_file(&graph, file, None).len())
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
        .map(|&file| analyze_file(&graph, file, None).len())
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
    .map(|module| module.source.code.len())
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
}
