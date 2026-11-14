//! Ember's template tag format (`.gjs`, `.gts`): JavaScript or TypeScript modules whose
//! `<template>` tags hold Glimmer templates. Each tag is written as JavaScript that reads what its
//! template reads, the way Glint's transform reads it, without Glint: see `ember/generate.rs`.

use super::Generate;

#[cfg(feature = "lang-ember")]
mod generate;
#[cfg(feature = "lang-ember")]
mod glimmer;
#[cfg(feature = "lang-ember")]
mod script;
#[cfg(feature = "lang-ember")]
mod template;

#[cfg(feature = "lang-ember")]
pub const GENERATE: Option<Generate> = Some(generate::generate);
/// None while JavaScript's tooling writes these files.
#[cfg(not(feature = "lang-ember"))]
pub const GENERATE: Option<Generate> = None;
