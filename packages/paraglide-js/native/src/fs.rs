//! Caches directory listings for the resolver, which stay true because nothing is written while the
//! analysis runs.

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

struct Listing {
  /// Keyed by name with ASCII letters lowercased, since on a case-insensitive file system `./Card`
  /// finds `card.ts`.
  entries: FxHashMap<Box<str>, Vec<(Box<OsStr>, Kind)>>,
}

#[derive(Clone, Copy)]
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

enum Contents {
  Listed(Listing),
  Unlisted,
}

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
  pub fn clear(&self) {
    for shard in &self.shards {
      crate::unpoisoned(shard.write()).clear();
    }
  }

  fn shard(&self, directory: &Path) -> &Shard {
    &self.shards[FxBuildHasher.hash_one(directory) as usize % SHARDS]
  }

  fn find(&self, directory: &Path) -> Option<Slot> {
    crate::unpoisoned(self.shard(directory).read())
      .get(directory)
      .cloned()
  }

  fn find_or_add(&self, directory: &Path) -> Slot {
    crate::unpoisoned(self.shard(directory).write())
      .entry(directory.to_path_buf())
      .or_default()
      .clone()
  }

  fn lookup(&self, path: &Path) -> Lookup {
    if !cfg!(unix) {
      return Lookup::Unknown;
    }

    let (Some(directory), Some(name)) = (path.parent(), path.file_name()) else {
      return Lookup::Unknown;
    };
    // `a/..` and `a/.` name another directory than their parent's entry.
    if name == ".." || name == "." {
      return Lookup::Unknown;
    }

    let slot = self.find(directory);
    if let Some(contents) = slot.as_ref().and_then(|slot| slot.contents.get()) {
      return contents.lookup(name);
    }

    // The resolver also probes paths under files, e.g. `tsconfig.json` "in" each importer, which
    // the parent's listing answers without a system call.
    if let Lookup::Found(Kind::File | Kind::Other) | Lookup::Missing = self.lookup(directory) {
      return Lookup::Missing;
    }

    let slot = slot.unwrap_or_else(|| self.find_or_add(directory));
    if slot.asked.fetch_add(1, Ordering::Relaxed) == 0 {
      return Lookup::Unknown;
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

  fn lookup(&self, name: &OsStr) -> Lookup {
    match self {
      Contents::Listed(listing) => listing.lookup(name),
      Contents::Unlisted => Lookup::Unknown,
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

/// The listings are shared with `NativeResolver`, which clears them.
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
      Lookup::Found(Kind::Symlink) | Lookup::Unknown => FileSystemOs::metadata(path),
      Lookup::Found(kind) => Ok(metadata_of(kind)),
      Lookup::Missing => Err(not_found()),
    }
  }

  fn symlink_metadata(&self, path: &Path) -> io::Result<FileMetadata> {
    match self.0.lookup(path) {
      Lookup::Found(kind) => Ok(metadata_of(kind)),
      Lookup::Missing => Err(not_found()),
      Lookup::Unknown => FileSystemOs::symlink_metadata(path),
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
