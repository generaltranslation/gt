//! The names that a tag variable (`<const/{ a, b: [c] }=…>`) or a tag's parameters (`<for|item, i|>`)
//! declare: a scan of their binding patterns that skips default values and types.

use super::parser::Span;

/// The names `pattern`, one binding pattern, declares.
pub fn pattern_names(source: &[u8], pattern: Span, names: &mut Vec<Span>) {
  let mut scanner = Scanner {
    source,
    end: pattern.end as usize,
    names,
  };
  scanner.target(pattern.start as usize, 0);
}

/// The names `params`, a parameter list without its delimiters, declares.
pub fn param_names(source: &[u8], params: Span, names: &mut Vec<Span>) {
  let mut scanner = Scanner {
    source,
    end: params.end as usize,
    names,
  };
  let mut at = params.start as usize;

  loop {
    at = scanner.trivia(at);
    if at >= scanner.end {
      return;
    }
    if scanner.starts_with(at, b"...") {
      at += 3;
    }
    at = scanner.target(at, 0);
    at = scanner.trivia(at);
    if scanner.byte(at) == b'?' {
      at = scanner.trivia(at + 1);
    }
    if scanner.byte(at) == b':' {
      at = scanner.skip(at + 1, b",", true);
    }
    if scanner.byte(at) == b'=' {
      at = scanner.skip(at + 1, b",", false);
    }
    if scanner.byte(at) != b',' {
      return;
    }
    at += 1;
  }
}

/// Patterns nest no deeper than this; a deeper one's names are not read.
const MAX_DEPTH: u32 = 64;

struct Scanner<'s, 'n> {
  source: &'s [u8],
  end: usize,
  names: &'n mut Vec<Span>,
}

fn is_identifier_start(code: u8) -> bool {
  code.is_ascii_alphabetic() || code == b'_' || code == b'$' || code >= 0x80
}

fn is_identifier_part(code: u8) -> bool {
  is_identifier_start(code) || code.is_ascii_digit()
}

impl Scanner<'_, '_> {
  fn byte(&self, at: usize) -> u8 {
    if at < self.end {
      self.source.get(at).copied().unwrap_or(0)
    } else {
      0
    }
  }

  fn starts_with(&self, at: usize, text: &[u8]) -> bool {
    at + text.len() <= self.end && self.source.get(at..at + text.len()) == Some(text)
  }

  /// Past whitespace and comments.
  fn trivia(&self, mut at: usize) -> usize {
    loop {
      match self.byte(at) {
        b' ' | b'\t' | b'\n' | b'\r' | 0x0b | 0x0c => at += 1,
        b'/' if self.byte(at + 1) == b'/' => {
          while at < self.end && self.byte(at) != b'\n' {
            at += 1;
          }
        }
        b'/' if self.byte(at + 1) == b'*' => {
          at += 2;
          while at < self.end && !self.starts_with(at, b"*/") {
            at += 1;
          }
          at = (at + 2).min(self.end);
        }
        _ => return at,
      }
    }
  }

  /// Past a string or template literal whose quote is at `at`.
  fn string(&self, mut at: usize) -> usize {
    let quote = self.byte(at);
    at += 1;
    while at < self.end {
      let code = self.byte(at);
      if code == b'\\' {
        at += 2;
        continue;
      }
      if code == quote {
        return at + 1;
      }
      if quote == b'`' && code == b'$' && self.byte(at + 1) == b'{' {
        at = self.skip(at + 2, b"}", false) + 1;
        continue;
      }
      at += 1;
    }
    self.end
  }

  /// Past an expression or a type, to the first of `stops` outside its groups. In a type, `<…>`
  /// groups too.
  fn skip(&self, mut at: usize, stops: &[u8], is_type: bool) -> usize {
    let mut depth = 0u32;

    while at < self.end {
      let code = self.byte(at);
      if depth == 0 && stops.contains(&code) {
        return at;
      }
      match code {
        b'"' | b'\'' | b'`' => {
          at = self.string(at);
          continue;
        }
        b'/' if matches!(self.byte(at + 1), b'/' | b'*') => {
          at = self.trivia(at);
          continue;
        }
        b'(' | b'[' | b'{' => depth += 1,
        b'<' if is_type => depth += 1,
        b')' | b']' | b'}' => {
          if depth == 0 {
            return at;
          }
          depth -= 1;
        }
        b'>' if is_type && depth > 0 && self.byte(at.saturating_sub(1)) != b'=' => depth -= 1,
        _ => {}
      }
      at += 1;
    }
    self.end
  }

  /// Reads one binding target at `at`: a name, or an object or array pattern.
  fn target(&mut self, at: usize, depth: u32) -> usize {
    let at = self.trivia(at);
    if depth > MAX_DEPTH {
      return self.end;
    }

    match self.byte(at) {
      b'{' => self.object(at + 1, depth + 1),
      b'[' => self.array(at + 1, depth + 1),
      code if is_identifier_start(code) => {
        let end = self.identifier(at);
        self.names.push(Span {
          start: at as u32,
          end: end as u32,
        });
        end
      }
      _ => self.end,
    }
  }

  fn identifier(&self, mut at: usize) -> usize {
    while at < self.end && is_identifier_part(self.byte(at)) {
      at += 1;
    }
    at
  }

  fn object(&mut self, mut at: usize, depth: u32) -> usize {
    loop {
      at = self.trivia(at);
      match self.byte(at) {
        b'}' => return at + 1,
        0 => return self.end,
        _ => {}
      }

      if self.starts_with(at, b"...") {
        at = self.target(at + 3, depth);
      } else {
        let key = at;
        let key_end = match self.byte(at) {
          b'[' => self.skip(at + 1, b"]", false) + 1,
          b'"' | b'\'' => self.string(at),
          code if is_identifier_part(code) => self.identifier(at),
          _ => return self.end,
        };
        at = self.trivia(key_end);

        if self.byte(at) == b':' {
          at = self.target(at + 1, depth);
        } else if is_identifier_start(self.byte(key)) {
          self.names.push(Span {
            start: key as u32,
            end: key_end as u32,
          });
        }
      }

      at = self.trivia(at);
      if self.byte(at) == b'=' {
        at = self.skip(at + 1, b",}", false);
      }
      match self.byte(at) {
        b',' => at += 1,
        b'}' => return at + 1,
        _ => return self.end,
      }
    }
  }

  fn array(&mut self, mut at: usize, depth: u32) -> usize {
    loop {
      at = self.trivia(at);
      match self.byte(at) {
        b']' => return at + 1,
        b',' => {
          at += 1;
          continue;
        }
        0 => return self.end,
        _ => {}
      }

      if self.starts_with(at, b"...") {
        at += 3;
      }
      at = self.target(at, depth);
      at = self.trivia(at);
      if self.byte(at) == b'=' {
        at = self.skip(at + 1, b",]", false);
      }
      match self.byte(at) {
        b',' => at += 1,
        b']' => return at + 1,
        _ => return self.end,
      }
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  fn names(text: &str, read: fn(&[u8], Span, &mut Vec<Span>)) -> Vec<&str> {
    let mut found = Vec::new();
    let span = Span {
      start: 0,
      end: text.len() as u32,
    };
    read(text.as_bytes(), span, &mut found);
    found
      .iter()
      .map(|span| &text[span.start as usize..span.end as usize])
      .collect()
  }

  #[test]
  fn a_pattern_declares_its_names_not_its_keys_defaults_or_types() {
    assert_eq!(names("count", pattern_names), ["count"]);
    assert_eq!(names("count:number", pattern_names), ["count"]);
    assert_eq!(
      names(
        "{ a, b: c, d = m.x({ e }), [k]: f, 'g': [h, , i = 1], ...rest }",
        pattern_names
      ),
      ["a", "c", "d", "f", "h", "i", "rest"]
    );
    assert_eq!(names("[x = `${y}`, { z }]", pattern_names), ["x", "z"]);
  }

  #[test]
  fn parameters_declare_their_names() {
    assert_eq!(names("item, index", param_names), ["item", "index"]);
    assert_eq!(
      names(
        " { label }: Map<string, Row>, i?: number, ...rest ",
        param_names
      ),
      ["label", "i", "rest"]
    );
    assert_eq!(names("a = f(b, c), d", param_names), ["a", "d"]);
    assert_eq!(names("", param_names), Vec::<&str>::new());
  }
}
