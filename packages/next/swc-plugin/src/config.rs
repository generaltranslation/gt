use crate::logging::LogLevel;
use serde::Deserialize;
use std::collections::HashMap;

/// Translations to embed for one locale, keyed by translation hash
pub type LocaleTranslations = HashMap<String, serde_json::Value>;

/// Experimental: translations to embed at each translation call site.
/// gt-next resolves the locale files before passing them to the plugin, since
/// the wasm plugin cannot reliably read from disk.
#[derive(Deserialize, Debug, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InlineTranslationsConfig {
  /// Locales to embed, in output order
  #[serde(default)]
  pub locales: Vec<String>,
  /// Translations keyed by locale, then by translation hash
  #[serde(default)]
  pub translations: HashMap<String, LocaleTranslations>,
}

impl InlineTranslationsConfig {
  /// Resolve to (locale, translations) pairs in `locales` order, dropping
  /// locales without translations
  pub fn into_table(self) -> Vec<(String, LocaleTranslations)> {
    let mut translations = self.translations;
    self
      .locales
      .into_iter()
      .filter_map(|locale| translations.remove(&locale).map(|entries| (locale, entries)))
      .collect()
  }
}

// For plugin configuration and settings
#[derive(Debug)]
pub struct PluginSettings {
  /// Log level for the plugin
  pub log_level: LogLevel,
  /// Experimental feature: inject compile-time hash attributes
  pub compile_time_hash: bool,
  /// Optional filename for better error messages
  pub filename: Option<String>,
  /// Disable dynamic content check
  pub disable_build_checks: bool,
  /// When true, bare variables/calls in JSX expression containers are allowed
  pub autoderive_jsx: bool,
  /// When true, bare variables/calls in template literals and concatenations are allowed
  pub autoderive_strings: bool,
  /// Experimental: translations to embed at call sites, as (locale, translations) pairs
  pub inline_translations: Vec<(String, LocaleTranslations)>,
}

impl PluginSettings {
  pub fn new(log_level: LogLevel, compile_time_hash: bool, filename: Option<String>, disable_build_checks: bool, autoderive_jsx: bool, autoderive_strings: bool) -> Self {
    Self {
      log_level,
      compile_time_hash,
      filename,
      disable_build_checks,
      autoderive_jsx,
      autoderive_strings,
      inline_translations: Vec::new(),
    }
  }
}

/// Plugin configuration options
#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PluginConfig {
  #[serde(default)]
  pub log_level: LogLevel,
  #[serde(default)]
  pub compile_time_hash: bool,
  #[serde(default)]
  pub filename: Option<String>,
  #[serde(default)]
  pub disable_build_checks: bool,
  #[serde(default)]
  pub autoderive_jsx: bool,
  #[serde(default)]
  pub autoderive_strings: bool,
  #[serde(default)]
  pub inline_translations: Option<InlineTranslationsConfig>,
}

impl Default for PluginConfig {
  fn default() -> Self {
    Self {
      log_level: LogLevel::Warn,
      compile_time_hash: false,
      filename: None,
      disable_build_checks: false,
      autoderive_jsx: false,
      autoderive_strings: false,
      inline_translations: None,
    }
  }
}
