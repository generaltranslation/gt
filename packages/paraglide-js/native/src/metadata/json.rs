//! JSON as JavaScript's `JSON.parse` and `JSON.stringify(value, null, 2)` read and write it, with
//! strings as WTF-8: UTF-8 that may also hold lone surrogates, as a JavaScript string may.

use std::{borrow::Borrow, cmp::Ordering, hash::Hash};

use rustc_hash::FxHashMap;

/// A JavaScript string, as WTF-8.
pub type JsStr = Box<[u8]>;

/// A value `JSON.parse` returns.
#[derive(Debug, Clone, PartialEq)]
pub enum Value {
  Null,
  Bool(bool),
  Number(f64),
  String(JsStr),
  Array(Vec<Value>),
  Object(Object),
}

impl Value {
  pub fn as_object(&self) -> Option<&Object> {
    match self {
      Value::Object(object) => Some(object),
      _ => None,
    }
  }

  pub fn as_array(&self) -> Option<&[Value]> {
    match self {
      Value::Array(items) => Some(items),
      _ => None,
    }
  }

  pub fn as_str(&self) -> Option<&[u8]> {
    match self {
      Value::String(text) => Some(text),
      _ => None,
    }
  }

  pub fn as_f64(&self) -> Option<f64> {
    match self {
      Value::Number(number) => Some(*number),
      _ => None,
    }
  }

  /// What JavaScript's `Boolean(value)` would be for a field that is `true` or missing.
  pub fn is_true(&self) -> bool {
    matches!(self, Value::Bool(true))
  }
}

/// An object with more members than this finds a key by a map, not by a walk.
const INDEXED: usize = 16;

/// An object's members in the order their keys were first set, where a duplicate key's value
/// replaces the first one's in place, as `JSON.parse` and `Object.defineProperty` do.
#[derive(Debug, Clone)]
pub struct Object<K = JsStr, V = Value> {
  members: Vec<(K, V)>,
  index: Option<FxHashMap<K, usize>>,
}

impl<K, V> Default for Object<K, V> {
  fn default() -> Self {
    Object {
      members: Vec::new(),
      index: None,
    }
  }
}

impl PartialEq for Object {
  fn eq(&self, other: &Self) -> bool {
    self.members == other.members
  }
}

impl<K: Borrow<[u8]> + Eq + Hash + Clone, V> Object<K, V> {
  pub fn is_empty(&self) -> bool {
    self.members.is_empty()
  }

  /// In the order the keys were first set; see `js_order` for the order JavaScript enumerates them in.
  pub fn members(&self) -> &[(K, V)] {
    &self.members
  }

  pub fn position(&self, key: &[u8]) -> Option<usize> {
    match &self.index {
      Some(index) => index.get(key).copied(),
      None => self
        .members
        .iter()
        .position(|(other, _)| other.borrow() == key),
    }
  }

  /// An own member, as `Object.hasOwn` finds it.
  pub fn get(&self, key: &[u8]) -> Option<&V> {
    self.position(key).map(|position| &self.members[position].1)
  }

  pub fn value_at_mut(&mut self, position: usize) -> &mut V {
    &mut self.members[position].1
  }

  /// Sets a member, keeping the place of a key that is there, and returns its position.
  pub fn insert(&mut self, key: K, value: V) -> usize {
    if let Some(position) = self.position(key.borrow()) {
      self.members[position].1 = value;
      return position;
    }

    let position = self.members.len();
    if let Some(index) = &mut self.index {
      index.insert(key.clone(), position);
    } else if position >= INDEXED {
      let mut index: FxHashMap<K, usize> = self
        .members
        .iter()
        .enumerate()
        .map(|(position, (key, _))| (key.clone(), position))
        .collect();
      index.insert(key.clone(), position);
      self.index = Some(index);
    }

    self.members.push((key, value));
    position
  }
}

// ---------------------------------------------------------------- key order

/// The array index a key names, which JavaScript enumerates first in ascending order: `"12"` is
/// one, but not `"012"`, `"-1"` or `"4294967295"`.
pub fn array_index(key: &[u8]) -> Option<u32> {
  match key {
    [b'0'] => Some(0),
    [b'1'..=b'9', rest @ ..] if rest.len() < 10 && rest.iter().all(u8::is_ascii_digit) => {
      let value = key
        .iter()
        .fold(0u64, |value, digit| value * 10 + u64::from(digit - b'0'));
      // 2³² − 1 is the largest length an array may have, so not an index.
      (value < u64::from(u32::MAX)).then_some(value as u32)
    }
    _ => None,
  }
}

/// The positions of `count` keys in the order JavaScript enumerates an object's
/// own keys: array indexes ascending, then the others in the order they were set.
pub fn js_order<'k>(count: usize, key: impl Fn(usize) -> &'k [u8]) -> Vec<usize> {
  let indexes: Vec<(u32, usize)> = (0..count)
    .filter_map(|position| array_index(key(position)).map(|index| (index, position)))
    .collect();

  if indexes.is_empty() {
    return (0..count).collect();
  }

  let mut order: Vec<usize> = Vec::with_capacity(count);
  let mut sorted = indexes;
  sorted.sort_unstable();
  order.extend(sorted.iter().map(|&(_, position)| position));
  order.extend((0..count).filter(|&position| array_index(key(position)).is_none()));

  order
}

// ---------------------------------------------------------------- UTF-16

/// The UTF-16 code units of a WTF-8 string, as JavaScript holds it.
pub fn utf16_units(text: &[u8]) -> impl Iterator<Item = u16> + '_ {
  let mut at = 0;
  let mut low: Option<u16> = None;

  std::iter::from_fn(move || {
    if let Some(unit) = low.take() {
      return Some(unit);
    }

    let (point, length) = code_point_at(text, at)?;
    at += length;

    if point < 0x1_0000 {
      return Some(point as u16);
    }

    let offset = point - 0x1_0000;
    low = Some(0xDC00 | (offset & 0x3FF) as u16);
    Some(0xD800 | (offset >> 10) as u16)
  })
}

/// The code point at `at` of a WTF-8 string, and its length in bytes.
fn code_point_at(text: &[u8], at: usize) -> Option<(u32, usize)> {
  let lead = *text.get(at)?;
  let continuation =
    |offset: usize| u32::from(text.get(at + offset).copied().unwrap_or(0x80) & 0x3F);

  Some(match lead {
    0x00..=0x7F => (u32::from(lead), 1),
    0xC0..=0xDF => ((u32::from(lead & 0x1F) << 6) | continuation(1), 2),
    0xE0..=0xEF => (
      (u32::from(lead & 0x0F) << 12) | (continuation(1) << 6) | continuation(2),
      3,
    ),
    0xF0..=0xF7 => (
      (u32::from(lead & 0x07) << 18)
        | (continuation(1) << 12)
        | (continuation(2) << 6)
        | continuation(3),
      4,
    ),
    // Not a lead byte: the strings here are WTF-8, so this is never reached.
    _ => (0xFFFD, 1),
  })
}

/// Orders texts by their UTF-16 code units, as JavaScript's `<` does, which differs from UTF-8's
/// byte order above U+FFFF.
pub fn compare_utf16(a: &[u8], b: &[u8]) -> Ordering {
  if a.is_ascii() && b.is_ascii() {
    return a.cmp(b);
  }

  utf16_units(a).cmp(utf16_units(b))
}

/// Appends a UTF-16 code unit to a WTF-8 string: a low surrogate after a high one
/// makes one character with it, as two code units of a JavaScript string do.
pub fn push_code_unit(out: &mut Vec<u8>, unit: u16) {
  if (0xDC00..=0xDFFF).contains(&unit) {
    if let Some(high) = trailing_high_surrogate(out) {
      out.truncate(out.len() - 3);
      let point = 0x1_0000 + ((u32::from(high) - 0xD800) << 10) + (u32::from(unit) - 0xDC00);
      push_code_point(out, point);
      return;
    }
  }

  push_code_point(out, u32::from(unit));
}

/// The code unit of a surrogate's last two bytes in WTF-8, `0xED` being the first.
#[inline]
fn surrogate_unit(second: u8, third: u8) -> u16 {
  0xD000 | (u16::from(second & 0x3F) << 6) | u16::from(third & 0x3F)
}

/// Appends WTF-8 to WTF-8, joining a high surrogate that ends `out` with a low one that starts `text`.
pub fn extend_wtf8(out: &mut Vec<u8>, text: &[u8]) {
  if let [0xED, 0xB0..=0xBF, _, ..] = text {
    if trailing_high_surrogate(out).is_some() {
      push_code_unit(out, surrogate_unit(text[1], text[2]));
      out.extend_from_slice(&text[3..]);
      return;
    }
  }

  out.extend_from_slice(text);
}

fn trailing_high_surrogate(out: &[u8]) -> Option<u16> {
  match out {
    [.., 0xED, second @ 0xA0..=0xAF, third] => Some(surrogate_unit(*second, *third)),
    _ => None,
  }
}

fn push_code_point(out: &mut Vec<u8>, point: u32) {
  match point {
    0..=0x7F => out.push(point as u8),
    0x80..=0x7FF => {
      out.extend_from_slice(&[0xC0 | (point >> 6) as u8, 0x80 | (point & 0x3F) as u8])
    }
    0x800..=0xFFFF => out.extend_from_slice(&[
      0xE0 | (point >> 12) as u8,
      0x80 | ((point >> 6) & 0x3F) as u8,
      0x80 | (point & 0x3F) as u8,
    ]),
    _ => out.extend_from_slice(&[
      0xF0 | (point >> 18) as u8,
      0x80 | ((point >> 12) & 0x3F) as u8,
      0x80 | ((point >> 6) & 0x3F) as u8,
      0x80 | (point & 0x3F) as u8,
    ]),
  }
}

// ---------------------------------------------------------------- byte search

const ONES: u64 = 0x0101_0101_0101_0101;
const HIGHS: u64 = 0x8080_8080_8080_8080;

#[inline]
fn has_zero(word: u64) -> bool {
  word.wrapping_sub(ONES) & !word & HIGHS != 0
}

/// Whether a byte of `word` is less than `limit`, at most 128.
#[inline]
fn has_less(word: u64, limit: u8) -> bool {
  word.wrapping_sub(ONES * u64::from(limit)) & !word & HIGHS != 0
}

/// The first byte of `text` that is `"`, `\`, a control character, or (if `surrogates`) 0xED, which
/// starts a surrogate's three bytes.
#[inline]
fn find_special(text: &[u8], surrogates: bool) -> Option<usize> {
  let mut at = 0;

  while at + 8 <= text.len() {
    let mut word = [0; 8];
    word.copy_from_slice(&text[at..at + 8]);
    let word = u64::from_le_bytes(word);

    let special = has_zero(word ^ (ONES * u64::from(b'"')))
      || has_zero(word ^ (ONES * u64::from(b'\\')))
      || has_less(word, 0x20)
      || (surrogates && has_zero(word ^ (ONES * 0xED)));
    if special {
      break;
    }
    at += 8;
  }

  text[at..]
    .iter()
    .position(|&byte| byte == b'"' || byte == b'\\' || byte < 0x20 || (surrogates && byte == 0xED))
    .map(|position| at + position)
}

// ---------------------------------------------------------------- parsing

/// Values nested deeper than this are not kept, since `JSON.stringify` overflows JavaScript's stack
/// a little deeper.
pub const MAX_DEPTH: usize = 5000;

#[derive(Debug)]
pub struct Invalid;

type Parsed<T> = Result<T, Invalid>;

/// The key paths of a message file's messages: what of a metadata file is read.
#[derive(Debug, Default)]
pub struct KeyPaths {
  children: FxHashMap<JsStr, KeyPaths>,
  /// A message is at this path.
  is_key: bool,
}

impl KeyPaths {
  pub fn add(&mut self, path: &[&[u8]]) {
    let mut node = self;
    for key in path {
      node = node.children.entry((*key).into()).or_default();
    }
    node.is_key = true;
  }
}

/// What of a value is kept.
#[derive(Clone, Copy)]
enum Guide<'g> {
  Keep,
  /// Nothing: it is only checked to be JSON.
  Skip,
  /// An object's members on these paths, with any other value kept as `null` since all that is
  /// asked of it is that it is not an object.
  Along(&'g KeyPaths),
}

/// A metadata file's object with only what is along `paths`, or None if the text is not the JSON of
/// an object; the flag says whether a kept value nests deeper than `MAX_DEPTH`.
pub fn parse_object_along(text: &[u8], paths: &KeyPaths) -> Option<(Object, bool)> {
  let mut parser = Parser::new(text);

  parser.whitespace();
  let object = parser.object_along(paths, 0).ok()?;
  parser.whitespace();

  (parser.at == text.len()).then_some((object, parser.too_deep))
}

/// The value of a JSON text; None if it is not JSON, or nests deeper than `MAX_DEPTH`.
pub fn parse(text: &[u8]) -> Option<Value> {
  let mut parser = Parser::new(text);

  let value = parser.value(Guide::Keep, 0).ok()?;
  parser.whitespace();

  (parser.at == text.len() && !parser.too_deep).then_some(value)
}

/// Whether a text is JSON, of any depth.
#[cfg(test)]
pub fn is_json(text: &[u8]) -> bool {
  let mut parser = Parser::new(text);

  parser.skip_value().is_ok() && {
    parser.whitespace();
    parser.at == text.len()
  }
}

struct Parser<'t> {
  text: &'t [u8],
  at: usize,
  too_deep: bool,
}

impl<'t> Parser<'t> {
  fn new(text: &'t [u8]) -> Self {
    Parser {
      text,
      at: 0,
      too_deep: false,
    }
  }

  #[inline]
  fn peek(&self) -> Option<u8> {
    self.text.get(self.at).copied()
  }

  #[inline]
  fn whitespace(&mut self) {
    while let Some(b' ' | b'\t' | b'\n' | b'\r') = self.peek() {
      self.at += 1;
    }
  }

  #[inline]
  fn eat(&mut self, byte: u8) -> Parsed<()> {
    if self.peek() != Some(byte) {
      return Err(Invalid);
    }
    self.at += 1;
    Ok(())
  }

  fn value(&mut self, guide: Guide, depth: usize) -> Parsed<Value> {
    self.whitespace();

    match guide {
      Guide::Along(paths) if self.peek() == Some(b'{') => {
        self.object_along(paths, depth).map(Value::Object)
      }
      Guide::Skip | Guide::Along(_) => {
        self.skip_value()?;
        Ok(Value::Null)
      }
      Guide::Keep => self.kept_value(depth),
    }
  }

  /// Parses a value at `depth` on a stack of its own, so that how deep a value may be does not
  /// depend on the thread's stack.
  fn kept_value(&mut self, depth: usize) -> Parsed<Value> {
    enum Open {
      Array(Vec<Value>),
      /// The object, and the key of the member whose value is next.
      Object(Object, JsStr),
    }

    let mut open: Vec<Open> = Vec::new();

    loop {
      self.whitespace();
      let mut value = if depth + open.len() >= MAX_DEPTH {
        self.too_deep = true;
        self.skip_value()?;
        Value::Null
      } else {
        match self.peek() {
          Some(b'{') => {
            self.at += 1;
            self.whitespace();
            if self.peek() == Some(b'}') {
              self.at += 1;
              Value::Object(Object::default())
            } else {
              let key = self.member_name()?;
              open.push(Open::Object(Object::default(), key));
              continue;
            }
          }
          Some(b'[') => {
            self.at += 1;
            self.whitespace();
            if self.peek() == Some(b']') {
              self.at += 1;
              Value::Array(Vec::new())
            } else {
              open.push(Open::Array(Vec::new()));
              continue;
            }
          }
          Some(b'"') => Value::String(self.string()?),
          Some(b't') => self.literal(b"true").map(|()| Value::Bool(true))?,
          Some(b'f') => self.literal(b"false").map(|()| Value::Bool(false))?,
          Some(b'n') => self.literal(b"null").map(|()| Value::Null)?,
          Some(b'-' | b'0'..=b'9') => self.number()?,
          _ => return Err(Invalid),
        }
      };

      loop {
        self.whitespace();
        match open.last_mut() {
          None => return Ok(value),
          Some(Open::Array(items)) => {
            items.push(value);
            match self.peek() {
              Some(b',') => {
                self.at += 1;
                break;
              }
              Some(b']') => {
                self.at += 1;
                let Some(Open::Array(items)) = open.pop() else {
                  return Err(Invalid);
                };
                value = Value::Array(items);
              }
              _ => return Err(Invalid),
            }
          }
          Some(Open::Object(object, key)) => {
            object.insert(std::mem::take(key), value);
            match self.peek() {
              Some(b',') => {
                self.at += 1;
                self.whitespace();
                *key = self.member_name()?;
                break;
              }
              Some(b'}') => {
                self.at += 1;
                let Some(Open::Object(object, _)) = open.pop() else {
                  return Err(Invalid);
                };
                value = Value::Object(object);
              }
              _ => return Err(Invalid),
            }
          }
        }
      }
    }
  }

  /// `"key":`, decoded.
  fn member_name(&mut self) -> Parsed<JsStr> {
    let key = self.string()?;
    self.whitespace();
    self.eat(b':')?;
    Ok(key)
  }

  fn object_along(&mut self, paths: &KeyPaths, depth: usize) -> Parsed<Object> {
    self.eat(b'{')?;
    let mut object = Object::default();

    self.whitespace();
    if self.peek() == Some(b'}') {
      self.at += 1;
      return Ok(object);
    }

    loop {
      self.whitespace();
      let key = self.member_name()?;

      let member = if paths.is_key {
        // A message's own fields are kept, but for the snippets written before.
        if &*key == b"sourceCode" && !paths.children.contains_key(&key) {
          Guide::Skip
        } else {
          Guide::Keep
        }
      } else {
        paths.children.get(&key).map_or(Guide::Skip, Guide::Along)
      };

      let value = self.value(member, depth + 1)?;
      if !matches!(member, Guide::Skip) {
        object.insert(key, value);
      }

      self.whitespace();
      match self.peek() {
        Some(b',') => self.at += 1,
        Some(b'}') => {
          self.at += 1;
          return Ok(object);
        }
        _ => return Err(Invalid),
      }
    }
  }

  fn literal(&mut self, word: &[u8]) -> Parsed<()> {
    if !self.text[self.at..].starts_with(word) {
      return Err(Invalid);
    }
    self.at += word.len();
    Ok(())
  }

  /// `-? (0 | [1-9][0-9]*) (. [0-9]+)? ([eE] [+-]? [0-9]+)?`
  fn number_text(&mut self) -> Parsed<&[u8]> {
    let start = self.at;
    if self.peek() == Some(b'-') {
      self.at += 1;
    }

    match self.peek() {
      Some(b'0') => self.at += 1,
      Some(b'1'..=b'9') => self.digits(),
      _ => return Err(Invalid),
    }

    if self.peek() == Some(b'.') {
      self.at += 1;
      self.required_digits()?;
    }

    if let Some(b'e' | b'E') = self.peek() {
      self.at += 1;
      if let Some(b'+' | b'-') = self.peek() {
        self.at += 1;
      }
      self.required_digits()?;
    }

    Ok(&self.text[start..self.at])
  }

  fn digits(&mut self) {
    while let Some(b'0'..=b'9') = self.peek() {
      self.at += 1;
    }
  }

  fn required_digits(&mut self) -> Parsed<()> {
    let start = self.at;
    self.digits();
    if self.at == start {
      return Err(Invalid);
    }
    Ok(())
  }

  fn number(&mut self) -> Parsed<Value> {
    let text = self.number_text()?;
    // The grammar above is a part of Rust's, which rounds as JavaScript does; too
    // large a number is infinite in both.
    let number = std::str::from_utf8(text)
      .ok()
      .and_then(|text| text.parse::<f64>().ok())
      .ok_or(Invalid)?;

    Ok(Value::Number(number))
  }

  fn string(&mut self) -> Parsed<JsStr> {
    self.eat(b'"')?;
    let mut out: Vec<u8> = Vec::new();

    loop {
      let rest = &self.text[self.at..];
      let run = find_special(rest, false).ok_or(Invalid)?;

      if rest[run] == b'"' && out.is_empty() {
        self.at += run + 1;
        return Ok(rest[..run].into());
      }

      extend_wtf8(&mut out, &rest[..run]);
      self.at += run;

      match self.peek() {
        Some(b'"') => {
          self.at += 1;
          return Ok(out.into_boxed_slice());
        }
        Some(b'\\') => {
          self.at += 1;
          let escaped = self.peek().ok_or(Invalid)?;
          self.at += 1;
          match escaped {
            b'"' | b'\\' | b'/' => out.push(escaped),
            b'b' => out.push(0x08),
            b'f' => out.push(0x0C),
            b'n' => out.push(b'\n'),
            b'r' => out.push(b'\r'),
            b't' => out.push(b'\t'),
            b'u' => {
              let unit = self.hex_unit()?;
              push_code_unit(&mut out, unit);
            }
            _ => return Err(Invalid),
          }
        }
        // A control character must be escaped.
        _ => return Err(Invalid),
      }
    }
  }

  fn hex_unit(&mut self) -> Parsed<u16> {
    let digits = self.text.get(self.at..self.at + 4).ok_or(Invalid)?;
    let mut unit: u16 = 0;
    for &digit in digits {
      let value = (digit as char).to_digit(16).ok_or(Invalid)?;
      unit = unit << 4 | value as u16;
    }
    self.at += 4;
    Ok(unit)
  }

  fn skip_string(&mut self) -> Parsed<()> {
    self.eat(b'"')?;

    loop {
      let rest = &self.text[self.at..];
      let run = find_special(rest, false).ok_or(Invalid)?;
      self.at += run;

      match self.peek() {
        Some(b'"') => {
          self.at += 1;
          return Ok(());
        }
        Some(b'\\') => {
          self.at += 1;
          match self.peek() {
            Some(b'"' | b'\\' | b'/' | b'b' | b'f' | b'n' | b'r' | b't') => self.at += 1,
            Some(b'u') => {
              self.at += 1;
              self.hex_unit()?;
            }
            _ => return Err(Invalid),
          }
        }
        _ => return Err(Invalid),
      }
    }
  }

  /// Checks a value without keeping it, at any depth: `JSON.parse` has no limit.
  fn skip_value(&mut self) -> Parsed<()> {
    // Whether each open container is an object.
    let mut open: Vec<bool> = Vec::new();

    loop {
      self.whitespace();
      match self.peek() {
        Some(b'{') => {
          self.at += 1;
          self.whitespace();
          if self.peek() == Some(b'}') {
            self.at += 1;
          } else {
            open.push(true);
            self.member_key()?;
            continue;
          }
        }
        Some(b'[') => {
          self.at += 1;
          self.whitespace();
          if self.peek() == Some(b']') {
            self.at += 1;
          } else {
            open.push(false);
            continue;
          }
        }
        Some(b'"') => self.skip_string()?,
        Some(b't') => self.literal(b"true")?,
        Some(b'f') => self.literal(b"false")?,
        Some(b'n') => self.literal(b"null")?,
        Some(b'-' | b'0'..=b'9') => {
          self.number_text()?;
        }
        _ => return Err(Invalid),
      }

      loop {
        let Some(&is_object) = open.last() else {
          return Ok(());
        };

        self.whitespace();
        match self.peek() {
          Some(b',') => {
            self.at += 1;
            if is_object {
              self.whitespace();
              self.member_key()?;
            }
            break;
          }
          Some(b'}') if is_object => {
            self.at += 1;
            open.pop();
          }
          Some(b']') if !is_object => {
            self.at += 1;
            open.pop();
          }
          _ => return Err(Invalid),
        }
      }
    }
  }

  /// `"key":`
  fn member_key(&mut self) -> Parsed<()> {
    self.skip_string()?;
    self.whitespace();
    self.eat(b':')
  }
}

// ---------------------------------------------------------------- writing

/// Writes a string as `JSON.stringify` does, and with `crlf_as_lf` leaves out a `\r` before a `\n`
/// as `split(/\r?\n/).join("\n")` does.
pub fn write_string(out: &mut Vec<u8>, text: &[u8], crlf_as_lf: bool) {
  out.reserve(text.len() + 2);
  out.push(b'"');

  let mut at = 0;
  while let Some(run) = find_special(&text[at..], true) {
    out.extend_from_slice(&text[at..at + run]);
    at += run;

    let byte = text[at];
    match byte {
      b'"' => out.extend_from_slice(b"\\\""),
      b'\\' => out.extend_from_slice(b"\\\\"),
      b'\n' => out.extend_from_slice(b"\\n"),
      b'\r' if crlf_as_lf && text.get(at + 1) == Some(&b'\n') => {}
      b'\r' => out.extend_from_slice(b"\\r"),
      b'\t' => out.extend_from_slice(b"\\t"),
      0x08 => out.extend_from_slice(b"\\b"),
      0x0C => out.extend_from_slice(b"\\f"),
      0x00..=0x1F => write_unit_escape(out, u16::from(byte)),
      // 0xED: a surrogate if the next byte is 0xA0 or more, else a character of U+D000–U+D7FF.
      _ => {
        let sequence = &text[at..(at + 3).min(text.len())];
        match sequence {
          [0xED, second @ 0xA0..=0xBF, third] => {
            write_unit_escape(out, surrogate_unit(*second, *third));
          }
          _ => out.extend_from_slice(sequence),
        }
        at += sequence.len();
        continue;
      }
    }
    at += 1;
  }

  out.extend_from_slice(&text[at..]);
  out.push(b'"');
}

fn write_unit_escape(out: &mut Vec<u8>, unit: u16) {
  const HEX: &[u8; 16] = b"0123456789abcdef";
  out.extend_from_slice(b"\\u");
  for shift in [12, 8, 4, 0] {
    out.push(HEX[usize::from((unit >> shift) & 0xF)]);
  }
}

/// A number as JavaScript writes it; `null` for one that is not finite.
pub fn write_number(out: &mut Vec<u8>, number: f64) {
  if !number.is_finite() {
    out.extend_from_slice(b"null");
    return;
  }

  let mut buffer = ryu_js::Buffer::new();
  out.extend_from_slice(buffer.format_finite(number).as_bytes());
}

#[inline]
pub fn newline(out: &mut Vec<u8>, level: usize) {
  out.push(b'\n');
  for _ in 0..level {
    out.extend_from_slice(b"  ");
  }
}

/// A value as `JSON.stringify(value, null, 2)` writes it at `level`.
pub fn write_value(out: &mut Vec<u8>, value: &Value, level: usize) {
  /// A container being written, and the position of its next member.
  enum Open<'v> {
    Array(&'v [Value], usize),
    Object(&'v [(JsStr, Value)], Vec<usize>, usize),
  }

  let mut open: Vec<Open> = Vec::new();
  let mut next = Some(value);

  loop {
    if let Some(value) = next.take() {
      match value {
        Value::Null => out.extend_from_slice(b"null"),
        Value::Bool(true) => out.extend_from_slice(b"true"),
        Value::Bool(false) => out.extend_from_slice(b"false"),
        Value::Number(number) => write_number(out, *number),
        Value::String(text) => write_string(out, text, false),
        Value::Array(items) if items.is_empty() => out.extend_from_slice(b"[]"),
        Value::Object(object) if object.is_empty() => out.extend_from_slice(b"{}"),
        Value::Array(items) => {
          out.push(b'[');
          open.push(Open::Array(items, 0));
        }
        Value::Object(object) => {
          out.push(b'{');
          let members = object.members();
          let order = js_order(members.len(), |member| &members[member].0);
          open.push(Open::Object(members, order, 0));
        }
      }
    }

    let depth = level + open.len();
    match open.last_mut() {
      None => return,
      Some(Open::Array(items, position)) => {
        if *position == items.len() {
          newline(out, depth - 1);
          out.push(b']');
          open.pop();
          continue;
        }
        if *position > 0 {
          out.push(b',');
        }
        newline(out, depth);
        next = Some(&items[*position]);
        *position += 1;
      }
      Some(Open::Object(members, order, position)) => {
        if *position == order.len() {
          newline(out, depth - 1);
          out.push(b'}');
          open.pop();
          continue;
        }
        if *position > 0 {
          out.push(b',');
        }
        newline(out, depth);
        let (key, value) = &members[order[*position]];
        write_string(out, key, false);
        out.extend_from_slice(b": ");
        next = Some(value);
        *position += 1;
      }
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  fn stringify(value: &Value) -> String {
    let mut out = Vec::new();
    write_value(&mut out, value, 0);
    String::from_utf8(out).unwrap_or_default()
  }

  fn round_trip(text: &str) -> Option<String> {
    parse(text.as_bytes()).map(|value| stringify(&value))
  }

  fn compact(text: &str) -> String {
    text
      .split('\n')
      .map(str::trim_start)
      .collect::<String>()
      .replace("\": ", "\":")
  }

  #[test]
  fn writes_as_json_stringify_does() {
    // What Node gives for each, with `JSON.stringify(JSON.parse(text))`.
    let cases = [
      ("null", "null"),
      ("true", "true"),
      (" [ ] ", "[]"),
      ("{ }", "{}"),
      ("[-0, 1e400, -1e400, 1.0, 5e-324, 1e21, 1e-7, 123456789012345678901234567890, 0.1, 2e-7, 1.7976931348623157e308]",
        "[0,null,null,1,5e-324,1e+21,1e-7,1.2345678901234568e+29,0.1,2e-7,1.7976931348623157e+308]"),
      (r#""\ud800 \udc00 \ud83d\ude00 \u2028 \u007f \u0000 \u001f \/ \b\f\n\r\t""#,
        "\"\\ud800 \\udc00 😀 \u{2028} \u{7f} \\u0000 \\u001f / \\b\\f\\n\\r\\t\""),
      (r#""\uD83D\uDE00 \uDE00\uD83D \uD83D""#, "\"😀 \\ude00\\ud83d \\ud83d\""),
      (r#"{"b":1,"4294967295":2,"4294967294":3,"1":4,"01":5,"-1":6,"0":7,"a":8,"b":9}"#,
        r#"{"0":7,"1":4,"4294967294":3,"b":9,"4294967295":2,"01":5,"-1":6,"a":8}"#),
      (r#"{"__proto__": {"a": [1, {"b": null}]}}"#, r#"{"__proto__":{"a":[1,{"b":null}]}}"#),
      (r#"{"é": 1, "\u00e9": 2}"#, r#"{"é":2}"#),
      ("[1E2, 1e+2, -0.0, 0.000001, 1e-6, 100e-2]", "[100,100,0,0.000001,0.000001,1]"),
    ];

    for (text, expected) in cases {
      assert_eq!(
        round_trip(text).map(|out| compact(&out)),
        Some(expected.to_string()),
        "{text}"
      );
    }
  }

  #[test]
  fn indents_by_two_spaces() {
    let written = round_trip(r#"{"a":[1,[],{}],"b":{"c":"d"}}"#);
    assert_eq!(
      written.as_deref(),
      Some("{\n  \"a\": [\n    1,\n    [],\n    {}\n  ],\n  \"b\": {\n    \"c\": \"d\"\n  }\n}")
    );
  }

  #[test]
  fn rejects_what_json_parse_rejects() {
    for text in [
      "",
      " ",
      "{",
      "}",
      "[1,]",
      "{\"a\":1,}",
      "{'a':1}",
      "{a:1}",
      "01",
      "+1",
      ".5",
      "1.",
      "1e",
      "1e+",
      "0x10",
      "NaN",
      "Infinity",
      "-",
      "--1",
      "\"a",
      "\"\\x\"",
      "\"\\u12\"",
      "\"\\u12g4\"",
      "\"\t\"",
      "\"\n\"",
      "\u{feff}{}",
      "{}{}",
      "{} x",
      "[1 2]",
      "{\"a\" 1}",
      "{\"a\":}",
      "tru",
      "nul",
      "{\"a\":1 \"b\":2}",
      "\u{a0}{}",
      "\u{b}{}",
      "\u{c}{}",
      "// x\n{}",
      "{\"a\":1}/**/",
    ] {
      assert!(!is_json(text.as_bytes()), "{text:?} is not JSON");
      assert!(parse(text.as_bytes()).is_none(), "{text:?} is not JSON");
    }

    for text in [
      "{}",
      " \t\r\n{} \n",
      "[[[[]]]]",
      "\"\u{2028}\"",
      "-0",
      "0e0",
      "1E-0",
    ] {
      assert!(is_json(text.as_bytes()), "{text:?} is JSON");
    }
  }

  #[test]
  fn checks_any_depth_but_keeps_only_so_deep() {
    let deep = |depth: usize| format!("{}{}", "[".repeat(depth), "]".repeat(depth));

    assert!(is_json(deep(1_000_000).as_bytes()));
    assert!(!is_json(format!("{}]", deep(1_000_000)).as_bytes()));
    assert!(parse(deep(MAX_DEPTH).as_bytes()).is_some());
    assert!(parse(deep(MAX_DEPTH + 1).as_bytes()).is_none());

    let mut paths = KeyPaths::default();
    paths.add(&[b"a"]);
    let nested = |depth: usize| {
      format!(
        r#"{{"a": {{"b": {}}}, "c": {}}}"#,
        deep(depth),
        deep(1_000_000)
      )
    };
    let (_, too_deep) = parse_object_along(nested(100).as_bytes(), &paths).unwrap_or_default();
    assert!(!too_deep);
    let (_, too_deep) =
      parse_object_along(nested(MAX_DEPTH).as_bytes(), &paths).unwrap_or_default();
    assert!(too_deep);
    assert!(parse_object_along(format!("{}]", nested(MAX_DEPTH)).as_bytes(), &paths).is_none());
  }

  #[test]
  fn keeps_what_is_along_the_paths() {
    let mut paths = KeyPaths::default();
    paths.add(&[b"nav", b"home"]);
    paths.add(&[b"save"]);

    let text = r#"{
      "nav": {"home": {"context": "Start", "sourceCode": {"a.ts": [1, 2]}, "maxChars": 3}, "other": [1]},
      "save": {"sourceCode": {}, "context": {"deep": [true]}},
      "removed": {"context": "gone"},
      "save": {"context": "last wins", "sourceCode": "x"}
    }"#;
    let (object, too_deep) = parse_object_along(text.as_bytes(), &paths).unwrap_or_default();
    assert!(!too_deep);

    assert_eq!(
      compact(&stringify(&Value::Object(object))),
      r#"{"nav":{"home":{"context":"Start","maxChars":3}},"save":{"context":"last wins"}}"#
    );

    for text in ["[]", "null", "\"{}\"", "1", "{} {}", "{\"a\": 1,}"] {
      assert!(
        parse_object_along(text.as_bytes(), &paths).is_none(),
        "{text}"
      );
    }
  }

  #[test]
  fn keeps_a_value_that_is_not_an_object_as_null() {
    let mut paths = KeyPaths::default();
    paths.add(&[b"nav", b"home"]);

    let (object, _) =
      parse_object_along(br#"{"nav": [{"home": {"context": "x"}}]}"#, &paths).unwrap_or_default();
    assert_eq!(object.get(b"nav"), Some(&Value::Null));
  }

  #[test]
  fn joins_surrogates_into_characters() {
    let mut out = Vec::new();
    push_code_unit(&mut out, 0xD83D);
    assert_eq!(out, [0xED, 0xA0, 0xBD]);
    push_code_unit(&mut out, 0xDE00);
    assert_eq!(String::from_utf8(out.clone()).ok().as_deref(), Some("😀"));

    let mut out = Vec::new();
    push_code_unit(&mut out, 0xD83D);
    extend_wtf8(&mut out, &[0xED, 0xB8, 0x80, b'!']);
    assert_eq!(String::from_utf8(out).ok().as_deref(), Some("😀!"));
  }

  #[test]
  fn orders_as_utf16_does() {
    // U+FF5E is after U+1F600 in UTF-8, before it in UTF-16.
    assert_eq!(
      compare_utf16("～".as_bytes(), "😀".as_bytes()),
      Ordering::Greater
    );
    assert_eq!(compare_utf16(b"a/b.ts", b"a-b.ts"), Ordering::Greater);
    assert_eq!(compare_utf16(b"src/a.ts", b"src/a.ts"), Ordering::Equal);
    assert_eq!(
      utf16_units("a😀".as_bytes()).collect::<Vec<_>>(),
      vec![0x61, 0xD83D, 0xDE00]
    );
  }

  #[test]
  fn names_array_indexes() {
    assert_eq!(array_index(b"0"), Some(0));
    assert_eq!(array_index(b"4294967294"), Some(4_294_967_294));
    for key in [
      &b"4294967295"[..],
      b"01",
      b"-1",
      b"",
      b"1.5",
      b"12345678901",
      b" 1",
    ] {
      assert_eq!(array_index(key), None, "{key:?}");
    }
  }
}
