//! Experimental: read embedded translations from the shard files gt-next
//! writes before the build, `<dir>/<locale>/<shard key>.json`, loading only
//! the shards for the hashes a module uses. gt-next writes every shard key for
//! every locale, so an unreadable shard means a broken build and fails it.

use crate::config::{InlineTranslationsConfig, LocaleTranslations};
use std::cell::RefCell;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::rc::Rc;

/// Mount point of the process working directory inside SWC's WASI sandbox.
pub const PLUGIN_CWD: &str = "/cwd";

const SHARD_KEY_LEN: usize = 2;
const FALLBACK_SHARD_KEY: &str = "_";

/// Shard key for a hash: its first two lowercase hex characters, or `_` for
/// hashes that do not start with them. Must match gt-next's `getShardKey`.
pub fn shard_key(hash: &str) -> &str {
  match hash.get(..SHARD_KEY_LEN) {
    Some(prefix) if prefix.bytes().all(|byte| matches!(byte, b'0'..=b'9' | b'a'..=b'f')) => prefix,
    _ => FALLBACK_SHARD_KEY,
  }
}

pub type InlineTable = Vec<(String, LocaleTranslations)>;

pub struct ShardedTranslations {
  root: PathBuf,
  locales: Vec<String>,
  cache: RefCell<HashMap<String, Rc<InlineTable>>>,
}

impl ShardedTranslations {
  /// Panics when the shard directory cannot be read: gt-next wrote it before
  /// the build, so embedding would otherwise silently stop.
  pub fn open(cwd: &Path, config: InlineTranslationsConfig) -> Self {
    let root = cwd.join(&config.dir);
    match std::fs::metadata(&root) {
      Ok(metadata) if metadata.is_dir() => Self {
        root,
        locales: config.locales,
        cache: RefCell::new(HashMap::new()),
      },
      Ok(_) => fail(&root, "is not a directory"),
      Err(error) => fail(&root, &error.to_string()),
    }
  }

  /// (locale, translations) pairs in locale order for the shard holding `hash`
  pub fn table_for(&self, hash: &str) -> Rc<InlineTable> {
    let key = shard_key(hash);
    if let Some(table) = self.cache.borrow().get(key) {
      return table.clone();
    }
    let table: Rc<InlineTable> = Rc::new(
      self
        .locales
        .iter()
        .map(|locale| (locale.clone(), self.read_shard(locale, key)))
        .collect(),
    );
    self.cache.borrow_mut().insert(key.to_string(), table.clone());
    table
  }

  fn read_shard(&self, locale: &str, key: &str) -> LocaleTranslations {
    let path = self.root.join(locale).join(format!("{key}.json"));
    let bytes = std::fs::read(&path).unwrap_or_else(|error| fail(&path, &error.to_string()));
    serde_json::from_slice(&bytes).unwrap_or_else(|error| fail(&path, &error.to_string()))
  }
}

fn fail(path: &Path, reason: &str) -> ! {
  panic!(
    "gt-next: cannot read embedded translations from {} ({reason}). gt-next writes these files before the build: delete that directory and rebuild, running next build from the app directory.",
    path.display()
  )
}

#[cfg(test)]
mod tests {
  use super::shard_key;

  #[test]
  fn uses_the_first_two_hex_characters() {
    assert_eq!(shard_key("05a87bce151d258b"), "05");
    assert_eq!(shard_key("ff"), "ff");
  }

  #[test]
  fn falls_back_for_other_hashes() {
    assert_eq!(shard_key(""), "_");
    assert_eq!(shard_key("a"), "_");
    assert_eq!(shard_key("AB12"), "_");
    assert_eq!(shard_key("my-hash"), "_");
    assert_eq!(shard_key("../x"), "_");
    assert_eq!(shard_key("éa"), "_");
  }
}
