//! The file system as the resolver reads it: one listing of a directory answers
//! the many names an import probes in it (`./a` → `a.ts`, `a.tsx`, …).
//! Nothing is written while the analysis runs, so a listing stays true.

use std::{
  ffi::OsStr,
  hash::BuildHasher,
  io,
  path::{Path, PathBuf},
  sync::{
    atomic::{AtomicU32, Ordering},
    Arc, OnceLock, RwLock,
  },
};

use oxc_resolver::{FileMetadata, FileSystem, FileSystemOs, ResolveError};
use rustc_hash::{FxBuildHasher, FxHashMap};

/// A directory with more entries is not listed: its names are asked of the system one by one.
const MAX_LISTED: usize = 20_000;

const SHARDS: usize = 64;

#[derive(Clone, Copy, PartialEq, Eq)]
enum Kind {
  File,
  Directory,
  Symlink,
  /// A FIFO, a socket, a device: neither a file nor a directory.
  Other,
}

/// What a directory contains.
struct Listing {
  /// By name with ASCII letters in lower case: on a case-insensitive file system,
  /// `./Card` finds `card.ts`, so a name is missing only when no entry of any case has it.
  entries: FxHashMap<Box<str>, Vec<(Box<OsStr>, Kind)>>,
}

enum Lookup {
  Found(Kind),
  Missing,
  /// The listing cannot tell, e.g. an entry differs only in case: the system decides.
  Unknown,
}

impl Listing {
  fn read(directory: &Path) -> Option<Listing> {
    let mut entries: FxHashMap<Box<str>, Vec<(Box<OsStr>, Kind)>> = FxHashMap::default();
    let mut count = 0;

    for entry in std::fs::read_dir(directory).ok()? {
      let entry = entry.ok()?;
      count += 1;
      if count > MAX_LISTED {
        return None;
      }

      let file_type = entry.file_type().ok()?;
      let kind = if file_type.is_symlink() {
        Kind::Symlink
      } else if file_type.is_dir() {
        Kind::Directory
      } else if file_type.is_file() {
        Kind::File
      } else {
        Kind::Other
      };

      let name = entry.file_name();
      // A name that is not UTF-8 is never asked for: imports are text.
      let Some(text) = name.to_str() else { continue };

      entries
        .entry(fold(text).into())
        .or_default()
        .push((name.into_boxed_os_str(), kind));
    }

    Some(Listing { entries })
  }

  fn lookup(&self, name: &OsStr) -> Lookup {
    // Unicode names may be equal in another normalization or case: the system decides.
    let Some(text) = name.to_str().filter(|text| text.is_ascii()) else {
      return Lookup::Unknown;
    };

    let Some(candidates) = self.entries.get(fold(text).as_str()) else {
      return Lookup::Missing;
    };

    match candidates.iter().find(|(entry, _)| &**entry == name) {
      Some(&(_, kind)) => Lookup::Found(kind),
      None => Lookup::Unknown,
    }
  }
}

/// A name in lower case, as a case-insensitive file system compares it.
fn fold(name: &str) -> String {
  if name.is_ascii() {
    name.to_ascii_lowercase()
  } else {
    name.to_lowercase()
  }
}

/// What is known of a directory's entries.
enum Contents {
  Listed(Listing),
  /// It cannot be listed: the system is asked about each name.
  Unlisted,
}

/// A directory is listed when it is asked about a second time: one asked about
/// once, e.g. a parent directory whose `package.json` is looked for, costs one
/// system call, not a listing of all its entries.
#[derive(Default)]
struct Directory {
  asked: AtomicU32,
  contents: OnceLock<Contents>,
}

type Slot = Arc<Directory>;

type Shard = RwLock<FxHashMap<PathBuf, Slot>>;

pub struct ListedFileSystem {
  shards: Box<[Shard]>,
}

impl Default for ListedFileSystem {
  fn default() -> Self {
    Self {
      shards: (0..SHARDS)
        .map(|_| RwLock::new(FxHashMap::default()))
        .collect(),
    }
  }
}

impl ListedFileSystem {
  /// Forgets every listing.
  pub fn clear(&self) {
    for shard in &self.shards {
      shard
        .write()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .clear();
    }
  }

  fn shard(&self, directory: &Path) -> &Shard {
    &self.shards[FxBuildHasher.hash_one(directory) as usize % SHARDS]
  }

  fn find(&self, directory: &Path) -> Option<Slot> {
    self
      .shard(directory)
      .read()
      .unwrap_or_else(|poisoned| poisoned.into_inner())
      .get(directory)
      .cloned()
  }

  fn find_or_add(&self, directory: &Path) -> Slot {
    self
      .shard(directory)
      .write()
      .unwrap_or_else(|poisoned| poisoned.into_inner())
      .entry(directory.to_path_buf())
      .or_default()
      .clone()
  }

  /// What `path` is by its directory's listing: `None` when the listing cannot tell.
  fn lookup(&self, path: &Path) -> Option<Result<Kind, ()>> {
    if !cfg!(unix) {
      return None;
    }

    let (directory, name) = (path.parent()?, path.file_name()?);
    // `a/..` and `a/.` name another directory than their parent's entry.
    if name == ".." || name == "." {
      return None;
    }

    let slot = self.find(directory);
    if let Some(contents) = slot.as_ref().and_then(|slot| slot.contents.get()) {
      return contents.lookup(name);
    }

    // The parent's listing tells a file, or a path that does not exist, without
    // a system call: tsconfig.json is looked for "in" each importer too.
    if let Some(Ok(Kind::File | Kind::Other) | Err(())) = self.lookup(directory) {
      return Some(Err(()));
    }

    let slot = slot.unwrap_or_else(|| self.find_or_add(directory));
    if slot.asked.fetch_add(1, Ordering::Relaxed) == 0 {
      return None;
    }

    slot
      .contents
      .get_or_init(|| Contents::of(directory))
      .lookup(name)
  }
}

impl Contents {
  fn of(directory: &Path) -> Contents {
    match Listing::read(directory) {
      Some(listing) => Contents::Listed(listing),
      None => Contents::Unlisted,
    }
  }

  /// What `name` is: `None` when the listing cannot tell.
  fn lookup(&self, name: &OsStr) -> Option<Result<Kind, ()>> {
    let Contents::Listed(listing) = self else {
      return None;
    };

    match listing.lookup(name) {
      Lookup::Found(kind) => Some(Ok(kind)),
      Lookup::Missing => Some(Err(())),
      Lookup::Unknown => None,
    }
  }
}

fn metadata_of(kind: Kind) -> FileMetadata {
  FileMetadata::new(
    kind == Kind::File,
    kind == Kind::Directory,
    kind == Kind::Symlink,
  )
}

fn not_found() -> io::Error {
  io::Error::from(io::ErrorKind::NotFound)
}

/// What the resolver is given: the listings are shared with `NativeResolver`, which clears them.
#[derive(Clone, Default)]
pub struct SharedFileSystem(pub Arc<ListedFileSystem>);

impl FileSystem for SharedFileSystem {
  fn new() -> Self {
    Self::default()
  }

  fn read(&self, path: &Path) -> io::Result<Vec<u8>> {
    std::fs::read(path)
  }

  fn read_to_string(&self, path: &Path) -> io::Result<String> {
    FileSystemOs::read_to_string(path)
  }

  fn metadata(&self, path: &Path) -> io::Result<FileMetadata> {
    match self.0.lookup(path) {
      // A symlink is followed by the system.
      Some(Ok(Kind::Symlink)) | None => FileSystemOs::metadata(path),
      Some(Ok(kind)) => Ok(metadata_of(kind)),
      Some(Err(())) => Err(not_found()),
    }
  }

  fn symlink_metadata(&self, path: &Path) -> io::Result<FileMetadata> {
    match self.0.lookup(path) {
      Some(Ok(kind)) => Ok(metadata_of(kind)),
      Some(Err(())) => Err(not_found()),
      None => FileSystemOs::symlink_metadata(path),
    }
  }

  fn read_link(&self, path: &Path) -> Result<PathBuf, ResolveError> {
    FileSystemOs::read_link(path)
  }

  fn canonicalize(&self, path: &Path) -> io::Result<PathBuf> {
    FileSystemOs::canonicalize(path)
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn listings_answer_like_the_system() {
    let root = std::env::temp_dir().join(format!("listed-fs-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&root);
    std::fs::create_dir_all(root.join("dir")).unwrap_or_default();
    std::fs::write(root.join("Card.tsx"), "").unwrap_or_default();
    #[cfg(unix)]
    let _ = std::os::unix::fs::symlink(root.join("dir"), root.join("link"));

    let listed = SharedFileSystem::default();
    let system = |path: &Path| {
      FileSystemOs::metadata(path)
        .ok()
        .map(|m| (m.is_file(), m.is_dir()))
    };
    let listed_meta = |path: &Path| {
      listed
        .metadata(path)
        .ok()
        .map(|m| (m.is_file(), m.is_dir()))
    };

    for name in [
      "Card.tsx",
      "card.tsx",
      "Card.ts",
      "dir",
      "link",
      "missing",
      "dir/x",
      "Card.tsx/tsconfig.json",
      "missing/x",
      "link/x",
    ] {
      let path = root.join(name);
      assert_eq!(listed_meta(&path), system(&path), "{name}");
    }

    let _ = std::fs::remove_dir_all(&root);
  }
}
