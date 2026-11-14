//! Marko templates (`.marko`), read with a port of Marko's parser and written as one TypeScript
//! module of their code.

use super::Generate;

#[cfg(feature = "lang-marko")]
mod generate;
#[cfg(feature = "lang-marko")]
mod parser;
#[cfg(feature = "lang-marko")]
mod patterns;
#[cfg(all(test, feature = "lang-marko"))]
mod tests;

#[cfg(feature = "lang-marko")]
pub const GENERATE: Option<Generate> = Some(generate::generate);

/// None while JavaScript's tooling writes these files.
#[cfg(not(feature = "lang-marko"))]
pub const GENERATE: Option<Generate> = None;
