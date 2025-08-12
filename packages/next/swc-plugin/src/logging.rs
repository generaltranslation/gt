
use serde::Deserialize;

/// Log levels for controlling warning outputs
#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Silent,
    Error,
    Warn,
    Info,
    Debug,
}

pub struct Logger {
  current_level: LogLevel,
}

impl Default for LogLevel {
    fn default() -> Self {
        LogLevel::Warn
    }
}

impl LogLevel {
    /// Convert to integer for efficient comparison
    /// Lower = higher priority (Error=1, Debug=4)
    pub fn as_int(&self) -> u8 {
        match self {
            LogLevel::Silent => 0, // Special case
            LogLevel::Error => 1,  // Highest priority
            LogLevel::Warn => 2,
            LogLevel::Info => 3,
            LogLevel::Debug => 4,  // Lowest priority
        }
    }

    pub fn as_str(&self) -> &str {
        match self {
            LogLevel::Silent => "SILENT",
            LogLevel::Error => "ERROR",
            LogLevel::Warn => "WARN",
            LogLevel::Info => "INFO",
            LogLevel::Debug => "DEBUG",
        }
    }
}

impl Logger {
    /// Create a new logger with the given log level
    pub fn new(level: LogLevel) -> Self {
        Self {
            current_level: level,
        }
    }

    /// Check if a given log level is enabled
    pub fn is_level_enabled(&self, level: &LogLevel) -> bool {
        if matches!(self.current_level, LogLevel::Silent) {
            return false;
        }
        level.as_int() <= self.current_level.as_int()
    }

    /// Log a message at the given level
    pub fn log(&self, level: &LogLevel, message: &str) {
        if self.is_level_enabled(level) {
            eprintln!("[{}] {}", level.as_str(), message);
        }
    }

    /// Log a warning message
    pub fn log_warning(&self, message: &str) {
        self.log(&LogLevel::Warn, message);
    }

    /// Log an error message
    pub fn log_error(&self, message: &str) {
        self.log(&LogLevel::Error, message);
    }

    /// Log an info message
    pub fn log_info(&self, message: &str) {
        self.log(&LogLevel::Info, message);
    }

    /// Log a debug message
    pub fn log_debug(&self, message: &str) {
        self.log(&LogLevel::Debug, message);
    }

    
}