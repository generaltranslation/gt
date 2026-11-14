//! Astro components (`.astro`): the frontmatter and template as one TSX module, and each bundled
//! client script as a module of its own.

use super::Generate;

#[cfg(feature = "lang-astro")]
mod generate;
#[cfg(feature = "lang-astro")]
mod scan;
#[cfg(all(test, feature = "lang-astro"))]
mod tests;

#[cfg(feature = "lang-astro")]
pub const GENERATE: Option<Generate> = Some(generate::generate);

/// None while JavaScript's tooling writes these files.
#[cfg(not(feature = "lang-astro"))]
pub const GENERATE: Option<Generate> = None;
