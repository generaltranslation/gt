//! Experimental: import inline translations callbacks from one module per
//! message instead of embedding them, so bundlers only ship the translations a
//! chunk uses. gt-next writes `<dir>/<hash>.js` before the build for every
//! message with an embedded translation:
//! `export default (locale) => locale === "fr" ? … : undefined;`
//! The plugin only checks which hashes have a module; it never reads them.

use crate::config::InlineModulesConfig;
use std::cell::RefCell;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use swc_core::{
  common::{Span, SyntaxContext, DUMMY_SP},
  ecma::{ast::*, atoms::Atom},
};

const LOCAL_PREFIX: &str = "__gt_inline_";

/// Hashes that get a message module. Must match @generaltranslation/compiler's
/// `isInlineTranslationsModuleHash`.
pub fn is_module_hash(hash: &str) -> bool {
  !hash.is_empty()
    && hash
      .bytes()
      .all(|byte| byte.is_ascii_digit() || byte.is_ascii_lowercase() || byte == b'_')
}

/// Local name for a message module's default import
pub fn module_local_name(hash: &str) -> String {
  format!("{LOCAL_PREFIX}{hash}")
}

pub struct MessageModules {
  root: PathBuf,
  import_dir: String,
  exists: RefCell<HashMap<String, bool>>,
  /// Hashes imported by the current file, in first-use order
  used: RefCell<Vec<String>>,
}

impl MessageModules {
  /// Panics when the module directory cannot be read: gt-next wrote it before
  /// the build, so embedding would otherwise silently stop.
  pub fn open(cwd: &Path, config: InlineModulesConfig) -> Self {
    let root = cwd.join(&config.dir);
    match std::fs::metadata(&root) {
      Ok(metadata) if metadata.is_dir() => Self {
        root,
        import_dir: config.import_dir.trim_end_matches('/').to_string(),
        exists: RefCell::new(HashMap::new()),
        used: RefCell::new(Vec::new()),
      },
      Ok(_) => fail(&root, "is not a directory"),
      Err(error) => fail(&root, &error.to_string()),
    }
  }

  /// Reference to the message module's default export, recording the import.
  /// None when the hash has no module.
  pub fn import_for(&self, hash: &str, span: Span) -> Option<Expr> {
    if !self.has_module(hash) {
      return None;
    }
    let mut used = self.used.borrow_mut();
    if !used.iter().any(|used| used == hash) {
      used.push(hash.to_string());
    }
    Some(Expr::Ident(Ident::new(
      module_local_name(hash).into(),
      span,
      SyntaxContext::empty(),
    )))
  }

  fn has_module(&self, hash: &str) -> bool {
    if !is_module_hash(hash) {
      return false;
    }
    if let Some(exists) = self.exists.borrow().get(hash) {
      return *exists;
    }
    let exists = self.root.join(format!("{hash}.js")).is_file();
    self.exists.borrow_mut().insert(hash.to_string(), exists);
    exists
  }

  /// Add a default import for every message module the file used, after any
  /// directive prologue ('use client', 'use server') so it keeps working.
  pub fn inject_imports(&self, program: &mut Program) {
    let used = self.used.borrow();
    let Program::Module(module) = program else {
      return;
    };
    if used.is_empty() {
      return;
    }
    let prologue_len = module
      .body
      .iter()
      .take_while(|item| is_directive(item))
      .count();
    let imports = used.iter().map(|hash| {
      ModuleItem::ModuleDecl(ModuleDecl::Import(ImportDecl {
        span: DUMMY_SP,
        specifiers: vec![ImportSpecifier::Default(ImportDefaultSpecifier {
          span: DUMMY_SP,
          local: Ident::new(module_local_name(hash).into(), DUMMY_SP, SyntaxContext::empty()),
        })],
        src: Box::new(Str {
          span: DUMMY_SP,
          value: Atom::new(format!("{}/{hash}.js", self.import_dir)).into(),
          raw: None,
        }),
        type_only: false,
        with: None,
        phase: Default::default(),
      }))
    });
    module.body.splice(prologue_len..prologue_len, imports.collect::<Vec<_>>());
  }
}

fn is_directive(item: &ModuleItem) -> bool {
  matches!(
    item,
    ModuleItem::Stmt(Stmt::Expr(ExprStmt { expr, .. })) if matches!(expr.as_ref(), Expr::Lit(Lit::Str(_)))
  )
}

fn fail(path: &Path, reason: &str) -> ! {
  panic!(
    "gt-next: cannot read embedded translation modules from {} ({reason}). gt-next writes these files before the build: run next build from the app directory.",
    path.display()
  )
}

#[cfg(test)]
mod tests {
  use super::{is_module_hash, module_local_name};

  #[test]
  fn accepts_computed_hashes() {
    assert!(is_module_hash("05a87bce151d258b"));
    assert!(is_module_hash("my_hash_2"));
  }

  #[test]
  fn rejects_other_hashes() {
    for hash in ["", "../x", "a.b", "a/b", "é", "my-hash", "AB12"] {
      assert!(!is_module_hash(hash), "{hash}");
    }
  }

  #[test]
  fn names_locals_after_the_hash() {
    assert_eq!(module_local_name("05a87bce151d258b"), "__gt_inline_05a87bce151d258b");
  }
}
