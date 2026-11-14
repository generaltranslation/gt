//! Svelte components (`.svelte`), Svelte 3 to 5.
//!
//! A component is written as one TypeScript module: its scripts copied as they are, and its markup
//! as statements that copy each template expression, in blocks that scope what Svelte's blocks
//! declare. Imported components are rendered as calls with their props, `Child({ label: m.x })`.

use super::Generate;

#[cfg(feature = "lang-svelte")]
mod generate;
#[cfg(feature = "lang-svelte")]
mod js;
#[cfg(feature = "lang-svelte")]
mod names;
#[cfg(all(test, feature = "lang-svelte"))]
mod tests;

#[cfg(feature = "lang-svelte")]
pub const GENERATE: Option<Generate> = Some(generate::generate);

/// None while JavaScript's tooling writes these files.
#[cfg(not(feature = "lang-svelte"))]
pub const GENERATE: Option<Generate> = None;
