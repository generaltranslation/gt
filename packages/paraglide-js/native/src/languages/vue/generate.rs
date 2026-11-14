//! The entry points: a `.vue` file, and a VitePress `.md` file, as modules.

use memchr::memmem;

use super::{
  codegen::Writer,
  html, markdown,
  names::is_identifier,
  pug,
  sfc::{self, Sfc, TemplateKind},
  template::{Span, Template},
};
use crate::{
  graph::{ComponentInstances, InstantiationSyntax, PropsReads},
  languages::{BuiltCode, Generated, Skipped},
  load::GeneratedSource,
};

/// A single-file component.
pub fn vue(_file: &str, source: &str, skipped: &Skipped) -> Result<Generated, String> {
  let text = source.as_bytes();
  let mut sfc = Sfc::default();
  let mut template = Template::default();
  sfc::scan(text, 0, text.len(), &mut sfc, &mut template);
  if let TemplateKind::Pug(content) = sfc.template {
    pug::parse(text, content, &mut template);
    template.finish();
  }

  let imported = component_imports(source, &sfc);
  let mut writer = Writer::new(source, skipped, text, &[], &[], &imported);
  writer.scripts(&sfc);
  writer.template(&template);

  Ok(generated(writer.finish(sfc.lang()), "vue"))
}

/// A VitePress page, which VitePress compiles as a component.
pub fn markdown(_file: &str, source: &str, skipped: &Skipped) -> Result<Generated, String> {
  let markdown = markdown::read(source);
  let mut sfc = Sfc::default();
  let mut blocks_template = Template::default();
  for block in &markdown.blocks {
    sfc::scan(
      &markdown.text,
      block.start as usize,
      block.end as usize,
      &mut sfc,
      &mut blocks_template,
    );
  }

  let page = markdown.into_template();
  let mut template = Template::default();
  html::parse(
    &page.text,
    0,
    page.text.len(),
    html::Mode::Root,
    &mut template,
  );
  template.finish();

  let imported = component_imports(source, &sfc);
  let mut writer = Writer::new(
    source,
    skipped,
    &page.text,
    &page.code,
    &page.blanks,
    &imported,
  );
  writer.scripts(&sfc);
  writer.template(&template);

  Ok(generated(writer.finish(sfc.lang()), "markdown"))
}

fn generated(built: BuiltCode, language: &str) -> Generated {
  Generated {
    source: GeneratedSource {
      main: built.code,
      scripts: Vec::new(),
      language: language.to_string(),
      component_fields: Vec::new(),
      scope_objects: Vec::new(),
      // `defineProps(…)` and `withDefaults(defineProps(…), …)` return the props, and a name the
      // module does not declare is a prop (the template's, or the Options API's).
      props: Some(PropsReads {
        calls: vec!["defineProps".to_string(), "withDefaults".to_string()],
        members: Vec::new(),
        variables: Vec::new(),
        undeclared: true,
      }),
      // `Child({ label: … })`
      component_instances: Some(ComponentInstances {
        via: InstantiationSyntax::Call,
        path: Vec::new(),
      }),
    },
    expressions: built.expressions,
  }
}

/// What `@vue/language-core` calls imported components: the names of `.vue` files' default exports
/// that `<script setup>` imports, and `<script>` with it.
fn component_imports<'s>(source: &'s str, sfc: &Sfc) -> Vec<&'s str> {
  let mut imported = Vec::new();
  let Some(setup) = sfc.script_setup else {
    return imported;
  };
  default_imports_of_vue_files(source, setup.content, &mut imported);
  if let Some(script) = sfc.script {
    default_imports_of_vue_files(source, script.content, &mut imported);
  }
  imported
}

/// `import Name from "./Name.vue"` and `import { default as Name } from "./Name.vue"` in
/// `source[script]`.
fn default_imports_of_vue_files<'s>(source: &'s str, script: Span, imported: &mut Vec<&'s str>) {
  let bytes = source.as_bytes();
  let (start, end) = (script.start as usize, script.end as usize);
  if start >= end || end > bytes.len() {
    return;
  }
  let is_name_byte = |byte: u8| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'$';
  let skip_spaces = |mut position: usize| {
    while position < end && bytes[position].is_ascii_whitespace() {
      position += 1;
    }
    position
  };
  let name_at = |position: usize| {
    let mut name_end = position;
    while name_end < end && is_name_byte(bytes[name_end]) {
      name_end += 1;
    }
    (name_end > position && is_identifier(&bytes[position..name_end]))
      .then(|| (&source[position..name_end], name_end))
  };

  for found in memmem::find_iter(&bytes[start..end], b"import") {
    let at = start + found;
    if at > start && (is_name_byte(bytes[at - 1]) || bytes[at - 1] == b'.') {
      continue;
    }
    let after = at + b"import".len();
    if after >= end || !(bytes[after].is_ascii_whitespace() || bytes[after] == b'{') {
      continue;
    }

    let mut names: [Option<&str>; 8] = [None; 8];
    let mut count = 0;
    let mut position = skip_spaces(after);

    if let Some((name, name_end)) = name_at(position) {
      if name == "type" && name_at(skip_spaces(name_end)).is_some_and(|(next, _)| next != "from") {
        continue;
      }
      names[0] = Some(name);
      count = 1;
      position = skip_spaces(name_end);
      if position < end && bytes[position] == b',' {
        position = skip_spaces(position + 1);
      }
    }
    if position < end && bytes[position] == b'{' {
      let Some(close) = memchr::memchr(b'}', &bytes[position..end]) else {
        continue;
      };
      let close = position + close;
      for specifier in source[position + 1..close].split(',') {
        let mut words = specifier.split_whitespace();
        if let (Some("default"), Some("as"), Some(name), None) =
          (words.next(), words.next(), words.next(), words.next())
        {
          if count < names.len() && is_identifier(name.as_bytes()) {
            names[count] = Some(name);
            count += 1;
          }
        }
      }
      position = skip_spaces(close + 1);
    } else if position < end && bytes[position] == b'*' {
      continue;
    }

    if count == 0 || !bytes[position..end].starts_with(b"from") {
      continue;
    }
    position = skip_spaces(position + 4);
    let Some(&quote) = bytes
      .get(position)
      .filter(|&&quote| quote == b'"' || quote == b'\'')
    else {
      continue;
    };
    let Some(length) = memchr::memchr(quote, &bytes[position + 1..end]) else {
      continue;
    };
    let specifier = &bytes[position + 1..position + 1 + length];
    if specifier.ends_with(b".vue") {
      imported.extend(names.iter().take(count).flatten());
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::lower::{lower_located, Lang};

  fn written(generated: Result<Generated, String>) -> Generated {
    match generated {
      Ok(generated) => generated,
      Err(error) => panic!("{error}"),
    }
  }

  fn code(generate: fn(&str, &str, &Skipped) -> Result<Generated, String>, source: &str) -> String {
    let generated = written(generate("/app/a", source, &Skipped::default()));
    let code = generated.source.main.code;
    if let Err(error) = lower_located(&code, generated.source.main.lang) {
      panic!("{}\n{code}", error.message);
    }
    code
  }

  /// The source text each mapping covers, in the code's order.
  fn mapped(source: &str) -> Vec<String> {
    let generated = written(vue("/app/a.vue", source, &Skipped::default()));
    generated
      .source
      .main
      .mappings
      .iter()
      .map(|mapping| {
        let units: Vec<u16> = source.encode_utf16().collect();
        let start = mapping.source as usize;
        String::from_utf16_lossy(&units[start..start + mapping.source_length as usize])
      })
      .collect()
  }

  #[test]
  fn writes_scripts_then_the_template() {
    let source = [
      "<template>",
      "  <h1 :title=\"m.title()\">{{ m.greeting({ name }) }}</h1>",
      "  <p v-if=\"show\">{{ count > 1 ? m.items({ count }) : m.item() }}</p>",
      "  <p v-else>x</p>",
      "  <button @click=\"setLocale('de'); track()\">{{ \"{{\" }}</button>",
      "  <input v-model=\"name\" :placeholder='m.name_placeholder()' />",
      "  <paraglide-message :message=\"m.tos\" />",
      "  <ParaglideMessage v-bind:message=\"m.tos\"></ParaglideMessage>",
      "  <li v-for=\"(m, index) in lists\" :key=\"m.id\">{{ m.label }}</li>",
      "  <List><template #row=\"{ m }\">{{ m.label }}</template></List>",
      "</template>",
      "<script lang=\"ts\">export default { name: \"Cart\" };</script>",
      "<script setup lang=\"ts\">",
      "import { m } from \"../paraglide/messages.js\";",
      "</script>",
    ]
    .join("\n");
    assert_eq!(
      code(vue, &source),
      [
        "export default { name: \"Cart\" };",
        ";",
        "",
        "import { m } from \"../paraglide/messages.js\";",
        "",
        ";",
        "(() => {",
        "(m.title());",
        "(m.greeting({ name }));",
        "if (show) {",
        "(count > 1 ? m.items({ count }) : m.item());",
        "}",
        "{",
        "}",
        "($event) => {",
        "setLocale('de'); track()",
        "};",
        "(\"{{\");",
        "(name);",
        "(m.name_placeholder());",
        "ParaglideMessage({",
        "message: (m.tos),",
        "});",
        "ParaglideMessage({",
        "message: (m.tos),",
        "});",
        "(lists);",
        "for (const [m, index] of []) {",
        "(m.id);",
        "(m.label);",
        "}",
        "List({",
        "});",
        "(({ m }) => {",
        "(m.label);",
        "});",
        "});",
        "",
      ]
      .join("\n")
    );
  }

  #[test]
  fn components_pass_their_attributes_as_props() {
    let source = "<script setup>\nimport Foo from './Foo.vue';\n</script>\n<template><foo kind=\"x\" :my-prop=\"a\" aria-label=\"b\" v-bind=\"rest\" v-model=\"c\" :[k]=\"d\" disabled :shorthand @custom=\"go\" v-focus=\"e\" style=\"s\"/><component :is=\"comp\" :a=\"1\" /><my.comp/></template>";
    let written = code(vue, source);
    let template = &written[written.find("(() => {").unwrap_or(0)..];
    assert_eq!(
      template,
      [
        "(() => {",
        "Foo({",
        "kind: \"x\",",
        "myProp: (a),",
        "\"aria-label\": \"b\",",
        "...(rest),",
        "modelValue: (c),",
        "[(k)]: (d),",
        "disabled: true,",
        "shorthand: shorthand,",
        "style: {},",
        "});",
        "($event) => {",
        "go",
        "};",
        "(e);",
        "(comp)({",
        "a: (1),",
        "});",
        "my.comp({",
        "});",
        "});",
        "",
      ]
      .join("\n")
    );
  }

  #[test]
  fn expressions_map_to_their_place() {
    let source = "<script setup>\nconst a = 1;\n</script>\n<template><p :title=\"é(a)\">{{ m.x() }}</p><message-view /></template>";
    assert_eq!(
      mapped(source),
      ["\nconst a = 1;\n", "é(a)", "m.x()", "message-view"]
    );
  }

  #[test]
  fn a_skipped_expression_is_zero() {
    let source = "<template><p :title=\"m.broken(\">{{ m.ok() }}</p></template>";
    let mut skipped = Skipped::default();
    skipped.insert(0);
    let generated = written(vue("/app/a.vue", source, &skipped));
    assert_eq!(
      generated.source.main.code,
      "(() => {\n(0);\n(m.ok());\n});\n"
    );
  }

  #[test]
  fn v_pre_and_slots_scope() {
    let source = "<template><p v-pre :a=\"x\">{{ y }}</p><Comp v-slot=\"{ item }\" v-if=\"ok\" v-for=\"i in list\">{{ item }}</Comp></template>";
    let written = code(vue, source);
    assert_eq!(
      written,
      "(() => {\nif (ok) {\n(list);\nfor (const [i] of []) {\nComp({\n});\n(({ item }) => {\n(item);\n});\n}\n}\n});\n"
    );
  }

  #[test]
  fn pug_templates_are_templates() {
    let source = "<script setup lang=\"ts\">\nimport Child from './Child.vue';\n</script>\n<template lang=\"pug\">\nsection(:aria-label=\"title\")\n  Child(:label=\"m.x\" kind=\"x\")\n  p {{ count }}\n</template>\n";
    let written = code(vue, source);
    assert!(written
      .ends_with("(() => {\n(title);\nChild({\nlabel: (m.x),\nkind: \"x\",\n});\n(count);\n});\n"));
  }

  #[test]
  fn markdown_pages_are_templates() {
    let source = "---\ntitle: \"{{ no }}\"\n---\n<script setup lang=\"ts\">\nconst a = `${m.label()}`;\n</script>\n\n# {{ m.heading() }}\n\n```vue\n{{ m.fenced() }}\n```\n\nInline `{{ m.code() }}` and <span :title=\"m.title()\">x</span> <https://a.b>\n<style>\np { content: \"{{ m.style() }}\" }\n</style>\n";
    let generated = written(markdown("/app/a.md", source, &Skipped::default()));
    assert_eq!(generated.source.main.lang, Lang::Ts);
    assert_eq!(
      generated.source.main.code,
      "\nconst a = `${m.label()}`;\n\n;\n(() => {\n(m.heading());\n(m.title());\n});\n"
    );
  }

  #[test]
  fn a_script_src_is_the_component() {
    let source = "<script src=\"./logic.ts\"></script>\n<script setup>\nconst a = 1;\n</script>\n<template><p>{{ a }}</p></template>";
    assert_eq!(
      code(vue, source),
      "import __VLS_src from \"./logic.js\";\nexport default __VLS_src;\n(() => {\n(a);\n});\n"
    );
  }

  #[test]
  fn imports_of_vue_files_name_components() {
    let source = "import A from './A.vue'\nimport B, { default as C, d } from \"./B.vue\";\nimport type T from './T.vue';\nimport E from './E.js';\nimport { default as F } from './F.vue';\nconst reimport = 1;";
    let mut imported = Vec::new();
    default_imports_of_vue_files(source, Span::new(0, source.len()), &mut imported);
    assert_eq!(imported, ["A", "B", "C", "F"]);
  }

  /// Writes `source` as `prepare_native` does: skipping the expression a syntax error is in or
  /// after, until the code parses. Returns how many were skipped, or none if the file is.
  fn skipped_expressions(source: &str) -> Option<usize> {
    let mut skipped = Skipped::default();
    loop {
      let generated = written(vue("/app/a.vue", source, &skipped));
      let main = &generated.source.main;
      match lower_located(&main.code, main.lang) {
        Ok(_) => return Some(skipped.len()),
        Err(error) => {
          let expression = error.offset.and_then(|offset| {
            crate::languages::builder::expression_at(&generated.expressions, &skipped, offset)
          })?;
          if skipped.len() >= 20 {
            return None;
          }
          skipped.insert(expression);
        }
      }
    }
  }

  #[test]
  fn a_broken_expression_costs_only_itself() {
    let after = "{{ a }}<p :x=\"b\" @click=\"c()\">{{ d }}</p><Comp :e=\"f\" />";
    for broken in [
      "{{ m.( }}",
      "{{ `unterminated }}",
      "{{ 'unterminated }}",
      "{{ /* unterminated }}",
      "{{ ({ a: 1 }}",
      "{{ a } }}",
      "<p :title=\"m.broken(\"></p>",
      "<p v-for=\"(a b) in xs\"></p>",
      "<p v-for=\"a in (xs\"></p>",
      "<Comp #row=\"{ a\"></Comp>",
      "<p @click=\"a(\"></p>",
      "<p :[a(]=\"b\"></p>",
    ] {
      let source =
        format!("<script setup>\nconst a = 1;\n</script>\n<template>{broken}{after}</template>");
      assert_eq!(skipped_expressions(&source), Some(1), "{broken}");
    }
    let script = "<script setup>\nconst = 1;\n</script>\n<template>{{ a }}</template>";
    assert_eq!(skipped_expressions(script), None);
    let script_after = "<template>{{ a }}</template>\n<script setup>\nfunction f() {\n</script>";
    assert_eq!(skipped_expressions(script_after), None);
  }

  /// Mappings within the file and the code, and expressions at the code's character boundaries.
  fn assert_consistent(source: &str, generated: &Generated) {
    let main = &generated.source.main;
    let source_length = source.encode_utf16().count() as i32;
    let code_length = main.code.encode_utf16().count();
    assert_eq!(main.length, code_length, "{source:?}");
    for mapping in &main.mappings {
      assert!(
        mapping.source >= 0 && mapping.source + mapping.source_length <= source_length,
        "{source:?}"
      );
      assert!(
        mapping.generated + mapping.length <= code_length as i32,
        "{source:?}"
      );
    }
    for &(start, end) in &generated.expressions {
      assert!(
        start <= end && main.code.is_char_boundary(end as usize),
        "{source:?}"
      );
      assert!(main.code.is_char_boundary(start as usize), "{source:?}");
    }
  }

  /// Mutates components at random: whatever the file, it is written without a panic.
  #[test]
  fn never_panics_on_mutated_files() {
    let seeds = [
      "<script setup lang=\"ts\">\nimport A from './A.vue';\n</script>\n<template>\n  <A v-for=\"(x, i) in xs\" :a=\"x\" #row=\"{ m }\" @click=\"go(); m.b()\">{{ m.c({ x }) }}</A>\n  <p v-if=\"é\" v-pre>{{ y }}</p><textarea>{{ z }}</textarea>\n</template>\n",
      "<template lang=\"pug\">\ndiv.a#b(:c=\"d\", e='f')\n  p #[strong(:g=\"h\") {{ i }}] j\n  ul: li(v-for=\"k in l\") {{ k }}\n  p.\n    {{ m }}\n  | {{ n }}\n  // o\n    p {{ p }}\n</template>\n",
    ];
    let inserts = [
      "<",
      ">",
      "\"",
      "'",
      "`",
      "{{",
      "}}",
      "/",
      "=",
      "(",
      ")",
      "[",
      "]",
      "#[",
      "é",
      "😀",
      "\n",
      "\n  ",
      ":",
      "@",
      "#",
      "v-",
      "</template>",
      "<!--",
      "-->",
      "\r",
      "\t",
      "$$",
      "```",
      "---\n",
    ];
    let mut state: u64 = 0x9e37_79b9_7f4a_7c15;
    let mut random = move |bound: usize| {
      state ^= state << 13;
      state ^= state >> 7;
      state ^= state << 17;
      (state % bound as u64) as usize
    };
    let rounds = std::env::var("PARAGLIDE_VUE_FUZZ")
      .ok()
      .and_then(|rounds| rounds.parse().ok())
      .unwrap_or(1500);
    for seed in seeds {
      for _ in 0..rounds {
        let mut source = seed.to_string();
        for _ in 0..1 + random(4) {
          let mut at = random(source.len() + 1);
          while !source.is_char_boundary(at) {
            at -= 1;
          }
          if random(3) == 0 {
            let mut end = (at + random(8)).min(source.len());
            while !source.is_char_boundary(end) {
              end -= 1;
            }
            source.replace_range(at..end, "");
          } else {
            source.insert_str(at, inserts[random(inserts.len())]);
          }
        }
        let skipped = Skipped::default();
        for generate in [vue, markdown] {
          assert_consistent(&source, &written(generate("/app/a", &source, &skipped)));
        }
      }
    }
  }

  #[test]
  fn never_panics_on_broken_files() {
    let sources = [
      "<template><p :a=\"",
      "<template><p {{ a",
      "<template lang=\"pug\">\np(:a=\"x",
      "<template lang=\"pug\">\n  p\n    | {{ a",
      "<template><Comp v-for=\"\" v-slot:[ #=\"\" @[=\"\" /></template>",
      "<script setup>",
      "<template><é :é=\"é\">{{ é }}</é></template>",
      "",
    ];
    for source in sources {
      written(vue("/app/a.vue", source, &Skipped::default()));
      written(markdown("/app/a.md", source, &Skipped::default()));
    }
  }

  /// Reads the files of `PARAGLIDE_VUE_TIMING` (separated by `:`) and prints how long writing each
  /// takes: `cargo test … --lib languages::vue -- --ignored --nocapture timing`.
  #[test]
  #[ignore]
  fn timing() {
    let Ok(files) = std::env::var("PARAGLIDE_VUE_TIMING") else {
      return;
    };
    for file in files.split(':') {
      let Ok(source) = std::fs::read_to_string(file) else {
        panic!("{file} is not readable");
      };
      let generate = if file.ends_with(".md") { markdown } else { vue };
      let runs = 50;
      let mut best = std::time::Duration::MAX;
      let mut total = std::time::Duration::ZERO;
      let mut generated = None;
      for _ in 0..runs {
        let started = std::time::Instant::now();
        generated = Some(written(generate(file, &source, &Skipped::default())));
        let took = started.elapsed();
        best = best.min(took);
        total += took;
      }
      let Some(generated) = generated else {
        return;
      };
      let started = std::time::Instant::now();
      let parsed = lower_located(&generated.source.main.code, generated.source.main.lang);
      assert!(parsed.is_ok(), "{file} does not parse");
      let parse = started.elapsed();
      let megabytes = source.len() as f64 / 1e6;
      println!(
        "{file}: {:.2} MB, generate best {:.2} ms (mean {:.2} ms, {:.0} ms/MB), then parsing its {:.2} MB {:.2} ms",
        megabytes,
        best.as_secs_f64() * 1e3,
        total.as_secs_f64() * 1e3 / runs as f64,
        best.as_secs_f64() * 1e3 / megabytes,
        generated.source.main.code.len() as f64 / 1e6,
        parse.as_secs_f64() * 1e3,
      );
    }
  }
}
