//! The usage analysis of `@generaltranslation/paraglide-js`, as a Node addon:
//! reads and parses a project's modules, and finds where each of them uses
//! Paraglide's messages. JavaScript drives it and gives it what only
//! JavaScript has: the code a framework's tooling writes for a component file.

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
pub mod paths;
pub mod positions;
pub mod resolve;
pub mod scope;
pub mod symbols;
pub mod syntax;

#[cfg(feature = "node")]
pub mod binding;
