//! The file formats besides scripts that the analysis reads, e.g. Vue components. Each file is
//! written as JavaScript or TypeScript modules that copy its code, mapped to where it comes from, as
//! the framework compiles it.

pub mod angular;
pub mod astro;
pub mod builder;
pub mod ember;
pub mod marko;
pub mod mdx;
pub mod svelte;
pub mod vue;

pub use builder::{BuiltCode, CodeBuilder, Skipped};

use crate::load::GeneratedSource;

/// A file written as modules, and where the main module's skippable template expressions are.
pub struct Generated {
  pub source: GeneratedSource,
  /// The UTF-8 range of each skippable expression in `source.main`, by number.
  pub expressions: Vec<(u32, u32)>,
}

/// What writes a file: `skipped` are its expressions that did not parse before. Fails when the
/// file is not valid in its language, and the file is then skipped with the error.
pub type Generate = fn(file: &str, source: &str, skipped: &Skipped) -> Result<Generated, String>;

/// The built-in languages, in the order `defaultLanguages` lists them: the first that claims a file
/// writes it.
#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
pub enum Language {
  Vue,
  Svelte,
  Astro,
  Mdx,
  Markdown,
  AngularComponent,
  AngularTemplate,
  Analog,
  Marko,
  Ember,
}

impl Language {
  pub const ALL: [Language; 10] = [
    Language::Vue,
    Language::Svelte,
    Language::Astro,
    Language::Mdx,
    Language::Markdown,
    Language::AngularComponent,
    Language::AngularTemplate,
    Language::Analog,
    Language::Marko,
    Language::Ember,
  ];

  /// The name of its `SourceLanguage` in JavaScript.
  pub fn name(self) -> &'static str {
    match self {
      Language::Vue => "vue",
      Language::Svelte => "svelte",
      Language::Astro => "astro",
      Language::Mdx => "mdx",
      Language::Markdown => "markdown",
      Language::AngularComponent => "angular-component",
      Language::AngularTemplate => "angular-template",
      Language::Analog => "analog",
      Language::Marko => "marko",
      Language::Ember => "ember",
    }
  }

  pub fn named(name: &str) -> Option<Language> {
    Language::ALL
      .into_iter()
      .find(|language| language.name() == name)
  }

  pub fn extensions(self) -> &'static [&'static str] {
    match self {
      Language::Vue => &[".vue"],
      Language::Svelte => &[".svelte"],
      Language::Astro => &[".astro"],
      Language::Mdx => &[".mdx"],
      Language::Markdown => &[".md"],
      Language::AngularComponent => &[".ts"],
      Language::AngularTemplate => &[".html"],
      Language::Analog => &[".ag", ".analog"],
      Language::Marko => &[".marko"],
      Language::Ember => &[".gjs", ".gts"],
    }
  }

  /// What writes its files here; none while JavaScript's tooling still does.
  fn generator(self) -> Option<Generate> {
    match self {
      Language::Vue => vue::GENERATE,
      Language::Markdown => vue::GENERATE_MARKDOWN,
      Language::Svelte => svelte::GENERATE,
      Language::Astro => astro::GENERATE,
      Language::Mdx => mdx::GENERATE,
      Language::AngularComponent => angular::GENERATE_COMPONENT,
      Language::AngularTemplate => angular::GENERATE_TEMPLATE,
      Language::Analog => angular::GENERATE_ANALOG,
      Language::Marko => marko::GENERATE,
      Language::Ember => ember::GENERATE,
    }
  }

  /// Whether the analysis writes its files itself, rather than JavaScript's tooling.
  pub fn is_native(self) -> bool {
    self.generator().is_some()
  }

  /// Writes `file`, which is this language's.
  pub fn generate(self, file: &str, source: &str, skipped: &Skipped) -> Result<Generated, String> {
    match self.generator() {
      Some(generate) => generate(file, source, skipped),
      None => Err(format!("{} files are not read natively", self.name())),
    }
  }

  /// Whether the language claims `file` (with its `source`, for one that claims some scripts).
  pub fn claims(self, file: &str, source: &str) -> bool {
    if is_declaration_file(file) || !self.has_extension_of(file) {
      return false;
    }

    match self {
      Language::AngularComponent => angular::is_component_with_template(source),
      _ => !is_script(file),
    }
  }

  /// Whether it claims some files of `file`'s extension, whatever they contain.
  pub fn has_extension_of(self, file: &str) -> bool {
    self
      .extensions()
      .iter()
      .any(|extension| file.ends_with(extension))
  }

  /// Whether it claims scripts, and so must see their code: Angular components in `.ts` files.
  pub fn claims_scripts(self) -> bool {
    self == Language::AngularComponent
  }
}

/// The built-in languages, in order, that the analysis writes the files of itself.
#[derive(Default, Clone)]
pub struct NativeLanguages {
  languages: Vec<Language>,
}

impl NativeLanguages {
  /// `languages` in order; those JavaScript's tooling writes are left out.
  pub fn new(languages: impl IntoIterator<Item = Language>) -> Self {
    NativeLanguages {
      languages: languages
        .into_iter()
        .filter(|language| language.is_native())
        .collect(),
    }
  }

  pub fn languages(&self) -> &[Language] {
    &self.languages
  }

  /// The language that writes `file` here, if one does.
  pub fn of(&self, file: &str, source: &str) -> Option<Language> {
    self
      .languages
      .iter()
      .copied()
      .find(|language| language.claims(file, source))
  }

  /// Whether a script's code must be read to know if one of them claims it.
  pub fn may_claim_script(&self, file: &str) -> bool {
    self
      .languages
      .iter()
      .any(|language| language.claims_scripts() && language.has_extension_of(file))
  }
}

/// `.d.ts` and the like declare types only: no language claims them.
fn is_declaration_file(file: &str) -> bool {
  [".d.ts", ".d.mts", ".d.cts"]
    .iter()
    .any(|extension| file.ends_with(extension))
}

/// As `isScript` in `src/compiler/utils/paths.ts`: `/\.[cm]?[jt]sx?$/`, not a declaration file.
pub fn is_script(file: &str) -> bool {
  let name = file.strip_suffix('x').unwrap_or(file);
  let Some(name) = name.strip_suffix('s') else {
    return false;
  };
  let Some(name) = name.strip_suffix(['j', 't']) else {
    return false;
  };
  let name = name.strip_suffix(['c', 'm']).unwrap_or(name);

  name.ends_with('.') && !is_declaration_file(file)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn scripts_are_as_javascript_says() {
    for file in ["a.js", "a.jsx", "a.ts", "a.tsx", "a.mjs", "a.cts", "a.mtsx"] {
      assert!(is_script(file), "{file}");
    }
    for file in [
      "a.d.ts", "a.d.mts", "a.vue", "a.json", "a.s", "ats", "a.xts",
    ] {
      assert!(!is_script(file), "{file}");
    }
  }
}
