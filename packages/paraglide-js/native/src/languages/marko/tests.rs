use super::{generate::generate, parser};
use crate::{
  languages::{builder::expression_at, Generated, Skipped},
  lower::{lower, lower_located, Lang},
};

fn written(source: &str) -> String {
  let skipped = Skipped::default();
  let Ok(Generated {
    source: written, ..
  }) = generate("/app/a.marko", source, &skipped)
  else {
    panic!("not written");
  };
  written.main.code
}

/// The copies of the file in the written code, in order.
fn copies(source: &str) -> Vec<String> {
  let skipped = Skipped::default();
  let Ok(Generated {
    source: written, ..
  }) = generate("/app/a.marko", source, &skipped)
  else {
    panic!("not written");
  };
  // Mappings count UTF-16 units.
  let code: Vec<u16> = written.main.code.encode_utf16().collect();
  let file: Vec<u16> = source.encode_utf16().collect();
  written
    .main
    .mappings
    .iter()
    .map(|mapping| {
      let generated = mapping.generated as usize..(mapping.generated + mapping.length) as usize;
      let copied = mapping.source as usize..(mapping.source + mapping.source_length) as usize;
      assert_eq!(code[generated.clone()], file[copied]);
      String::from_utf16_lossy(&code[generated])
    })
    .collect()
}

/// The code the analysis reads: written again without each expression that does not parse, as
/// `prepare_native` does.
fn analyzed(source: &str) -> Result<String, String> {
  let mut skipped = Skipped::default();
  loop {
    let Ok(generated) = generate("/app/a.marko", source, &skipped) else {
      return Err("not written".to_string());
    };
    let code = generated.source.main.code;
    match lower_located(&code, Lang::Ts) {
      Ok(_) => return Ok(code),
      Err(error) => {
        let expression = error
          .offset
          .filter(|_| skipped.len() < 20)
          .and_then(|offset| expression_at(&generated.expressions, &skipped, offset));
        match expression {
          Some(expression) => {
            skipped.insert(expression);
          }
          None => return Err(format!("{}\n{code}", error.message)),
        }
      }
    }
  }
}

fn assert_parses(source: &str) -> String {
  let code = written(source);
  if let Err(error) = lower(&code, Lang::Ts) {
    panic!("{error}\n{code}");
  }
  code
}

/// The written code from the template function on, without its first two lines.
fn template(source: &str) -> String {
  let code = assert_parses(source);
  let start = code
    .find("const input = __marko_input();\n")
    .map_or(0, |at| at + 31);
  code[start..code.len() - "\n});\n".len()].to_string()
}

#[test]
fn placeholders_attributes_and_arguments_are_expressions() {
  assert_eq!(
    template(r#"<h1 title=m.tip({ count }) class="big">${m.heading()}</h1><p>$!{m.html()}</p>"#),
    "(m.tip({ count })\n);{(m.heading()\n);}{(m.html()\n);}"
  );
  // Text is no code; a string is no usage.
  assert_eq!(template(r#"<p class="a ${m.css()}">text</p>"#), "");
  assert_eq!(
    template("<if(m.enabled())><span/></if><else-if=m.other()/>"),
    "(m.enabled()\n);{}(m.other()\n);"
  );
  assert_eq!(
    template(r#"<button onClick(event) { setLocale("de") } on-click("save", m.x) ...rest/>"#),
    "(function (event){ setLocale(\"de\") }\n);(\"save\", m.x\n);(rest\n);"
  );
}

#[test]
fn expressions_are_copies_of_the_file() {
  assert_eq!(
    copies("<div>é <p title=m.a(\"ü\")>\n  ${ m.b() /* c */ }</p></div>"),
    ["m.a(\"ü\")", " m.b() /* c */ "]
  );
  // An expression that ends with a line comment is closed on the next line.
  assert_parses("<p a=x // c\n>t</p>");
  // Nothing but a comment is no expression.
  assert_eq!(template("<p>${/* c */}</p><div()/>"), "{}");
}

#[test]
fn the_module_statements_are_the_module_s() {
  let code = assert_parses(
    "import { m } from \"./m.js\"\nexport const x = m.x();\nstatic const t = m.t();\nstatic {\n  const u = m.u();\n}\nserver const s = 1;\nclient const c = 2;\nclass {\n  onCreate() { this.label = m.label(); }\n}\nstyle { .a { color: red } }\n",
  );
  assert_eq!(
    code.split("(() => {").next(),
    Some(
      "import { m } from \"./m.js\"\n;export const x = m.x();\n;const t = m.t();\n;\n  const u = m.u();\n\n;const s = 1;\n;const c = 2;\n;(class {\n  onCreate() { this.label = m.label(); }\n}\n);"
    )
  );
}

#[test]
fn scriptlets_are_statements_of_their_body() {
  assert_eq!(
    template("$ const a = m.a()\n<div>\n  $ { const b = 1; }\n</div>"),
    "const a = m.a()\n;{ const b = 1; \n;}"
  );
  // A scriptlet mid-line is text.
  assert_eq!(template("<p>a $ b</p>"), "");
}

#[test]
fn concise_mode() {
  assert_eq!(
    template(
      "div.card [\n  title=m.title()\n  class=\"x\"\n]\n  span -- ${m.inline()}\n  --\n  <b>${m.block()}</b>\n  --\n  ul; // c\n  if=(count > 1)\n    li|x| -- ${x}\n"
    ),
    "(m.title()\n);{{(m.inline()\n);}{(m.block()\n);}((count > 1)\n);{((x\n) => {(x\n);});}}"
  );
}

#[test]
fn a_greater_than_sign_in_an_attribute_value() {
  assert_eq!(
    template("<div a=(x > b) c=x >= y d=x>b</div>"),
    "((x > b)\n);(x >= y\n);(x\n);"
  );
}

#[test]
fn tag_parameters_and_variables_scope_their_names() {
  assert_eq!(
    template("<for|{ label }, i| of=list>${label}</for>"),
    "(list\n);(({ label }, i\n) => {(label\n);});"
  );
  // A variable is scoped to the rest of its body, and the template's is declared for all of it.
  assert_eq!(
    template("<p>${el}</p><div/el>${el}</div><p>${el}</p>"),
    "let el;\n{(el\n);}{let el\n= 0;{(el\n);}{(el\n);}}"
  );
}

#[test]
fn a_variable_is_hoisted_unless_a_scope_around_it_binds_its_name() {
  let hoisted = |source: &str| {
    let code = template(source);
    code
      .strip_prefix("let ")
      .and_then(|code| code.split(";\n").next())
      .unwrap_or("")
      .to_string()
  };
  assert_eq!(hoisted("<div><let/m=0/></div>"), "m");
  assert_eq!(
    hoisted("<div><const/{ a, b: [c = m.d()] }=x/></div><p/x/>"),
    "x, a, c"
  );
  // A parameter or a variable of the same name around it shadows it.
  assert_eq!(hoisted("<for|m| of=l><div><let/m=0/></div></for>"), "");
  assert_eq!(hoisted("<let/a=0/><div><let/a=1/></div>"), "a");
  assert_eq!(hoisted("<div><input/input/></div>"), "");
  // The variable's pattern is code: its defaults are read.
  assert_eq!(
    template("<const/{ a = m.a() }=x/>"),
    "let a;\n{let { a = m.a() }\n= 0;(x\n);}"
  );
}

#[test]
fn a_tag_named_as_a_variable_calls_the_component_with_its_input() {
  assert_eq!(
    template(
      "<Card title=m.title flag description=\"d\" ...rest onSelect(item) { pick(item) } on:mod=m.on>\n  <@header|h| tone=m.tone>${h}</@header>\n  <@item label=m.one/>\n  <@item label=m.two/>\n  <p>${input.text}</p>\n</Card>"
    ),
    concat!(
      "Card({\"title\": (m.title\n),\"description\": (\"d\"\n),...(rest\n),",
      "\"onSelect\": (function (item){ pick(item) }\n),\"on\": (m.on\n),",
      "\"header\": {\"tone\": (m.tone\n),\"content\": ((h\n) => {(h\n);}),},",
      "\"item\": [{\"label\": (m.one\n),},{\"label\": (m.two\n),},],",
      "\"content\": (() => {{(input.text\n);}}),});"
    )
  );
  assert_eq!(template("<${Card} a=m.a/>"), "(Card\n)({\"a\": (m.a\n),});");
  assert_eq!(template("<Card(m.a)/>"), "Card({\"value\": (m.a\n),});");
  // Lowercase names are tags Marko finds by name, which the analysis cannot follow.
  assert_eq!(
    template("<my-card a=m.a/><card a=m.b/><A a=m.c/>"),
    "(m.a\n);(m.b\n);(m.c\n);"
  );
  // Interpolated names are no component.
  assert_eq!(
    template("<h${level}.t-${m.cls()}>x</h${level}>"),
    "(level\n);(m.cls()\n);"
  );
}

#[test]
fn a_script_of_text_is_code() {
  assert_eq!(
    template("<script>const s = \"</script>\"; f(m.s()); // c\n</script>"),
    "(async function () {const s = \"</script>\"; f(m.s()); // c\n\n});"
  );
  // As in Marko, a close tag in a line comment closes the script.
  assert_eq!(
    template("<script>f(m.s()); // </script>"),
    "(async function () {f(m.s()); // \n});"
  );
  // With attributes or placeholders, its text is not code; its placeholders are.
  assert_eq!(
    template("<script type=\"module\">m.no(); ${m.yes()}</script>"),
    "{(m.yes()\n);}"
  );
  assert_eq!(
    template("<script>let x = \"${m.yes()}\";</script><style>.a{}</style>"),
    "{(m.yes()\n);}"
  );
}

#[test]
fn comments_are_no_code() {
  assert_eq!(
    template("<!-- ${m.a()} -->\n// ${m.b()}\n/* ${m.c()} */\n<div>\n  // ${m.d()}\n</div><html-comment>${m.e()}</html-comment>"),
    "{(m.e()\n);}"
  );
}

#[test]
fn an_expression_that_does_not_parse_is_left_out() {
  let code = analyzed("<p title=m.broken(,)>${m.ok()}</p>\n$ const = ;\n<p>${m.after()}</p>");
  assert_eq!(
    code
      .as_deref()
      .map(|code| code.split("();\n").nth(1).unwrap_or("")),
    Ok("(0\n);{(m.ok()\n);}\n;{(m.after()\n);}\n});\n")
  );
}

#[test]
fn a_syntax_error_ends_the_template_where_it_is() {
  let source = "<div>${m.a()}</span>${m.b()}";
  assert!(parser::parse(source).error.is_some());
  assert_eq!(template(source), "{(m.a()\n);}");
}

#[test]
fn byte_order_marks_and_carriage_returns() {
  assert_eq!(
    template("\u{feff}<p>${m.a()}</p>\r\n<p>${m.b()}</p>"),
    "{(m.a()\n);}{(m.b()\n);}"
  );
  assert_eq!(copies("\u{feff}<p>${m.a()}</p>"), ["m.a()"]);
}

#[test]
fn deep_and_broken_templates_are_written_without_overflow() {
  let deep = "<div>".repeat(200_000) + "${m.a()}";
  assert!(written(&deep).contains("(m.a()\n);"));

  // Every prefix of a template, each cut in the middle of something.
  let source = "import { m } from \"./m.js\";\nstatic const t = m.t();\n<div a=m.a(\"é\") b=(x > 1)/el|p| ...r onClick() { f() }>${m.b()}<@x>$!{c}</@x>\n$ { const d = 1; }\n<script>s()</script><!-- c --></div>\nul\n  li -- ${m.c()}\n";
  for end in (0..=source.len()).filter(|&end| source.is_char_boundary(end)) {
    let _ = analyzed(&source[..end]);
  }
}

#[test]
fn prints() {
  let path = std::env::var("MARKO_SAMPLE").unwrap_or_default();
  let source = std::fs::read_to_string(path).unwrap_or_default();
  if !source.is_empty() {
    match analyzed(&source) {
      Ok(code) => println!("{code}"),
      Err(error) => println!("FAILS: {error}"),
    }
    println!("{:?}", parser::parse(&source).error);
  }
}

// ---------------------------------------------------------------- comparison with JavaScript

/// The tree as `dump.cjs` prints `@marko/language-tools`' parse, to compare them.
fn dump(source: &str) -> String {
  use std::fmt::Write;

  fn span(span: Option<parser::Span>) -> String {
    span.map_or("null".to_string(), |span| {
      format!("{},{}", span.start, span.end)
    })
  }

  fn children(tree: &parser::Tree, parent: u32, depth: usize, out: &mut String) {
    let pad = " ".repeat(depth);
    for child in tree.children(parent) {
      match child {
        parser::ChildKind::Text(text) => {
          let _ = writeln!(out, "{pad}text {} {}", text.start, text.end);
        }
        parser::ChildKind::Placeholder(value) => {
          let _ = writeln!(out, "{pad}placeholder {}", span(Some(value)));
        }
        parser::ChildKind::Scriptlet(value) => {
          let _ = writeln!(out, "{pad}scriptlet {}", span(Some(value)));
        }
        parser::ChildKind::Tag(index) => {
          let tag = tree.tag(index);
          let mut expressions = tag.expressions.clone();
          expressions.sort_by_key(|expression| expression.span.start);
          let expressions: Vec<String> = expressions
            .iter()
            .map(|e| {
              format!(
                "[[{},{}],[{},{}]]",
                e.span.start, e.span.end, e.value.start, e.value.end
              )
            })
            .collect();
          let _ = writeln!(
            out,
            "{pad}tag{} name={} nexpr={} exprs=[{}] var={} args={} params={}",
            if tag.is_attr_tag { "@" } else { "" },
            span(Some(tag.name)),
            tag.name_expressions,
            expressions.join(","),
            span(tag.var),
            span(tag.args),
            span(tag.params),
          );
          for attr in tree.attrs(tag) {
            match attr {
              parser::Attr::Spread(value) => {
                let _ = writeln!(out, "{pad} spread {}", span(Some(value)));
              }
              parser::Attr::Named { name, args, value } => {
                let value = match value {
                  parser::AttrValue::None => "none".to_string(),
                  parser::AttrValue::Expression(value) => format!("value {}", span(Some(value))),
                  parser::AttrValue::Method {
                    is_async,
                    type_params,
                    params,
                    body,
                  } => format!(
                    "method async={is_async} tp={} params={} body={}",
                    span(type_params),
                    span(Some(params)),
                    span(Some(body))
                  ),
                };
                let _ = writeln!(
                  out,
                  "{pad} attr {} args={} {value}",
                  span(Some(name)),
                  span(args)
                );
              }
            }
          }
          children(tree, index, depth + 1, out);
        }
      }
    }
  }

  let tree = parser::parse(source);
  let mut out = String::new();
  for statement in &tree.statics {
    let kind = match statement.kind {
      parser::StaticKind::Import => "import",
      parser::StaticKind::Export => "export",
      parser::StaticKind::Class => "class",
      parser::StaticKind::Static => "static",
      parser::StaticKind::Style => "style",
    };
    let _ = writeln!(
      out,
      "static {kind} {} {}",
      statement.span.start, statement.span.end
    );
  }
  children(&tree, parser::NONE, 0, &mut out);
  out
}

/// Writes `<file>.rust.json`, the tree of each `.marko` file in `MARKO_DUMP_DIR`, to compare with
/// `dump.cjs`'s.
#[test]
#[ignore]
fn dumps_trees() {
  let Ok(directory) = std::env::var("MARKO_DUMP_DIR") else {
    return;
  };
  let Ok(entries) = std::fs::read_dir(&directory) else {
    return;
  };
  for entry in entries.flatten() {
    let path = entry.path();
    if path
      .extension()
      .is_some_and(|extension| extension == "marko")
    {
      let source = std::fs::read_to_string(&path).unwrap_or_default();
      let mut out = path.clone().into_os_string();
      out.push(".rust.json");
      let _ = std::fs::write(&out, dump(&source));
      if let Some((at, message)) = parser::parse(&source).error {
        out.push(".err");
        let _ = std::fs::write(out, format!("{at} {} {message}\n", source.len()));
      }
    }
  }
}

/// The time to write the file at `MARKO_TIMING_FILE`, and to parse what is written: the best of 20
/// runs, after 3 to warm up.
#[test]
#[ignore]
fn times_a_file() {
  let Ok(path) = std::env::var("MARKO_TIMING_FILE") else {
    return;
  };
  let Ok(source) = std::fs::read_to_string(&path) else {
    return;
  };
  let skipped = Skipped::default();

  let best = |run: &dyn Fn()| {
    (0..23)
      .map(|_| {
        let start = std::time::Instant::now();
        run();
        start.elapsed()
      })
      .skip(3)
      .min()
      .unwrap_or_default()
  };

  // For a profiler: write it over and over.
  let loops: usize = std::env::var("MARKO_TIMING_LOOPS")
    .ok()
    .and_then(|loops| loops.parse().ok())
    .unwrap_or(0);
  for _ in 0..loops {
    std::hint::black_box(generate(&path, &source, &skipped).is_ok());
  }

  let parse = best(&|| {
    std::hint::black_box(parser::parse(&source));
  });
  let write = best(&|| {
    std::hint::black_box(generate(&path, &source, &skipped).is_ok());
  });
  let Ok(generated) = generate(&path, &source, &skipped) else {
    return;
  };
  let code = generated.source.main.code;
  let lower_code = best(&|| {
    std::hint::black_box(lower(&code, Lang::Ts).is_ok());
  });
  let megabytes = source.len() as f64 / 1e6;
  let per_megabyte = |time: std::time::Duration| time.as_secs_f64() * 1e3 / megabytes;

  println!(
    "{path}: {} bytes, written {} bytes, {} mappings\n  parse {:?} ({:.1} ms/MB)\n  parse and write {:?} ({:.1} ms/MB)\n  oxc on the written code {:?} ({:.1} ms/MB of template)",
    source.len(),
    code.len(),
    generated.source.main.mappings.len(),
    parse,
    per_megabyte(parse),
    write,
    per_megabyte(write),
    lower_code,
    per_megabyte(lower_code),
  );
}

/// Random text of Marko's special characters, written and parsed: nothing panics. Run it in a debug
/// build, where an overflow panics: `MARKO_FUZZ_RUNS=200000 cargo test … fuzz -- --ignored`.
#[test]
#[ignore]
fn fuzz_never_panics() {
  const PIECES: [&str; 48] = [
    "<", ">", "/", "${", "$!{", "}", "{", "(", ")", "[", "]", "|", "\"", "'", "`", "\n", "\r\n",
    " ", "  ", "\t", "-", "--", "=", ":=", ".", "#", "@", "!", "?", ":", ";", ",", "\\", "$ ",
    "//", "/*", "*/", "<!--", "-->", "div", "if", "script", "m.a()", "x", "import", "static", "é",
    "\u{feff}",
  ];
  let runs: u64 = std::env::var("MARKO_FUZZ_RUNS")
    .ok()
    .and_then(|runs| runs.parse().ok())
    .unwrap_or(1000);
  let mut seed: u64 = 0x9e37_79b9_7f4a_7c15;
  let mut next = move || {
    seed ^= seed << 13;
    seed ^= seed >> 7;
    seed ^= seed << 17;
    seed
  };

  for _ in 0..runs {
    let length = next() % 40;
    let source: String = (0..length)
      .map(|_| PIECES[(next() % PIECES.len() as u64) as usize])
      .collect();
    let _ = analyzed(&source);
  }
}
