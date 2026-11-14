//! A `.gjs`/`.gts` module as one module: its script is copied, and each `<template>` tag is
//! replaced by code that reads what the template reads (`template.rs`), where Glint puts it:
//!
//! - in a class body, a static block, whose `this` is the class: `;static{…}`
//! - as a statement of the module's top level, its default export: `export default (()=>{…})`
//! - elsewhere, a function, whose `this` is the one around it: `(()=>{…})`

use super::glimmer::SyntaxError;
use super::script::{self, line_of, Placement};
use super::template;
use crate::languages::{CodeBuilder, Generated, Language, Skipped};
use crate::load::GeneratedSource;
use crate::lower::Lang;

pub fn generate(file: &str, source: &str, skipped: &Skipped) -> Result<Generated, String> {
  let tags = script::find_templates(source)?;

  let mut code = CodeBuilder::new(source, skipped);
  let mut copied = 0;
  for tag in &tags {
    code.copy(copied, tag.start);
    let (open, close) = match tag.placement {
      Placement::ClassMember => (";static{", "}"),
      Placement::DefaultExport => ("export default (()=>{", "})"),
      Placement::Statement => (";(()=>{", "})"),
      Placement::Expression => ("(()=>{", "})"),
    };
    code.glue(open);
    template::write(&mut code, tag.content_start, tag.content_end)
      .map_err(|error| message(source, &error))?;
    code.glue(close);
    copied = tag.end;
  }
  code.copy(copied, source.len());

  let lang = if file.ends_with(".gts") {
    Lang::Ts
  } else {
    Lang::Js
  };
  let built = code.finish(lang);

  Ok(Generated {
    source: GeneratedSource {
      main: built.code,
      scripts: Vec::new(),
      language: Language::Ember.name().to_string(),
      component_fields: Vec::new(),
      scope_objects: Vec::new(),
      props: None,
      component_instances: None,
    },
    expressions: built.expressions,
  })
}

/// A template's error, with its line in the file.
fn message(source: &str, error: &SyntaxError) -> String {
  let line = line_of(source.as_bytes(), error.at);
  match error.message.strip_prefix("Parse error") {
    Some(detail) => format!(
      "Glimmer: Parse error on line {line}{}",
      if detail.is_empty() {
        String::new()
      } else {
        detail.to_string()
      }
    ),
    // Glimmer names the line of an open tag that a close tag does not match.
    None if error.message.contains("(on line ") => format!("Glimmer: {}", error.message),
    None => format!("Glimmer: {} (on line {line})", error.message),
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  fn written(file: &str, source: &str) -> String {
    let skipped = Skipped::default();
    match generate(file, source, &skipped) {
      Ok(generated) => generated.source.main.code,
      Err(error) => format!("Err({error})"),
    }
  }

  fn template(body: &str) -> String {
    let written = written("a.gts", &format!("<template>{body}</template>"));
    written
      .strip_prefix("export default (()=>{")
      .and_then(|code| code.strip_suffix("})"))
      .map_or(written.clone(), str::to_string)
  }

  #[test]
  fn tags_are_written_where_glint_puts_them() {
    let source = "const Row = <template>{{m.row}}</template>;\nclass A {\n  <template>{{this.x}}</template>\n}\n<template>{{m.top}}</template>\n";
    assert_eq!(
      written("a.gjs", source),
      "const Row = (()=>{m.row();});\nclass A {\n  ;static{this.x();}\n}\nexport default (()=>{m.top();})\n"
    );
  }

  #[test]
  fn paths_are_called_but_as_arguments() {
    assert_eq!(
      template("<h1 title={{m.title}}>{{m.heading}}</h1><Foo @message={{m.tos}} @n={{m.n 1}} />"),
      "m.title();m.heading();Foo({message:m.tos,n:m.n(1),});"
    );
    assert_eq!(
      template("<p class=\"a {{m.css}} b\">{{m.items count=@count x=\"s\"}}</p>"),
      "m.css();m.items({count:__glint,x:\"s\",});"
    );
  }

  #[test]
  fn arguments_and_keywords_are_opaque() {
    assert_eq!(
      template("<p>{{@count}}</p>{{outlet}}{{@a.b c}}"),
      "__glint.b(c);"
    );
    assert_eq!(
      template("{{#each @list as |m i|}}{{m.x}}{{/each}}{{m.y}}"),
      "{let m,i;m.x();}m.y();"
    );
  }

  #[test]
  fn blocks_and_else_chains() {
    assert_eq!(
      template("{{#if (m.a)}}{{m.b}}{{else if @c}}{{m.d}}{{else}}{{m.e}}{{/if}}"),
      "if(m.a()){m.b();}else{if(__glint){m.d();}else{m.e();}}"
    );
    assert_eq!(template("{{#unless m.a}}x{{/unless}}"), "if(!(m.a)){}");
    assert_eq!(
      template("{{#let (m.short) as |label|}}{{label}}{{/let}}"),
      "__glint(m.short());{let label;label();}"
    );
    assert_eq!(
      template("{{#this.wrap}}x{{/this.wrap}}"),
      "this.wrap();this.wrap;"
    );
  }

  #[test]
  fn special_forms() {
    assert_eq!(
      template("{{if @x m.a m.b}}{{unless @y m.c}}"),
      "((__glint)?(m.a):(m.b));(!(__glint)?(m.c):(undefined));"
    );
    assert_eq!(
      template("{{yield (m.y) to=\"inverse\"}}"),
      "__glint(m.y());"
    );
    assert_eq!(
      template("<p title={{yield}}></p>"),
      "Err(Glimmer: {{yield}} may only appear as a top-level statement (on line 1))"
    );
    assert_eq!(
      template("{{if m.a}}"),
      "Err(Glimmer: {{if}} requires at least two parameters (on line 1))"
    );
  }

  #[test]
  fn components_named_blocks_and_modifiers() {
    assert_eq!(
      template("<Foo as |m|>{{m.a}}</Foo><Bar><:head as |h|>{{h}}{{m.b}}</:head></Bar>"),
      "Foo();{let m;m.a();}Bar();{let h;h();m.b();}"
    );
    assert_eq!(
      template("<button {{on \"click\" (m.go)}} disabled></button>"),
      "on(__glint,\"click\",m.go());"
    );
    assert_eq!(
      template("<Foo><:a></:a>text</Foo>"),
      "Err(Glimmer: Named blocks may not be mixed with other content (on line 1))"
    );
  }

  #[test]
  fn literals_and_unsafe_segments() {
    assert_eq!(
      template("{{t 'it\\'s' \"a\\\"b\" 1.0 007 -1}}"),
      "t(\"it's\",\"a\\\"b\",1,7,-1);"
    );
    assert_eq!(
      template("{{m.foo-bar}}{{m.[a b]}}"),
      "m[\"foo-bar\"]();m[\"a b\"]();"
    );
    assert_eq!(template("{{class}}{{__x}}"), "__class();____x();");
  }

  #[test]
  fn comments_and_escapes_are_text() {
    assert_eq!(
      template("<!-- {{m.a}} --> {{!-- {{m.b}} --}} {{! x }} \\{{m.c}} \\\\{{m.d}}"),
      "m.d();"
    );
    assert_eq!(template("<style>a < b {}</style>{{m.e}}"), "m.e();");
  }

  #[test]
  fn syntax_errors_skip_the_file() {
    for (body, error) in [
      (
        "<div></p>",
        "Closing tag </p> did not match last open tag <div>",
      ),
      ("<div>", "Unclosed element `div`"),
      ("{{#if @a}}", "Parse error on line 1"),
      ("{{#if @a}}{{/each}}", "if doesn't match each"),
      ("{{m.broken (}}", "Parse error on line 1"),
      ("<input></input>", "<input> elements do not need end tags"),
      ("<p title=a{{m.a}}></p>", "An unquoted attribute value"),
      ("{{! @glint-foo }}", "Unknown directive @glint-foo"),
      ("<{{m.a}}>", "Cannot use mustaches in an elements tagname"),
    ] {
      let written = template(body);
      assert!(written.contains(error), "{body}: {written}");
    }
  }
}

/// Conversion time of one file: `EMBER_TIMING_FILE=<path> cargo test … -- --ignored --nocapture
/// times_a_file`.
#[cfg(test)]
mod timing {
  use super::*;

  #[test]
  #[ignore]
  fn times_a_file() {
    let Ok(path) = std::env::var("EMBER_TIMING_FILE") else {
      return;
    };
    let Ok(source) = std::fs::read_to_string(&path) else {
      panic!("{path} cannot be read");
    };
    let skipped = Skipped::default();
    let runs = 50;

    let mut best = f64::MAX;
    let mut total = 0.0;
    let mut generated_length = 0;
    for _ in 0..runs {
      let started = std::time::Instant::now();
      let generated = match generate(&path, &source, &skipped) {
        Ok(generated) => generated,
        Err(error) => panic!("{error}"),
      };
      let elapsed = started.elapsed().as_secs_f64() * 1000.0;
      generated_length = generated.source.main.code.len();
      std::hint::black_box(generated);
      best = best.min(elapsed);
      total += elapsed;
    }

    let megabytes = source.len() as f64 / 1_048_576.0;
    println!(
      "{path}: {} bytes -> {generated_length} bytes; best {best:.3} ms, mean {:.3} ms ({:.1} ms/MB)",
      source.len(),
      total / f64::from(runs),
      best / megabytes
    );
  }
}

/// Templates made of random pieces, many of them broken: each is written or fails, never panics.
#[cfg(test)]
mod random {
  use super::*;

  const PIECES: [&str; 68] = [
    "@",
    ".",
    "..",
    "{{@..}}",
    "<template>",
    "</template>",
    "{{",
    "}}",
    "{{{",
    "}}}",
    "{{#if ",
    "{{#each @list as |m i|}}",
    "{{else}}",
    "{{else if ",
    "{{/if}}",
    "{{/each}}",
    "{{!",
    "{{!--",
    "--}}",
    "\\{{",
    "\\\\{{",
    "m.title",
    "this.label",
    "@count",
    " ",
    "\n",
    "(",
    ")",
    "\"str\"",
    "'s'",
    "1.0",
    "key=",
    "as |x|",
    "<",
    ">",
    "</",
    "/>",
    "<div",
    "<Foo",
    "</div>",
    "</Foo>",
    "<:named",
    "</:named>",
    "<!--",
    "-->",
    "<!DOCTYPE",
    "=",
    "\"",
    "'",
    "title=",
    "@arg=",
    "...attributes",
    "é",
    "😀",
    "{{yield",
    "{{on \"click\" ",
    "<input",
    "<style>",
    "</style>",
    "|",
    "class A {",
    "}",
    "const X = ",
    ";",
    "/re<template>/",
    "`${",
    "//",
    "[a b]",
  ];

  #[test]
  fn random_files_never_panic() {
    let mut state: u64 = 0x9E37_79B9_7F4A_7C15;
    let mut next = move || {
      state ^= state << 13;
      state ^= state >> 7;
      state ^= state << 17;
      state
    };

    let skipped = Skipped::default();
    for _ in 0..20_000 {
      let length = 1 + next() % 24;
      let mut source = String::from("<template>");
      for _ in 0..length {
        source.push_str(PIECES[(next() % PIECES.len() as u64) as usize]);
      }
      if next() % 2 == 0 {
        source.push_str("</template>");
      }
      for file in ["a.gts", "a.gjs"] {
        let _ = generate(file, &source, &skipped);
      }
    }
  }
}
