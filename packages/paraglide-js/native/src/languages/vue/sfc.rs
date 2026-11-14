//! The blocks of a single-file component, as `@vue/language-core` finds them (`parseSfc`, Vue's
//! parser in its SFC mode): the root elements' content is raw text up to their end tag, except an
//! HTML `<template>`'s, whose elements are parsed to find the end tag that closes it. The first
//! `<script setup>` and the first other `<script>` count, and the last `<template>`.

use memchr::{memchr, memmem};

use super::{
  html::{self, attributes, raw_text_end, TagEnd},
  names::is_html_space,
  template::{Attribute, AttributeName, Span, Template},
};
use crate::lower::Lang;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum ScriptLang {
  Js,
  Jsx,
  Ts,
  Tsx,
  /// Another language, e.g. CoffeeScript: not analyzed.
  Other,
}

impl ScriptLang {
  fn of(lang: Option<&[u8]>) -> ScriptLang {
    match lang {
      None | Some(b"js") => ScriptLang::Js,
      Some(b"jsx") => ScriptLang::Jsx,
      Some(b"ts") => ScriptLang::Ts,
      Some(b"tsx") => ScriptLang::Tsx,
      Some(_) => ScriptLang::Other,
    }
  }

  fn lang(self) -> Option<Lang> {
    match self {
      ScriptLang::Js => Some(Lang::Js),
      ScriptLang::Jsx => Some(Lang::Jsx),
      ScriptLang::Ts => Some(Lang::Ts),
      ScriptLang::Tsx => Some(Lang::Tsx),
      ScriptLang::Other => None,
    }
  }
}

#[derive(Clone, Copy, Debug)]
pub struct Script {
  pub content: Span,
  pub lang: ScriptLang,
  /// `<script src="…">`: the module the component is.
  pub src: Option<Span>,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum TemplateKind {
  #[default]
  None,
  /// Parsed into the `Template` given to `scan`.
  Html,
  /// Its content, not parsed yet.
  Pug(Span),
}

#[derive(Default, Debug)]
pub struct Sfc {
  pub script: Option<Script>,
  pub script_setup: Option<Script>,
  pub template: TemplateKind,
}

impl Sfc {
  /// The module's language, as `computeLang` of `@vue/language-core` picks it: `<script setup>`'s
  /// unless it is JavaScript, else `<script>`'s; TypeScript without either.
  pub fn lang(&self) -> Lang {
    let setup = self.script_setup.map(|script| script.lang);
    let script = self.script.map(|script| script.lang);
    let lang = match (setup, script) {
      (Some(ScriptLang::Js), Some(script)) => script,
      (Some(setup), _) => setup,
      (None, script) => script.unwrap_or(ScriptLang::Ts),
    };
    lang.lang().unwrap_or(Lang::Ts)
  }

  /// The scripts that are analyzed, in the file's order.
  pub fn scripts(&self) -> impl Iterator<Item = Script> {
    let mut scripts = [self.script, self.script_setup];
    scripts.sort_by_key(|script| script.map_or(u32::MAX, |script| script.content.start));
    scripts
      .into_iter()
      .flatten()
      .filter(|script| script.lang != ScriptLang::Other)
  }
}

/// Reads the root elements of `text[start..end)` into `sfc`; an HTML template's elements go into
/// `template`.
pub fn scan(text: &[u8], start: usize, end: usize, sfc: &mut Sfc, template: &mut Template) {
  let mut position = start;
  let mut attributes_found: Vec<Attribute> = Vec::new();

  while position < end {
    let Some(found) = memchr(b'<', &text[position..end]) else {
      return;
    };
    let at = position + found;
    let next = text.get(at + 1).copied().unwrap_or(0);

    if text[at..end].starts_with(b"<!--") {
      position = match memmem::find(&text[at + 4..end], b"-->") {
        Some(close) => at + 4 + close + 3,
        None => end,
      };
      continue;
    }
    if !next.is_ascii_alphabetic() {
      position = if matches!(next, b'!' | b'?' | b'/') {
        memchr(b'>', &text[at..end]).map_or(end, |close| at + close + 1)
      } else {
        at + 1
      };
      continue;
    }

    let name_start = at + 1;
    let mut name_end = name_start;
    while name_end < end && !matches!(text[name_end], b'/' | b'>') && !is_html_space(text[name_end])
    {
      name_end += 1;
    }
    let name = &text[name_start..name_end];

    attributes_found.clear();
    let (after, tag_end) = attributes(text, name_end, end, false, &mut attributes_found);
    let attribute = |wanted: &[u8]| {
      attributes_found.iter().find(|attribute| {
        matches!(attribute.name, AttributeName::Written(name) if &text[name.range()] == wanted)
      })
    };
    let lang = attribute(b"lang")
      .and_then(|lang| lang.value)
      .map(|lang| &text[lang.range()]);

    if matches!(tag_end, TagEnd::SelfClosing | TagEnd::Unterminated) {
      if name == b"template" {
        template.clear();
        sfc.template = TemplateKind::None;
      }
      position = after;
      continue;
    }

    if name == b"template" && lang.is_none_or(|lang| lang.is_empty() || lang == b"html") {
      template.clear();
      sfc.template = TemplateKind::Html;
      let parsed = html::parse(text, after, end, html::Mode::Root, template);
      template.finish();
      position = parsed.after;
      continue;
    }

    let (content_end, resume) = raw_text_end(text, after, end, name);
    let content = Span::new(after, content_end);
    position = resume;

    match name {
      b"template" => {
        template.clear();
        sfc.template = match lang {
          Some(b"pug") => TemplateKind::Pug(content),
          _ => TemplateKind::None,
        };
      }
      b"script" => {
        let script = Script {
          content,
          lang: ScriptLang::of(lang),
          src: attribute(b"src").and_then(|src| src.value),
        };
        let is_setup = attribute(b"setup").is_some() || attribute(b"vapor").is_some();
        let slot = if is_setup {
          &mut sfc.script_setup
        } else {
          &mut sfc.script
        };
        if slot.is_none() {
          *slot = Some(script);
        }
      }
      _ => {}
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  fn scanned(text: &str) -> (Sfc, Template) {
    let mut sfc = Sfc::default();
    let mut template = Template::default();
    scan(text.as_bytes(), 0, text.len(), &mut sfc, &mut template);
    (sfc, template)
  }

  #[test]
  fn finds_the_scripts_and_the_template() {
    let text = "<template><p>{{ a }}</p><template v-if=\"b\"></template></template>\n<script lang=\"ts\">export default {}</script>\n<script setup>\nconst a = 1;\n</SCRIPT >\n<style>p { a: \"</script>\" }</style>";
    let (sfc, template) = scanned(text);
    assert_eq!(sfc.template, TemplateKind::Html);
    assert_eq!(template.nodes.len(), 3);
    let (Some(script), Some(setup)) = (sfc.script, sfc.script_setup) else {
      panic!("{sfc:?}");
    };
    assert_eq!(&text[script.content.range()], "export default {}");
    assert_eq!(&text[setup.content.range()], "\nconst a = 1;\n");
    assert_eq!(sfc.lang(), Lang::Ts);
    let order: Vec<_> = sfc.scripts().map(|script| script.content.start).collect();
    assert_eq!(order, [script.content.start, setup.content.start]);
  }

  #[test]
  fn a_pug_template_is_raw_text() {
    let text =
      "<script setup lang=\"tsx\"></script><template lang=\"pug\">\np(:a=\"</p>\") x\n</template>";
    let (sfc, _) = scanned(text);
    let TemplateKind::Pug(content) = sfc.template else {
      panic!("{:?}", sfc.template)
    };
    assert_eq!(&text[content.range()], "\np(:a=\"</p>\") x\n");
    assert_eq!(sfc.lang(), Lang::Tsx);
  }

  #[test]
  fn the_module_language_follows_the_scripts() {
    let (sfc, _) = scanned("<script setup></script><script lang=\"ts\"></script>");
    assert_eq!(sfc.lang(), Lang::Ts);
    let (sfc, _) = scanned("<template><p/></template>");
    assert_eq!(sfc.lang(), Lang::Ts);
    let (sfc, _) = scanned("<script lang=\"coffee\">a</script>");
    assert_eq!(sfc.lang(), Lang::Ts);
    assert_eq!(sfc.scripts().count(), 0);
  }
}
