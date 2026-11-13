//! Resolves imports like a bundler without one: aliases, package `exports` and
//! `imports`, tsconfig `paths` (from the nearest tsconfig.json of each importer),
//! and TypeScript's `./a.js` → `./a.ts`.

use std::{
  path::{Component, Path, PathBuf},
  sync::Arc,
};

use oxc_resolver::{ResolveOptions, ResolverGeneric, TsconfigDiscovery};
use rustc_hash::{FxHashMap, FxHashSet};

use crate::fs::{ListedFileSystem, SharedFileSystem};

/// An entry of a bundler's `resolve.alias`.
pub struct ImportAlias {
  /// Matches `find` and `find/…`.
  pub find: String,
  pub replacement: String,
  /// Matches only `find` itself (webpack's `name$`).
  pub exact: bool,
}

pub struct ResolverOptions {
  pub aliases: Vec<ImportAlias>,
  /// Where `/src/a.js` resolves from, like Vite's root.
  pub root_directory: Option<String>,
  pub conditions: Vec<String>,
  /// The names of Node's own modules, which are never Paraglide.
  pub builtins: Vec<String>,
  /// The aliases are applied in JavaScript: some are regular expressions.
  pub aliases_in_js: bool,
}

const EXTENSIONS: [&str; 16] = [
  ".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".json", ".vue", ".svelte",
  ".astro", ".mdx", ".marko", ".gjs", ".gts",
];

pub struct NativeResolver {
  resolver: Arc<ResolverGeneric<SharedFileSystem>>,
  /// What the resolver reads of the file system, by directory.
  listings: Arc<ListedFileSystem>,
  aliases: Vec<ImportAlias>,
  root_directory: Option<String>,
  builtins: FxHashSet<String>,
  pub aliases_in_js: bool,
  /// What JavaScript's aliases make of each specifier.
  pub aliased: FxHashMap<Box<str>, Box<str>>,
}

impl NativeResolver {
  pub fn new(options: ResolverOptions) -> Self {
    let to_strings = |values: &[&str]| values.iter().map(|value| value.to_string()).collect();

    let listings = Arc::new(ListedFileSystem::default());
    let file_system = SharedFileSystem(listings.clone());

    let resolver = Arc::new(ResolverGeneric::new_with_file_system(
      file_system,
      ResolveOptions {
        tsconfig: Some(TsconfigDiscovery::Auto),
        condition_names: options.conditions,
        main_fields: to_strings(&["browser", "module", "main"]),
        extensions: to_strings(&EXTENSIONS),
        extension_alias: vec![
          (".js".into(), to_strings(&[".ts", ".tsx", ".js", ".jsx"])),
          (".mjs".into(), to_strings(&[".mts", ".mjs"])),
          (".cjs".into(), to_strings(&[".cts", ".cjs"])),
        ],
        ..ResolveOptions::default()
      },
    ));

    Self {
      resolver,
      listings,
      aliases: options.aliases,
      root_directory: options.root_directory,
      builtins: options.builtins.into_iter().collect(),
      aliases_in_js: options.aliases_in_js,
      aliased: FxHashMap::default(),
    }
  }

  /// Forgets what was read of the file system: the analysis resolves nothing more.
  pub fn clear_cache(&self) {
    self.resolver.clear_cache();
    self.listings.clear();
  }

  /// As `clear_cache`, on a thread of its own: the analysis that follows
  /// resolves nothing, and need not wait for the memory to be given back.
  pub fn clear_cache_later(&self) {
    let resolver = self.resolver.clone();
    let listings = self.listings.clone();

    let spawned = std::thread::Builder::new()
      .name("paraglide-context-clear".into())
      .spawn(move || {
        resolver.clear_cache();
        listings.clear();
      });

    if spawned.is_err() {
      self.clear_cache();
    }
  }

  pub fn is_builtin(&self, specifier: &str) -> bool {
    self.builtins.contains(specifier)
      || specifier
        .strip_prefix("node:")
        .is_some_and(|name| self.builtins.contains(name))
  }

  /// `~/a.js` → `/app/src/a.js`. The first match wins.
  fn apply_aliases<'a>(&'a self, specifier: &'a str) -> std::borrow::Cow<'a, str> {
    if self.aliases_in_js {
      return match self.aliased.get(specifier) {
        Some(aliased) => std::borrow::Cow::Borrowed(aliased),
        None => std::borrow::Cow::Borrowed(specifier),
      };
    }

    let alias = self.aliases.iter().find(|alias| {
      specifier == alias.find
        || (!alias.exact
          && specifier.len() > alias.find.len()
          && specifier.starts_with(alias.find.as_str())
          && specifier.as_bytes()[alias.find.len()] == b'/')
    });

    match alias {
      Some(alias) => std::borrow::Cow::Owned(format!(
        "{}{}",
        alias.replacement,
        &specifier[alias.find.len()..]
      )),
      None => std::borrow::Cow::Borrowed(specifier),
    }
  }

  /// The file an import resolves to; nothing if it is not a file, or not found.
  pub fn resolve(&self, specifier: &str, importer: &str) -> Option<String> {
    let aliased = self.apply_aliases(specifier);

    // `/src/a.js` → `<root_directory>/src/a.js`
    let in_root = match &self.root_directory {
      Some(root) if aliased.starts_with('/') => {
        let joined = normalize(&Path::new(root).join(aliased.trim_start_matches('/')));
        self.resolve_file(&joined, importer)
      }
      _ => None,
    };

    let id = in_root.or_else(|| self.resolve_file(&aliased, importer))?;

    // A resolver may answer with something that is not a file, e.g. a virtual module.
    let file = id.split('?').next().unwrap_or_default();
    let path = Path::new(file);

    path.is_absolute().then(|| normalize(path))
  }

  fn resolve_file(&self, specifier: &str, importer: &str) -> Option<String> {
    let resolution = self.resolver.resolve_file(importer, specifier).ok()?;

    Some(resolution.full_path().to_string_lossy().into_owned())
  }
}

/// As Node's `path.normalize`: without `.` and `..` segments.
fn normalize(path: &Path) -> String {
  let mut normalized = PathBuf::new();

  for component in path.components() {
    match component {
      Component::CurDir => {}
      Component::ParentDir => {
        normalized.pop();
      }
      other => normalized.push(other),
    }
  }

  normalized.to_string_lossy().into_owned()
}
