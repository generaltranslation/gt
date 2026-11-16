use crate::inline_shards::ShardedTranslations;
use crate::logging::LogLevel;
use serde::Deserialize;
use std::collections::HashMap;

/// Translations to embed for one locale, keyed by translation hash
pub type LocaleTranslations = HashMap<String, serde_json::Value>;

/// Experimental: translations to embed at each translation call site, read
/// from the shard files gt-next writes under the working directory.
#[derive(Deserialize, Debug, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InlineTranslationsConfig {
  /// Locales to embed, in output order
  #[serde(default)]
  pub locales: Vec<String>,
  /// Shard directory, relative to the working directory
  pub dir: String,
  /// Hash of the translations, so bundler caches keyed on plugin options invalidate
  #[serde(default)]
  pub content_hash: String,
}

// For plugin configuration and settings
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
  /// Experimental: translations to embed at call sites
  pub inline_translations: Option<ShardedTranslations>,
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
      inline_translations: None,
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
