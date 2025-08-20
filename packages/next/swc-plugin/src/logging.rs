use serde::Deserialize;

/// Log levels for controlling warning outputs
#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
#[derive(Default)]
pub enum LogLevel {
  Silent,
  Error,
  #[default]
  Warn,
  Info,
  Debug,
}

pub struct Logger {
  current_level: LogLevel,
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
      LogLevel::Debug => 4, // Lowest priority
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

#[cfg(test)]
mod tests {
  use super::*;

  mod log_level {
    use super::*;

    #[test]
    fn default_log_level_is_warn() {
      let default_level = LogLevel::default();
      match default_level {
        LogLevel::Warn => assert!(true),
        _ => panic!("Default log level should be Warn"),
      }
    }

    #[test]
    fn as_int_returns_correct_priority_values() {
      assert_eq!(LogLevel::Silent.as_int(), 0);
      assert_eq!(LogLevel::Error.as_int(), 1);
      assert_eq!(LogLevel::Warn.as_int(), 2);
      assert_eq!(LogLevel::Info.as_int(), 3);
      assert_eq!(LogLevel::Debug.as_int(), 4);
    }

    #[test]
    fn as_str_returns_correct_string_representation() {
      assert_eq!(LogLevel::Silent.as_str(), "SILENT");
      assert_eq!(LogLevel::Error.as_str(), "ERROR");
      assert_eq!(LogLevel::Warn.as_str(), "WARN");
      assert_eq!(LogLevel::Info.as_str(), "INFO");
      assert_eq!(LogLevel::Debug.as_str(), "DEBUG");
    }

    #[test]
    fn priority_ordering_is_correct() {
      // Lower integer values mean higher priority
      assert!(LogLevel::Error.as_int() < LogLevel::Warn.as_int());
      assert!(LogLevel::Warn.as_int() < LogLevel::Info.as_int());
      assert!(LogLevel::Info.as_int() < LogLevel::Debug.as_int());
      assert!(LogLevel::Silent.as_int() < LogLevel::Error.as_int());
    }
  }

  mod logger_creation {
    use super::*;

    #[test]
    fn creates_logger_with_error_level() {
      let logger = Logger::new(LogLevel::Error);
      assert!(logger.is_level_enabled(&LogLevel::Error));
      assert!(!logger.is_level_enabled(&LogLevel::Warn));
    }

    #[test]
    fn creates_logger_with_warn_level() {
      let logger = Logger::new(LogLevel::Warn);
      assert!(logger.is_level_enabled(&LogLevel::Error));
      assert!(logger.is_level_enabled(&LogLevel::Warn));
      assert!(!logger.is_level_enabled(&LogLevel::Info));
    }

    #[test]
    fn creates_logger_with_info_level() {
      let logger = Logger::new(LogLevel::Info);
      assert!(logger.is_level_enabled(&LogLevel::Error));
      assert!(logger.is_level_enabled(&LogLevel::Warn));
      assert!(logger.is_level_enabled(&LogLevel::Info));
      assert!(!logger.is_level_enabled(&LogLevel::Debug));
    }

    #[test]
    fn creates_logger_with_debug_level() {
      let logger = Logger::new(LogLevel::Debug);
      assert!(logger.is_level_enabled(&LogLevel::Error));
      assert!(logger.is_level_enabled(&LogLevel::Warn));
      assert!(logger.is_level_enabled(&LogLevel::Info));
      assert!(logger.is_level_enabled(&LogLevel::Debug));
    }

    #[test]
    fn creates_logger_with_silent_level() {
      let logger = Logger::new(LogLevel::Silent);
      assert!(!logger.is_level_enabled(&LogLevel::Error));
      assert!(!logger.is_level_enabled(&LogLevel::Warn));
      assert!(!logger.is_level_enabled(&LogLevel::Info));
      assert!(!logger.is_level_enabled(&LogLevel::Debug));
    }
  }

  mod level_filtering {
    use super::*;

    #[test]
    fn error_logger_only_allows_error_messages() {
      let logger = Logger::new(LogLevel::Error);

      assert!(logger.is_level_enabled(&LogLevel::Error));
      assert!(!logger.is_level_enabled(&LogLevel::Warn));
      assert!(!logger.is_level_enabled(&LogLevel::Info));
      assert!(!logger.is_level_enabled(&LogLevel::Debug));
    }

    #[test]
    fn warn_logger_allows_error_and_warn_messages() {
      let logger = Logger::new(LogLevel::Warn);

      assert!(logger.is_level_enabled(&LogLevel::Error));
      assert!(logger.is_level_enabled(&LogLevel::Warn));
      assert!(!logger.is_level_enabled(&LogLevel::Info));
      assert!(!logger.is_level_enabled(&LogLevel::Debug));
    }

    #[test]
    fn info_logger_allows_error_warn_and_info_messages() {
      let logger = Logger::new(LogLevel::Info);

      assert!(logger.is_level_enabled(&LogLevel::Error));
      assert!(logger.is_level_enabled(&LogLevel::Warn));
      assert!(logger.is_level_enabled(&LogLevel::Info));
      assert!(!logger.is_level_enabled(&LogLevel::Debug));
    }

    #[test]
    fn debug_logger_allows_all_messages() {
      let logger = Logger::new(LogLevel::Debug);

      assert!(logger.is_level_enabled(&LogLevel::Error));
      assert!(logger.is_level_enabled(&LogLevel::Warn));
      assert!(logger.is_level_enabled(&LogLevel::Info));
      assert!(logger.is_level_enabled(&LogLevel::Debug));
    }

    #[test]
    fn silent_logger_blocks_all_messages() {
      let logger = Logger::new(LogLevel::Silent);

      assert!(!logger.is_level_enabled(&LogLevel::Error));
      assert!(!logger.is_level_enabled(&LogLevel::Warn));
      assert!(!logger.is_level_enabled(&LogLevel::Info));
      assert!(!logger.is_level_enabled(&LogLevel::Debug));
    }
  }

  mod convenience_methods {
    use super::*;

    #[test]
    fn log_error_respects_level_filtering() {
      let silent_logger = Logger::new(LogLevel::Silent);
      let error_logger = Logger::new(LogLevel::Error);

      // Silent logger should not enable error messages
      assert!(!silent_logger.is_level_enabled(&LogLevel::Error));

      // Error logger should enable error messages
      assert!(error_logger.is_level_enabled(&LogLevel::Error));
    }

    #[test]
    fn log_warning_respects_level_filtering() {
      let error_logger = Logger::new(LogLevel::Error);
      let warn_logger = Logger::new(LogLevel::Warn);

      // Error logger should not enable warning messages
      assert!(!error_logger.is_level_enabled(&LogLevel::Warn));

      // Warn logger should enable warning messages
      assert!(warn_logger.is_level_enabled(&LogLevel::Warn));
    }

    #[test]
    fn log_info_respects_level_filtering() {
      let warn_logger = Logger::new(LogLevel::Warn);
      let info_logger = Logger::new(LogLevel::Info);

      // Warn logger should not enable info messages
      assert!(!warn_logger.is_level_enabled(&LogLevel::Info));

      // Info logger should enable info messages
      assert!(info_logger.is_level_enabled(&LogLevel::Info));
    }

    #[test]
    fn log_debug_respects_level_filtering() {
      let info_logger = Logger::new(LogLevel::Info);
      let debug_logger = Logger::new(LogLevel::Debug);

      // Info logger should not enable debug messages
      assert!(!info_logger.is_level_enabled(&LogLevel::Debug));

      // Debug logger should enable debug messages
      assert!(debug_logger.is_level_enabled(&LogLevel::Debug));
    }
  }

  mod edge_cases {
    use super::*;

    #[test]
    fn same_level_comparison_works() {
      let logger = Logger::new(LogLevel::Warn);

      // Same level should be enabled
      assert!(logger.is_level_enabled(&LogLevel::Warn));
    }

    #[test]
    fn silent_level_special_behavior() {
      let logger = Logger::new(LogLevel::Silent);

      // Silent should block everything, even itself
      assert!(!logger.is_level_enabled(&LogLevel::Silent));
    }

    #[test]
    fn integer_comparison_consistency() {
      // Verify that our integer comparison logic is consistent
      let levels = [
        LogLevel::Error,
        LogLevel::Warn,
        LogLevel::Info,
        LogLevel::Debug,
      ];

      for (i, current_level) in levels.iter().enumerate() {
        let logger = Logger::new(current_level.clone());

        for (j, test_level) in levels.iter().enumerate() {
          let should_be_enabled = j <= i; // Lower or equal index means higher or equal priority
          assert_eq!(
            logger.is_level_enabled(test_level),
            should_be_enabled,
            "Logger with level {:?} should {} level {:?}",
            current_level,
            if should_be_enabled {
              "enable"
            } else {
              "disable"
            },
            test_level
          );
        }
      }
    }
  }

  mod integration_tests {
    use super::*;

    #[test]
    fn full_logging_workflow() {
      let logger = Logger::new(LogLevel::Warn);

      // Test that convenience methods work with level filtering
      // We can't easily test the actual output without capturing stderr,
      // but we can test that the level checks work correctly

      // These should be enabled
      assert!(logger.is_level_enabled(&LogLevel::Error));
      assert!(logger.is_level_enabled(&LogLevel::Warn));

      // These should be disabled
      assert!(!logger.is_level_enabled(&LogLevel::Info));
      assert!(!logger.is_level_enabled(&LogLevel::Debug));
    }

    #[test]
    fn logger_with_different_configurations() {
      let configs = [
        (LogLevel::Silent, vec![]),
        (LogLevel::Error, vec![LogLevel::Error]),
        (LogLevel::Warn, vec![LogLevel::Error, LogLevel::Warn]),
        (
          LogLevel::Info,
          vec![LogLevel::Error, LogLevel::Warn, LogLevel::Info],
        ),
        (
          LogLevel::Debug,
          vec![
            LogLevel::Error,
            LogLevel::Warn,
            LogLevel::Info,
            LogLevel::Debug,
          ],
        ),
      ];

      for (config_level, enabled_levels) in configs {
        let logger = Logger::new(config_level.clone());

        let all_levels = [
          LogLevel::Error,
          LogLevel::Warn,
          LogLevel::Info,
          LogLevel::Debug,
        ];

        for level in all_levels.iter() {
          let should_be_enabled = enabled_levels
            .iter()
            .any(|enabled| std::mem::discriminant(enabled) == std::mem::discriminant(level));

          assert_eq!(
            logger.is_level_enabled(level),
            should_be_enabled,
            "Logger configured with {:?} should {} {:?}",
            config_level,
            if should_be_enabled {
              "enable"
            } else {
              "disable"
            },
            level
          );
        }
      }
    }
  }
}
