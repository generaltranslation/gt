use super::generate::generate;
use crate::{
  languages::{builder::expression_at, Generated, Skipped},
  lower::{lower_located, Lang},
};

fn generated(source: &str, skipped: &Skipped) -> Generated {
  match generate("/app/Page.astro", source, skipped) {
    Ok(generated) => generated,
    Err(error) => panic!("{error}"),
  }
}

/// The main module as first written.
fn written(source: &str) -> String {
  generated(source, &Skipped::default()).source.main.code
}

/// The main module once it parses, as the analysis retries it: each construct that does not parse
/// is skipped.
fn parsed(source: &str) -> String {
  let mut skipped = Skipped::default();

  loop {
    let generated = generated(source, &skipped);
    let code = generated.source.main.code;
    match lower_located(&code, Lang::Tsx) {
      Ok(_) => return code,
      Err(error) => {
        let at = error.offset.unwrap_or(usize::MAX);
        let Some(number) = expression_at(&generated.expressions, &skipped, at) else {
          panic!("{}: {code}", error.message);
        };
        skipped.insert(number);
        assert!(skipped.len() <= 20, "{code}");
      }
    }
  }
}

/// Each copy in the main module is the source text it maps to (ASCII sources only).
fn assert_copies_match(source: &str) {
  let generated = generated(source, &Skipped::default());
  let code = &generated.source.main.code;
  for mapping in &generated.source.main.mappings {
    let generated_text =
      &code[mapping.generated as usize..(mapping.generated + mapping.length) as usize];
    let source_text = &source[mapping.source as usize..(mapping.source + mapping.length) as usize];
    assert_eq!(generated_text, source_text);
  }
}

fn scripts(source: &str) -> Vec<String> {
  generated(source, &Skipped::default())
    .source
    .scripts
    .into_iter()
    .map(|script| script.code)
    .collect()
}

#[test]
fn the_frontmatter_is_copied_and_the_template_is_one_fragment() {
  let source = "---\nimport { m } from \"./m.js\";\nconst a = 1\n---\n<h1 title={m.title()} class=\"x\">Hi {a}</h1>\n<p>text</p>\n";
  assert_eq!(
    written(source),
    "\nimport { m } from \"./m.js\";\nconst a = 1\n\n;<><h1 title={m.title()}/>{a}</>;\n"
  );
  assert_copies_match(source);
  parsed(source);
}

#[test]
fn a_file_without_frontmatter_is_its_template() {
  assert_eq!(written("<p>{x}</p>"), "<>{x}</>;\n");
  assert_eq!(written("  \n<p>---</p>"), "<></>;\n");
  assert_eq!(written("\u{feff}---\na\n---\n"), "\na\n\n;<></>;\n");
}

#[test]
fn the_closing_fence_is_outside_strings_comments_and_template_literals() {
  let source = "---\nconst a = \"---\"; // ---\n/* --- */ const b = `\n---\n${'---'}`;\nconst r = /---/;\n---<p>{a}</p>";
  assert_eq!(
    written(source),
    "\nconst a = \"---\"; // ---\n/* --- */ const b = `\n---\n${'---'}`;\nconst r = /---/;\n\n;<>{a}</>;\n"
  );
  assert_eq!(
    written("--- const a = 1; ---<p/>"),
    " const a = 1; \n;<></>;\n"
  );
  // Unclosed: the rest is frontmatter.
  assert_eq!(
    written("---\nconst a = 1;\n<p>{a}</p>"),
    "\nconst a = 1;\n<p>{a}</p>\n;<></>;\n"
  );
}

#[test]
fn a_top_level_return_is_a_throw() {
  let source = "---\nif (!user) return Astro.redirect(\"/\");\nif (x) return;\nreturn\n---\n";
  assert_eq!(
    written(source),
    "\nif (!user) throw Astro.redirect(\"/\");\nif (x) throw 0;\nthrow 0\n\n;<></>;\n"
  );
}

#[test]
fn a_return_in_a_block_is_a_throw_once_it_does_not_parse() {
  let source = [
    "---",
    "function f() { return 1 }",
    "const g = () => { return 2 };",
    "class C { m(): string { return \"\" } }",
    "const o = { return: 1, f() { if (a) { return; } } };",
    "if (!user) { return Astro.redirect(\"/\"); }",
    "try { return } finally {}",
    "---",
    "<p>{f()}</p>",
  ]
  .join("\n");
  let code = parsed(&source);
  assert!(code.contains("function f() { return 1 }"), "{code}");
  assert!(code.contains("() => { return 2 }"), "{code}");
  assert!(code.contains("{ return \"\" }"), "{code}");
  assert!(
    code.contains("{ return: 1, f() { if (a) { return; } } }"),
    "{code}"
  );
  assert!(code.contains("{ throw Astro.redirect(\"/\"); }"), "{code}");
  assert!(code.contains("try { throw 0 }"), "{code}");
}

#[test]
fn generic_arrows_in_the_frontmatter_are_not_elements() {
  let source = [
    "---",
    "const f = <T>(x: T) => x;",
    "const g = async < T extends (a: string) => Array<number> >(x: T) => x;",
    "const h = <T, U,>(x: T, y: U) => x;",
    "type F = <T>(a: T) => T;",
    "const i = foo<T>(x) < 2 ? `${<V>(v: V) => v}` : 0;",
    "---",
    "<p>{f(1)}</p>",
  ]
  .join("\n");
  let code = parsed(&source);
  assert!(code.contains("const f = <T,>(x: T) => x;"), "{code}");
  assert!(
    code.contains("async < T extends (a: string) => Array<number> ,>(x: T)"),
    "{code}"
  );
  assert!(
    code.contains("const h = <T, U,>(x: T, y: U) => x;"),
    "{code}"
  );
  assert!(code.contains("type F = <T,>(a: T) => T;"), "{code}");
  assert!(
    code.contains("foo<T>(x) < 2 ? `${<V,>(v: V) => v}` : 0;"),
    "{code}"
  );
  assert_copies_match(&source);
}

#[test]
fn markup_in_expressions_is_jsx_in_a_fragment() {
  let source =
    "<ul>{items.map((item) => <li title={m.tip({ item })}>{item}<br>{m.suffix()}</li>)}</ul>";
  assert_eq!(
    written(source),
    "<>{items.map((item) => <><li title={m.tip({ item })}/>{item}{m.suffix()}</>)}</>;\n"
  );
  assert_copies_match(source);
  parsed(source);

  // More than one root element; markup in nested expressions and attributes.
  let source = "{list.map((i) => <dt>{i}</dt>\n  <!-- c -->\n  <dd><Card icon={<Icon name={i} />}>{i && <b>{m.x()}</b>}</Card></dd>)}";
  assert_eq!(
    written(source),
    "<>{list.map((i) => <>{i}<Card icon={<><Icon name={i}/></>}/>{i && <>{m.x()}</>}</>)}</>;\n"
  );
  assert_copies_match(source);
  parsed(source);

  // Expressions in returned and parenthesized markup, and in ternaries.
  let source =
    "{items.map((i) => { return <li>{i}</li> })}{(<b>{a}</b>)}{c ? <i>{d}</i> : <u>{e}</u>}";
  assert_eq!(
    written(source),
    "<>{items.map((i) => { return <>{i}</> })}{(<>{a}</>)}{c ? <>{d}</> : <>{e}</>}</>;\n"
  );
  parsed(source);
}

#[test]
fn comparisons_generics_strings_and_regular_expressions_are_not_markup() {
  let source = "{a < b ? 1 : 2}{a<b}{f<T>(x)}{\"<b>\"}{/<b>/.test(x)}{/* <b> */}{`${\"<b>\"}<i>`}{x / 2 < y}{// <b>\n}";
  assert_eq!(
    written(source),
    "<>{a < b ? 1 : 2}{a<b}{f<T>(x)}{\"<b>\"}{/<b>/.test(x)}{/* <b> */}{`${\"<b>\"}<i>`}{x / 2 < y}{// <b>\n}</>;\n"
  );
  parsed(source);
}

#[test]
fn an_unclosed_element_in_an_expression_ends_at_its_brace() {
  let source = "<ul>{list.map((i) => <li>{i})}</ul><p>{m.after()}</p>";
  let code = parsed(source);
  assert_eq!(code, "<>{0}{m.after()}</>;\n");
}

#[test]
fn attributes() {
  let source = "<div a=b c='d' e=\"f\" g h={i} {j} {...k} l:m={n} @click={o} x.y={p} :q={r} t=`${u}v` w={ } {/* c */} {a.b}>x</div>";
  assert_eq!(
    written(source),
    "<><div h={i} j={j} {...k} l:m={n} {...{\"@click\":(o)}} {...{\"x.y\":(p)}} {...{\":q\":(r)}} t={`${u}v`} _={a.b}/></>;\n"
  );
  assert_copies_match(source);

  // A component's attributes are its props, all of them.
  let source =
    "<Card a=b c='d' e=\"f\" g h={i} {j} client:load class:list={[x]} k=l\"m @n=\"o\" p={}/>";
  assert_eq!(
    written(source),
    "<><Card a=\"b\" c='d' e=\"f\" g h={i} j={j} client:load class:list={[x]} k=\"\" p/></>;\n"
  );
  assert_copies_match(source);
  parsed(source);

  // An element with nothing to analyze is not written.
  assert_eq!(
    written("<meta charset=\"utf-8\"><img src=x/><input disabled>"),
    "<></>;\n"
  );
  // Values with `>` and `/`.
  assert_eq!(
    written("<a href=/x/ title=\"a>b\" data={c}>"),
    "<><a data={c}/></>;\n"
  );
}

#[test]
fn components_member_names_and_invalid_names() {
  let source = "<Foo.Bar a={1}/><foo-bar x={1}></foo-bar><svg:rect y={2}/><Fragment slot=\"s\"><slot /></Fragment><Ñ z={3}/><My-El w={4} /><>{f}</><a.1b u={5}/><x@y v={6}>";
  assert_eq!(
    written(source),
    "<><Foo.Bar a={1}/><foo-bar x={1}/><svg:rect y={2}/><Fragment slot=\"s\"/>{3}<My-El w={4}/>{f}<div u={5}/><div v={6}/></>;\n"
  );
  parsed(source);
}

#[test]
fn bare_scripts_are_modules_of_their_own_and_raw_text_is_not_read() {
  let source = [
    "<style define:vars={{ c }}>p { color: {red}; }</style>",
    "<script>",
    "  import { m } from \"./m.js\";",
    "  m.a(\"</p>\");",
    "</script>",
    "<script is:inline>m.b()</script><script type=\"module\">m.c()</script><script src=\"x.js\"></script>",
    "<script define:vars={{ d }}>m.e()</script>",
    "<script >m.f()</script><script></script>",
    "{cond && <script>m.g()</script>}<Comp><script>m.h()</script></Comp>",
    "<div is:raw>{i} <b></div>{j}<Code is:raw>{k}</Code>",
    "<SCRIPT>{l}</SCRIPT>",
  ]
  .join("\n");
  assert_eq!(
    written(&source),
    "<><style define:vars={{ c }}/><script define:vars={{ d }}/>{cond && <></>}<Comp/>{j}<Code is:raw/><SCRIPT/>{l}</>;\n"
  );
  assert_eq!(
    scripts(&source),
    [
      "\n  import { m } from \"./m.js\";\n  m.a(\"</p>\");\n",
      "m.f()",
      "m.g()",
      "m.h()"
    ]
  );
  parsed(&source);
}

#[test]
fn comments_doctypes_and_cdata_are_not_read() {
  let source = "<!doctype html><!-- {a} --><![CDATA[{b}]]><?xml {c}?><p>{d}</p><!-- {e}";
  assert_eq!(written(source), "<>{d}</>;\n");
}

#[test]
fn text_with_brackets_is_dropped() {
  assert_eq!(written("<p>a > b } c < d <3 {x}</p>"), "<>{x}</>;\n");
}

#[test]
fn an_unparsable_expression_is_skipped_alone() {
  let source = "---\nimport { m } from \"./m.js\";\n---\n<p title={m.broken(}>{m.after_a()}</p>\n<p>{m.after_b()}</p>";
  assert_eq!(
    parsed(source),
    "\nimport { m } from \"./m.js\";\n\n;<><p title={0}/>{m.after_a()}{m.after_b()}</>;\n"
  );
}

#[test]
fn constructs_in_a_skipped_one_keep_their_numbers() {
  // The inner `{m.x(}` is skipped first, then its outer expression: the expressions after keep
  // their numbers, so that only those that did not parse are skipped.
  let source = "{a.map((i) => <b>{m.x(}</b>) +}{m.y(}{m.z()}";
  assert_eq!(parsed(source), "<>{0}{0}{m.z()}</>;\n");
}

#[test]
fn an_unclosed_expression_ends_the_file() {
  assert_eq!(parsed("<p>{m.a()}</p><p>{m.b("), "<>{m.a()}{0}</>;\n");
  assert_eq!(parsed("<p title=\"x"), "<></>;\n");
  assert_eq!(parsed("<Card title=\"x"), "<><Card title=\"\"/></>;\n");
}

#[test]
fn positions_map_to_utf16_offsets() {
  let source = "---\nconst 名前 = \"ß\";\n---\n<p>Grüße 👋 {m.greeting()}</p><script>console.log(\"ü\", m.client());</script>";
  let generated = generated(source, &Skipped::default());
  let main = &generated.source.main;
  // Generated offsets count UTF-16 units too.
  let at = main.code.find("m.greeting").unwrap_or(0);
  let at = main.code[..at].encode_utf16().count() as i32;
  let mapping = main
    .mappings
    .iter()
    .find(|mapping| mapping.generated <= at && at < mapping.generated + mapping.length)
    .copied();
  let greeting = source.find("m.greeting").unwrap_or(0);
  let greeting = source[..greeting].encode_utf16().count() as i32;
  assert_eq!(
    mapping.map(|mapping| mapping.source + (at - mapping.generated)),
    Some(greeting)
  );

  let script = &generated.source.scripts[0];
  let script_start = source.find("console").unwrap_or(0);
  assert_eq!(
    script.mappings[0].source,
    source[..script_start].encode_utf16().count() as i32
  );
  assert_eq!(script.length, script.code.encode_utf16().count());
}

#[test]
fn deep_nesting_is_an_error_not_a_crash() {
  let source = "{<a>".repeat(10_000);
  assert!(generate("/a.astro", &source, &Skipped::default()).is_err());
}

#[test]
fn no_input_panics() {
  let samples = [
    "---\nimport { m } from \"./m.js\";\nconst a = `x${b}` / 2; // c\nif (a) { return; }\n---\n<!doctype html>\n<html><head><meta charset=\"utf-8\"><title>{m.t()}</title></head>\n<body class:list={[a, { b }]}>\n<!-- c -->\n<ul>{items.map((i) => <li data-x=`${i}` {...p} {q}><br>{m.x(i)}</li>)}</ul>\n<Card a=b c='d' e=\"f\" set:html={h} />\n<style>p{}</style><script>import { m } from \"./m.js\"; m.c();</script>\n<div is:raw>{z}</div>\n</body></html>\n",
    "{a<b}{/re/}{'s'}{\"s\"}{`t${u}`}<a b=\"c",
    "é{ü<ö é=ü>{ß}</ö>}👋<👋>{`👋${'é'}`}",
  ];

  for sample in samples {
    for end in (0..=sample.len()).filter(|&end| sample.is_char_boundary(end)) {
      for start in [0, 1, 4, 9] {
        let start = (start..=end)
          .find(|&start| sample.is_char_boundary(start))
          .unwrap_or(end);
        let text = &sample[start..end];
        if let Ok(generated) = generate("/a.astro", text, &Skipped::default()) {
          // Skipping any construct writes code too.
          let all: Skipped = (0..generated.expressions.len() as u32).collect();
          let _ = generate("/a.astro", text, &all);
        }
      }
    }
  }
}

/// `ASTRO_FILE=<path> cargo test … languages::astro::tests::timing -- --ignored --nocapture`
#[test]
#[ignore]
fn timing() {
  let Ok(path) = std::env::var("ASTRO_FILE") else {
    return;
  };
  let Some(source) = crate::load::read_text(&path) else {
    return;
  };
  let skipped = Skipped::default();
  let runs = 200;

  let mut generated_length = 0;
  let start = std::time::Instant::now();
  for _ in 0..runs {
    let generated = generated(&source, &skipped);
    generated_length = generated.source.main.code.len();
    std::hint::black_box(generated);
  }
  let generate_time = start.elapsed() / runs;

  let code = generated(&source, &skipped).source.main.code;
  let start = std::time::Instant::now();
  for _ in 0..20 {
    std::hint::black_box(lower_located(&code, Lang::Tsx).is_ok());
  }
  let parse_time = start.elapsed() / 20;

  let mb = source.len() as f64 / 1e6;
  println!(
    "{path}: {} bytes -> {generated_length} bytes; generate {:?} ({:.1} ms/MB), parse+lower the module {:?}",
    source.len(),
    generate_time,
    generate_time.as_secs_f64() * 1e3 / mb,
    parse_time,
  );
}

/// `ASTRO_FILES=<file listing paths> cargo test … languages::astro::tests::files -- --ignored
/// --nocapture`: how each file parses, with what skipped.
#[test]
#[ignore]
fn files() {
  let Ok(list) = std::env::var("ASTRO_FILES") else {
    return;
  };
  let Some(list) = crate::load::read_text(&list) else {
    return;
  };

  for path in list.lines() {
    let Some(source) = crate::load::read_text(path) else {
      continue;
    };
    let mut skipped = Skipped::default();
    let outcome = loop {
      let generated = match generate(path, &source, &skipped) {
        Ok(generated) => generated,
        Err(error) => break format!("error: {error}"),
      };
      let scripts = generated.source.scripts.len();
      let unparsable_scripts = generated
        .source
        .scripts
        .iter()
        .filter(|script| lower_located(&script.code, Lang::Ts).is_err())
        .count();
      match lower_located(&generated.source.main.code, Lang::Tsx) {
        Ok(_) => {
          break format!(
            "ok, {} skipped, {scripts} scripts ({unparsable_scripts} unparsable)",
            skipped.len()
          )
        }
        Err(error) => {
          let number = error
            .offset
            .filter(|_| skipped.len() < 20)
            .and_then(|at| expression_at(&generated.expressions, &skipped, at));
          match number {
            Some(number) => {
              skipped.insert(number);
            }
            None => break format!("skipped file: {}", error.message),
          }
        }
      }
    };
    println!("{path}: {outcome}");
  }
}

/// Files made of random pieces, many of them broken: each is written without panicking, with
/// copies that are the text they map to, and the retries to parse it end.
#[test]
fn random_files() {
  const PIECES: [&str; 72] = [
    "---",
    "---\n",
    "\n",
    " ",
    "<",
    ">",
    "</",
    "/>",
    "<p",
    "<Card",
    "</p>",
    "</Card>",
    "<br>",
    "<>",
    "</>",
    "{",
    "}",
    "{...",
    "{x}",
    "m.x()",
    "m.y",
    "(",
    ")",
    "[",
    "]",
    "<!--",
    "-->",
    "<!doctype html>",
    "<script>",
    "</script>",
    "<script is:inline>",
    "<style>",
    "</style>",
    " is:raw",
    " a=",
    " b={",
    " c=x",
    "=",
    "\"",
    "'",
    "`",
    "${",
    "=>",
    "/",
    "/*",
    "*/",
    "//",
    "return ",
    "return;",
    "if (x) {",
    "function f() {",
    "é",
    "😀",
    "<T>(",
    "<Foo.Bar",
    " client:load",
    " class:list=",
    " set:html=",
    "\\",
    "a<b",
    "1 / 2",
    "/re/",
    "?.",
    "...",
    ";",
    ",",
    ":",
    "?",
    "import { m } from \"./m.js\";",
    "<script>import { m } from \"./m.js\"; m.z()</script>",
    "<li>",
    "&&",
  ];

  let mut state: u64 = 0x2545_F491_4F6C_DD1D;
  let mut next = move || {
    state ^= state << 13;
    state ^= state >> 7;
    state ^= state << 17;
    state
  };

  let (mut parsed, mut retried) = (0, 0);
  for _ in 0..20_000 {
    let length = 1 + next() % 30;
    let mut source = String::new();
    for _ in 0..length {
      source.push_str(PIECES[(next() % PIECES.len() as u64) as usize]);
    }

    let mut skipped = Skipped::default();
    while let Ok(generated) = generate("/a.astro", &source, &skipped) {
      let main = &generated.source.main;
      let code: Vec<u16> = main.code.encode_utf16().collect();
      let text: Vec<u16> = source.encode_utf16().collect();
      assert_eq!(main.length, code.len());
      for mapping in &main.mappings {
        let (generated_at, source_at, length) = (
          mapping.generated as usize,
          mapping.source as usize,
          mapping.length as usize,
        );
        assert_eq!(
          code[generated_at..generated_at + length],
          text[source_at..source_at + length],
          "{source:?}"
        );
      }
      for (start, end) in &generated.expressions {
        assert!(
          start <= end && *end as usize <= main.code.len(),
          "{source:?}"
        );
      }

      match lower_located(&main.code, Lang::Tsx) {
        Ok(_) => {
          parsed += 1;
          retried += usize::from(!skipped.is_empty());
          break;
        }
        Err(error) => {
          let number = error
            .offset
            .filter(|_| skipped.len() < 20)
            .and_then(|at| expression_at(&generated.expressions, &skipped, at));
          match number {
            Some(number) => assert!(skipped.insert(number), "{source:?}"),
            None => break,
          }
        }
      }
    }
  }
  // Most files parse, many once constructs are skipped.
  assert!(
    parsed > 5_000 && retried > 1_000,
    "{parsed} parsed, {retried} after skipping"
  );
}
