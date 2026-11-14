//! Vue single-file components (`.vue`), and VitePress Markdown (`.md`), which VitePress compiles as
//! Vue components.
//!
//! A component is written as one module: its `<script>` and `<script setup>` as they are, then its
//! template as code that reads like it, in a function: each interpolation and directive value is
//! copied as an expression, `v-if` and `v-for` become `if` and `for` blocks around their element,
//! slot props the parameters of a function around theirs, event handlers functions of `$event`, and
//! a component `Name({ prop: value })`, whose call sites are the component's props.

use super::Generate;

#[cfg(feature = "lang-vue")]
mod codegen;
#[cfg(feature = "lang-vue")]
mod generate;
#[cfg(feature = "lang-vue")]
mod html;
#[cfg(feature = "lang-vue")]
mod markdown;
#[cfg(feature = "lang-vue")]
mod names;
#[cfg(feature = "lang-vue")]
mod pug;
#[cfg(feature = "lang-vue")]
mod sfc;
#[cfg(feature = "lang-vue")]
mod template;

#[cfg(feature = "lang-vue")]
pub const GENERATE: Option<Generate> = Some(generate::vue);
#[cfg(feature = "lang-vue")]
pub const GENERATE_MARKDOWN: Option<Generate> = Some(generate::markdown);

/// None while JavaScript's tooling writes these files.
#[cfg(not(feature = "lang-vue"))]
pub const GENERATE: Option<Generate> = None;
/// None while JavaScript's tooling writes these files.
#[cfg(not(feature = "lang-vue"))]
pub const GENERATE_MARKDOWN: Option<Generate> = None;
