//! Angular's files as modules: a component's file with its inline templates' expressions after it,
//! a `templateUrl` template's expressions, a page's module scripts, and an Analog component's
//! scripts then its template's expressions.

use super::component::inline_templates;
use super::html::{analog_blocks, is_page, module_scripts};
use super::template::write_template;
use super::text::{unescape, Mapped};
use crate::{
  graph::ComponentFields,
  languages::{CodeBuilder, Generated, Skipped},
  load::{GeneratedCode, GeneratedSource},
  lower::Lang,
};

/// What follows each script copied, so that the next one starts a statement.
const SCRIPT_SEPARATOR: &str = "\n;\n";

fn generated(
  language: &str,
  main: crate::languages::BuiltCode,
  scripts: Vec<GeneratedCode>,
  component_fields: Vec<ComponentFields>,
) -> Generated {
  Generated {
    source: GeneratedSource {
      main: main.code,
      scripts,
      language: language.to_string(),
      component_fields,
      scope_objects: Vec::new(),
      props: None,
      component_instances: None,
    },
    expressions: main.expressions,
  }
}

/// A `.ts` file with `@Component({ template: "…" })`: the file, then each inline template's
/// expressions, which read the fields of their class.
pub fn component(_file: &str, source: &str, skipped: &Skipped) -> Result<Generated, String> {
  let mut code = CodeBuilder::new(source, skipped);
  code.copy(0, source.len());

  let mut component_fields = Vec::new();
  for template in inline_templates(source) {
    code.glue("\n");
    let text = unescape(source, template.start, template.end)
      .map_err(|message| format!("Angular rejected the template: {message}"))?;
    write_template(&mut code, &text)?;
    component_fields.push(ComponentFields {
      specifier: String::new(),
      class_name: template.class_name.map(String::from),
      range: Some((
        code.source_offset(template.start),
        code.source_offset(template.end),
      )),
    });
  }

  // Not "tsx": `<T>value` casts and generic arrows are not JSX.
  Ok(generated(
    "angular-component",
    code.finish(Lang::Ts),
    Vec::new(),
    component_fields,
  ))
}

/// A `.html` file: a component's `templateUrl` template, whose expressions read the fields of the
/// component of the same name; or a page, whose inline module scripts are each a module.
pub fn template(file: &str, source: &str, skipped: &Skipped) -> Result<Generated, String> {
  if is_page(source) {
    let scripts = module_scripts(source)
      .into_iter()
      .map(|(start, end)| {
        let mut code = CodeBuilder::new(source, skipped);
        code.copy(start, end);
        code.glue(SCRIPT_SEPARATOR);
        code.finish(Lang::Js).code
      })
      .collect();
    let main = crate::languages::BuiltCode {
      code: GeneratedCode {
        code: String::new(),
        lang: Lang::Js,
        mappings: Vec::new(),
        length: 0,
      },
      expressions: Vec::new(),
    };
    return Ok(generated("angular-template", main, scripts, Vec::new()));
  }

  let mut code = CodeBuilder::new(source, skipped);
  write_template(&mut code, &Mapped::verbatim(source, 0))?;

  // `user.component.html` → `./user.component.ts`; Angular 20's `user.html` → `./user.ts`.
  let name = file.rsplit('/').next().unwrap_or(file);
  let name = name.strip_suffix(".html").unwrap_or(name);
  let component_fields = vec![ComponentFields {
    specifier: format!("./{name}.ts"),
    class_name: None,
    range: None,
  }];
  Ok(generated(
    "angular-template",
    code.finish(Lang::Ts),
    Vec::new(),
    component_fields,
  ))
}

/// An Analog component (`.ag`, `.analog`): its inline `<script>` blocks, then its `<template>`
/// blocks' expressions, which read the scripts' bindings.
pub fn analog(_file: &str, source: &str, skipped: &Skipped) -> Result<Generated, String> {
  let blocks = analog_blocks(source);
  let mut code = CodeBuilder::new(source, skipped);
  for (start, end) in blocks.scripts {
    code.copy(start, end);
    code.glue(SCRIPT_SEPARATOR);
  }
  for (start, end) in blocks.templates {
    write_template(
      &mut code,
      &Mapped::verbatim(&source[start..end], start as u32),
    )?;
  }
  Ok(generated(
    "analog",
    code.finish(Lang::Ts),
    Vec::new(),
    Vec::new(),
  ))
}

#[cfg(test)]
mod tests {
  use super::*;

  fn statements(generated: &Generated) -> String {
    generated.source.main.code.clone()
  }

  #[test]
  fn components_templates_pages_and_analog() {
    let skipped = Skipped::default();
    let source = "@Component({ template: `<p>{{ m.a() }}</p>` })\nexport class A {}\n";
    let Ok(generated) = component("/a.component.ts", source, &skipped) else {
      panic!("not written");
    };
    assert_eq!(statements(&generated), format!("{source}\n;(m.a()\n);\n"));
    let fields = &generated.source.component_fields;
    assert_eq!(fields.len(), 1);
    assert_eq!(fields[0].class_name.as_deref(), Some("A"));
    assert_eq!(fields[0].range, Some((24, 42)));

    let Ok(generated) = template("/app/user.html", "<p>{{ m.b() }}</p>", &skipped) else {
      panic!("not written");
    };
    assert_eq!(generated.source.component_fields[0].specifier, "./user.ts");

    let page = "<!doctype html><script type=\"module\">m.c()</script>";
    let Ok(generated) = template("/index.html", page, &skipped) else {
      panic!("not written");
    };
    assert_eq!(generated.source.main.code, "");
    assert_eq!(generated.source.scripts.len(), 1);
    assert_eq!(generated.source.scripts[0].code, "m.c()\n;\n");

    let analog =
      "<script lang=\"ts\">const t = m.t;</script>\n<template><h1>{{ t() }}</h1></template>";
    let Ok(generated) = super::analog("/a.ag", analog, &skipped) else {
      panic!("not written");
    };
    assert_eq!(statements(&generated), "const t = m.t;\n;\n;(t()\n);\n");

    assert!(template("/a.html", "@if (x) {", &skipped).is_err());
  }

  /// Times each file of `ANGULAR_TIMING_FILES` (paths separated by `:`):
  /// `cargo test … timing -- --ignored --nocapture`.
  #[test]
  #[ignore]
  fn timing() {
    let Ok(files) = std::env::var("ANGULAR_TIMING_FILES") else {
      return;
    };
    let skipped = Skipped::default();
    for file in files.split(':') {
      let Ok(source) = std::fs::read_to_string(file) else {
        continue;
      };
      let generate: fn(&str, &str, &Skipped) -> Result<Generated, String> = if file.ends_with(".ts")
      {
        component
      } else if file.ends_with(".html") {
        template
      } else {
        analog
      };
      let _ = generate(file, &source, &skipped);
      let start = std::time::Instant::now();
      let mut runs = 0u32;
      while start.elapsed() < std::time::Duration::from_secs(2) || runs < 5 {
        let generated = generate(file, &source, &skipped);
        assert!(generated.is_ok(), "{file}: {:?}", generated.err());
        runs += 1;
      }
      let milliseconds = start.elapsed().as_secs_f64() * 1000.0 / f64::from(runs);
      let megabytes = source.len() as f64 / 1e6;
      println!(
        "{file}\t{} bytes\t{milliseconds:.3} ms\t{:.1} ms/MB\t({runs} runs)",
        source.len(),
        milliseconds / megabytes
      );
    }
  }
}
