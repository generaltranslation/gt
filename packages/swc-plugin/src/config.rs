use serde::Deserialize;

/// Log levels for controlling warning outputs
#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Silent,
    Error,
    Warn,
    Info,
}

impl Default for LogLevel {
  fn default() -> Self {
      LogLevel::Warn
  }
}

// For plugin configuration and settings
#[derive(Debug)]
pub struct PluginSettings {
    /// Log levels for different warning types
    pub dynamic_jsx_check_log_level: LogLevel,
    pub dynamic_string_check_log_level: LogLevel,
    /// Experimental feature: inject compile-time hash attributes
    pub experimental_compile_time_hash: bool,
    /// Optional filename for better error messages
    pub filename: Option<String>,
}

impl PluginSettings {
    pub fn new(
        dynamic_jsx_check_log_level: LogLevel,
        dynamic_string_check_log_level: LogLevel,
        experimental_compile_time_hash: bool,
        filename: Option<String>,
    ) -> Self {
        Self {
            dynamic_jsx_check_log_level,
            dynamic_string_check_log_level,
            experimental_compile_time_hash,
            filename,
        }
    }
}


/// Plugin configuration options
#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PluginConfig {
    #[serde(default)]
    pub dynamic_jsx_check_log_level: LogLevel,
    #[serde(default)]
    pub dynamic_string_check_log_level: LogLevel,
    #[serde(default)]
    pub experimental_compile_time_hash: bool,
}

impl Default for PluginConfig {
    fn default() -> Self {
        Self {
            dynamic_jsx_check_log_level: LogLevel::Warn,
            dynamic_string_check_log_level: LogLevel::Warn,
            experimental_compile_time_hash: false,
        }
    }
}
