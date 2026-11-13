//! Astro components (`.astro`): the frontmatter and template as one TSX module, and each bundled
//! client script as a module of its own.

use super::Generate;

/// None while JavaScript's tooling writes these files.
pub const GENERATE: Option<Generate> = None;
