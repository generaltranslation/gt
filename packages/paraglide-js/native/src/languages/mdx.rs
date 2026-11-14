//! MDX (`.mdx`): ESM, JSX and `{…}` expressions as one JSX module, the way MDX compiles them.

use super::Generate;

#[cfg(feature = "lang-mdx")]
mod generate;
#[cfg(feature = "lang-mdx")]
mod js;
#[cfg(feature = "lang-mdx")]
mod jsx;

#[cfg(feature = "lang-mdx")]
pub const GENERATE: Option<Generate> = Some(generate::generate);

/// None while JavaScript's tooling writes these files.
#[cfg(not(feature = "lang-mdx"))]
pub const GENERATE: Option<Generate> = None;
