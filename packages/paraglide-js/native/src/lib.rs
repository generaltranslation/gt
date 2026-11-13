//! JavaScript drives this analysis and supplies what only it has: the code a framework's tooling
//! writes for a component file.

#[cfg(feature = "mimalloc")]
#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

pub mod analyze;
pub mod call_sites;
pub mod component_fields;
pub mod computed_keys;
pub mod eval;
pub mod fs;
pub mod graph;
pub mod importers;
pub mod ir;
pub mod load;
pub mod lower;
pub mod mapping;
pub mod metadata;
pub mod paths;
pub mod positions;
pub mod resolve;
pub mod scope;
pub mod symbols;
pub mod syntax;

#[cfg(feature = "node")]
pub mod binding;

/// Ignores poisoning, which is sound only because the data behind the crate's locks is only added
/// to or read, never left half-changed.
#[inline]
pub(crate) fn unpoisoned<G>(result: std::sync::LockResult<G>) -> G {
  result.unwrap_or_else(std::sync::PoisonError::into_inner)
}

/// Runs `work` on a pool thread for its larger stack, since a parallel iterator with nothing to
/// split runs on the calling thread.
pub(crate) fn on_pool<T: Send>(work: impl FnOnce() -> T + Send) -> T {
  rayon::scope(|_| work())
}

/// Parses `PARAGLIDE_CONTEXT_THREADS` (threads besides the main one) as `configuredThreads` in
/// `src/compiler/languages/tooling-pool.ts` does: digits only.
pub fn configured_threads(value: &str) -> Option<usize> {
  if value.is_empty() || !value.bytes().all(|byte| byte.is_ascii_digit()) {
    return None;
  }

  value.parse().ok()
}

#[cfg(test)]
mod tests {
  #[test]
  fn threads_are_digits_only() {
    for (value, threads) in [
      ("0", Some(0)),
      ("8", Some(8)),
      ("012", Some(12)),
      ("", None),
      (" 8", None),
      ("8 ", None),
      ("+8", None),
      ("-1", None),
      ("1.5", None),
      ("1e3", None),
      ("0x10", None),
      ("eight", None),
      ("99999999999999999999999", None),
    ] {
      assert_eq!(super::configured_threads(value), threads, "{value:?}");
    }
  }
}
