//! Lists a project's files as `findFiles` in `src/compiler/project/files.ts` did with globby: every
//! file under the included directories, but not in an ignored directory, nor ignored by a
//! `.gitignore` file between the base (the repository's root) and the file.

use std::{
  path::{Path, PathBuf},
  sync::Mutex,
};

use ignore::{DirEntry, ParallelVisitor, ParallelVisitorBuilder, WalkBuilder, WalkState};
use rustc_hash::FxHashSet;

pub struct ListOptions {
  /// Where `.gitignore` files apply from; every root is in it.
  pub base: PathBuf,
  /// The directories and files to list, absolute.
  pub roots: Vec<PathBuf>,
  /// Names that are never listed, nor what is in them, wherever they are, e.g. `node_modules`.
  pub ignored_names: FxHashSet<String>,
  /// Paths that are never listed, nor what is in them, absolute, e.g. the project's `dist`.
  pub ignored_paths: Vec<PathBuf>,
}

/// The files of `options.roots`, sorted. A symbolic link is neither listed nor followed.
pub fn list_files(options: &ListOptions) -> Vec<String> {
  let ListOptions {
    base,
    roots,
    ignored_names,
    ignored_paths,
  } = options;
  if roots.is_empty() {
    return Vec::new();
  }

  // Owned: the walk's filter outlives this call's borrows.
  let (wanted, names, paths) = (roots.clone(), ignored_names.clone(), ignored_paths.clone());
  let is_ignored = move |path: &Path| {
    path
      .file_name()
      .and_then(|name| name.to_str())
      .is_some_and(|name| names.contains(name))
      || paths.iter().any(|ignored| path == ignored)
  };
  // On the way to a root, or in one.
  let is_wanted = move |path: &Path| {
    wanted
      .iter()
      .any(|root| path.starts_with(root) || root.starts_with(path))
  };

  let mut walk = WalkBuilder::new(base);
  walk
    .standard_filters(false)
    .hidden(false)
    .git_ignore(true)
    .require_git(false)
    .parents(false)
    .follow_links(false)
    .filter_entry(move |entry| {
      if entry.depth() == 0 {
        return true;
      }
      // As globby's `**/node_modules/**`, which also matches a file of that name.
      let path = entry.path();
      if is_ignored(path) {
        return false;
      }
      let is_directory = entry.file_type().is_some_and(|kind| kind.is_dir());
      !is_directory || is_wanted(path)
    });

  let found = Mutex::new(Vec::new());
  walk.build_parallel().visit(&mut Collectors {
    found: &found,
    roots,
  });

  let mut files = found
    .into_inner()
    .unwrap_or_else(|error| error.into_inner());
  files.sort_unstable();
  files.dedup();
  files
}

/// Each walking thread's: it gathers the files it finds, and adds them to `found` in batches and
/// when it is done.
struct Collector<'a> {
  batch: Vec<String>,
  found: &'a Mutex<Vec<String>>,
  roots: &'a [PathBuf],
}

impl Collector<'_> {
  fn flush(&mut self) {
    crate::unpoisoned(self.found.lock()).append(&mut self.batch);
  }
}

impl ParallelVisitor for Collector<'_> {
  fn visit(&mut self, entry: Result<DirEntry, ignore::Error>) -> WalkState {
    let Ok(entry) = entry else {
      return WalkState::Continue;
    };
    let is_file = entry.file_type().is_some_and(|kind| kind.is_file());
    let path = entry.path();
    if is_file && self.roots.iter().any(|root| path.starts_with(root)) {
      if let Some(file) = path.to_str() {
        self.batch.push(file.to_string());
        if self.batch.len() >= 1024 {
          self.flush();
        }
      }
    }

    WalkState::Continue
  }
}

impl Drop for Collector<'_> {
  fn drop(&mut self) {
    self.flush();
  }
}

struct Collectors<'a> {
  found: &'a Mutex<Vec<String>>,
  roots: &'a [PathBuf],
}

impl<'a> ParallelVisitorBuilder<'a> for Collectors<'a> {
  fn build(&mut self) -> Box<dyn ParallelVisitor + 'a> {
    Box::new(Collector {
      batch: Vec::new(),
      found: self.found,
      roots: self.roots,
    })
  }
}

/// The outermost directory between `base` (excluded) and `project_root` (included) that a
/// `.gitignore` file of `base` or of a directory on the way ignores, as git decides: the nearest
/// file with a rule for the directory wins. Only those files can apply to it.
pub fn ignored_directory(base: &Path, project_root: &Path) -> Option<PathBuf> {
  use ignore::gitignore::Gitignore;

  if !project_root.starts_with(base) || project_root == base {
    return None;
  }

  let mut below: Vec<&Path> = project_root
    .ancestors()
    .take_while(|directory| *directory != base)
    .collect();
  below.reverse();

  let ignore_file = |directory: &Path| {
    let file = directory.join(".gitignore");
    file
      .is_file()
      .then(|| Gitignore::new(&file).0)
      .filter(|matcher| !matcher.is_empty())
  };
  // The matchers of `base` and of each directory above the one being checked, outermost first.
  let mut matchers: Vec<Gitignore> = ignore_file(base).into_iter().collect();

  for directory in below {
    let decision = matchers
      .iter()
      .rev()
      .map(|matcher| matcher.matched(directory, true))
      .find(|decision| !decision.is_none());
    if decision.is_some_and(|decision| decision.is_ignore()) {
      return Some(directory.to_path_buf());
    }

    matchers.extend(ignore_file(directory));
  }

  None
}

#[cfg(test)]
mod tests {
  use super::*;

  fn tree(files: &[(&str, &str)]) -> PathBuf {
    let root = std::env::temp_dir().join(format!(
      "paraglide-project-files-{}-{}",
      std::process::id(),
      files.len()
    ));
    let _ = std::fs::remove_dir_all(&root);
    for (file, content) in files {
      let path = root.join(file);
      std::fs::create_dir_all(path.parent().unwrap()).unwrap();
      std::fs::write(path, content).unwrap();
    }
    root
  }

  #[test]
  fn lists_as_git_sees_the_files() {
    let root = tree(&[
      (".gitignore", "generated/\n*.log\n"),
      ("app/.gitignore", "!keep.log\nlocal.ts\n"),
      ("app/src/a.ts", ""),
      ("app/src/b.log", ""),
      ("app/keep.log", ""),
      ("app/local.ts", ""),
      ("app/generated/c.ts", ""),
      ("app/node_modules/d/index.js", ""),
      ("app/dist/e.js", ""),
      ("app/src/dist/f.ts", ""),
      ("other/g.ts", ""),
    ]);
    let app = root.join("app");
    let files = list_files(&ListOptions {
      base: root.clone(),
      roots: vec![app.clone()],
      ignored_names: ["node_modules".to_string()].into_iter().collect(),
      ignored_paths: vec![app.join("dist")],
    });
    let relative: Vec<String> = files
      .iter()
      .map(|file| file.strip_prefix(&format!("{}/", root.display())).unwrap().to_string())
      .collect();

    assert_eq!(
      relative,
      [
        "app/.gitignore",
        "app/keep.log",
        "app/src/a.ts",
        "app/src/dist/f.ts"
      ]
    );
    let _ = std::fs::remove_dir_all(&root);
  }

  #[test]
  fn finds_the_outermost_ignored_directory_on_the_way() {
    let root = tree(&[
      (".gitignore", "examples/\n"),
      ("examples/.gitignore", "!demo/\n"),
      ("examples/demo/src/a.ts", ""),
      ("packages/app/src/a.ts", ""),
    ]);

    assert_eq!(
      ignored_directory(&root, &root.join("examples/demo")),
      Some(root.join("examples"))
    );
    assert_eq!(ignored_directory(&root, &root.join("packages/app")), None);
    assert_eq!(ignored_directory(&root, &root), None);
    let _ = std::fs::remove_dir_all(&root);
  }
}
