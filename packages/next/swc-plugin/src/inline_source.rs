//! Where call sites get their inline translations callback from: built from
//! shard files, or imported from one module per message.

use crate::config::InlineTranslationsConfig;
use crate::inline_modules::MessageModules;
use crate::inline_shards::ShardedTranslations;
use crate::visitor::inline_translations::build_inline_translations_fn;
use std::path::Path;
use swc_core::{common::Span, ecma::ast::Expr};

pub enum InlineSource {
  /// Embed each callback at its call site
  Shards(ShardedTranslations),
  /// Import each callback from its message module
  Modules(MessageModules),
}

impl InlineSource {
  pub fn open(cwd: &Path, config: InlineTranslationsConfig) -> Self {
    match config.modules {
      Some(modules) => Self::Modules(MessageModules::open(cwd, modules)),
      None => Self::Shards(ShardedTranslations::open(cwd, config)),
    }
  }

  /// The inline translations callback for a hash. None when no embedded
  /// locale has a translation for it.
  pub fn callback_for(&self, hash: &str, span: Span) -> Option<Expr> {
    match self {
      Self::Shards(shards) => build_inline_translations_fn(&shards.table_for(hash), hash, span),
      Self::Modules(modules) => modules.import_for(hash, span),
    }
  }
}
