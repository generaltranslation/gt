use crate::logging::LogLevel;
use serde::Deserialize;

// For plugin configuration and settings
#[derive(Debug)]
pub struct PluginSettings {
  /// Log level for the plugin
  pub log_level: LogLevel,
  /// Experimental feature: inject compile-time hash attributes
  pub compile_time_hash: bool,
  /// Optional filename for better error messages
  pub filename: Option<String>,
}

impl PluginSettings {
  pub fn new(log_level: LogLevel, compile_time_hash: bool, filename: Option<String>) -> Self {
    Self {
      log_level,
      compile_time_hash,
      filename,
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
}

impl Default for PluginConfig {
  fn default() -> Self {
    Self {
      log_level: LogLevel::Warn,
      compile_time_hash: false,
      filename: None,
    }
  }
}
