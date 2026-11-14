use super::{generate::generate, js};
use crate::{
  languages::{builder::expression_at, Generated, Skipped},
  lower::{lower, lower_located, Lang},
};

fn generated(source: &str) -> Generated {
  match generate("/app/A.svelte", source, &Skipped::default()) {
    Ok(generated) => generated,
    Err(error) => panic!("{error}\n{source}"),
  }
}

/// The module written for `source`, which must parse.
fn code(source: &str) -> String {
  let code = generated(source).source.main.code;
  if let Err(error) = lower(&code, Lang::Ts) {
    panic!("{error}\n{code}");
  }
  code
}

fn rejected(source: &str) -> String {
  match generate("/app/A.svelte", source, &Skipped::default()) {
    Ok(generated) => panic!("not rejected: {}", generated.source.main.code),
    Err(error) => error,
  }
}

/// The source text each mapping copies, in order.
fn copied(source: &str) -> Vec<String> {
  let generated = generated(source);
  let utf16: Vec<u16> = source.encode_utf16().collect();
  generated
    .source
    .main
    .mappings
    .iter()
    .map(|mapping| {
      let start = mapping.source as usize;
      String::from_utf16_lossy(&utf16[start..start + mapping.source_length as usize])
    })
    .collect()
}

#[test]
fn scripts_are_copied_and_expressions_are_statements() {
  let source = "<script lang=\"ts\">\n  import { m } from \"./m.js\";\n</script>\n<h1 title=\"Hi {m.a()}!\">{m.b()}</h1>";
  assert_eq!(
    code(source),
    "\n  import { m } from \"./m.js\";\n\n;\n(m.a());(m.b());"
  );
  assert_eq!(
    copied(source),
    ["\n  import { m } from \"./m.js\";\n", "m.a()", "m.b()"]
  );
}

#[test]
fn blocks_scope_what_they_declare() {
  assert_eq!(
    code("{#if a}{x}{:else if b}{y}{:else}{z}{/if}"),
    "if (a) {(x);} else if (b) {(y);} else {(z);}"
  );
  assert_eq!(
    code("{#each items as { id, label: [first] }, i (id)}{first}{:else}{none}{/each}"),
    "for (const { id, label: [first] } of items ) {let i;(id);(first);} {(none);}"
  );
  assert_eq!(
    code("{#each { length: 3 }, i}{i}{/each}"),
    "{({ length: 3 });let i;(i);}"
  );
  assert_eq!(
    code("{#await load() then { m }}{m.a()}{:catch error}{error}{/await}"),
    "{const $$_await = await (load() );{const { m } = $$_await;(m.a());} {const error = $$_error;(error);}}"
  );
  assert_eq!(
    code("{#await p}{wait}{:then}{done}{/await}"),
    "{const $$_await = await (p);{(wait);} {(done);}}"
  );
  assert_eq!(code("{#key k}{x}{/key}"), "(k);{(x);}");
  assert_eq!(
    code("{#snippet row<T>(item: T, i = 0)}{item}{/snippet}{@render row(m.a())}"),
    "async function row<T>(item: T, i = 0) {(item);}(row(m.a()));"
  );
}

#[test]
fn the_each_list_may_hold_a_typescript_as() {
  assert_eq!(
    code("{#each (items as Item[]) as item: Item, index}{item}{/each}"),
    "for (const item of (items as Item[]) ) {let index;(item);}"
  );
  assert_eq!(
    code("{#each items as item (item.id as string)}{item}{/each}"),
    "for (const item of items ) {(item.id as string);(item);}"
  );
}

#[test]
fn components_are_called_with_their_props() {
  assert_eq!(
    code("<Label message={m.a} kind=\"x\" title='a {b} `c`' disabled {value} {...rest} bind:open on:click={go} bind:this={el} />"),
    "Label({message:m.a,kind:\"x\",title:`a ${b} \\`c\\``,disabled:true,value,...rest,open,});(go);(el);"
  );
  assert_eq!(
    code("<svelte:component this={Dynamic} a={1} /><ui.Button aria-label=\"x\" />"),
    "(Dynamic)({a:1,});ui.Button({\"aria-label\":\"x\",});"
  );
  assert_eq!(code("<Label s={a, b} />"), "Label({s:(a, b),});");
}

#[test]
fn let_directives_scope_the_content() {
  assert_eq!(
    code("<List let:m let:item={x} let:row={{ a, b }}>{m.label}</List>"),
    "List({});{const {m,item:x,row:{ a, b },} = $$_slot;(m.label);}"
  );
}

#[test]
fn directives_are_read_as_svelte_reads_them() {
  assert_eq!(
    code("<input bind:value use:tip={m.a()} transition:fade|local in:fly animate:flip={{ d: 1 }} class:active style:color=\"red {c}\" on:input={f} {@attach at(m.b())} />"),
    "value;tip($$_element, m.a());fade($$_element);fly($$_element);flip($$_element, $$_element, { d: 1 });active;(c);(f);(at(m.b()));"
  );
}

#[test]
fn const_tags_and_declarations() {
  assert_eq!(
    code("{@const t = m}{t.a()}{let count = $state(0)}{const double = count * 2}"),
    "const t = m;(t.a());let count = $state(0);const double = count * 2;"
  );
  // A declaration in an element: every element then scopes its content.
  assert_eq!(
    code("<ul><li>{@const x = 1}{x}</li><li><br/></li></ul>"),
    "{{const x = 1;(x);}{}}"
  );
}

#[test]
fn raw_text_comments_and_styles_are_not_read() {
  assert_eq!(
    code("<!-- {m.a()} --><div><script>{m.b()}</script><style>{m.c()}</style></div><textarea>{m.d()} x</textarea><style>p { color: red }</style>"),
    "(m.d());"
  );
}

#[test]
fn special_elements() {
  assert_eq!(
    code("<svelte:head><title>{m.t()}</title></svelte:head><svelte:element this={tag} title={m.x()} /><svelte:window on:keydown={k} /><svelte:options runes={true} />"),
    "(m.t());(tag);(m.x());(k);"
  );
  assert_eq!(
    code("<svelte:boundary onerror={e}>{@const z = 1}{z}</svelte:boundary>"),
    "(e);{const z = 1;(z);}"
  );
}

#[test]
fn the_module_script_and_svelte_4_props() {
  let source = "<script context=\"module\">export const t = 1;</script><script>\n  /* é */ export let a = 1, b = { c: 1, d: [2, 3] }, e;\n  export const f = 1;\n  export let { g } = h;\n  export let i\n  let j, k;\n  const s = `export let ${x}`;\n</script>";
  let generated = generated(source);
  let utf16 = |text: &str| text.encode_utf16().count() as i32;
  let offsets: Vec<i32> = ["a = 1", "b = {", "e;", "i\n"]
    .iter()
    .map(|name| utf16(&source[..source.find(name).unwrap_or(0)]))
    .collect();
  let props = generated.source.props.unwrap_or_default();
  assert_eq!(props.variables, offsets);
  assert_eq!(props.calls, ["$props"]);
}

#[test]
fn reactive_assignments_compute_their_value() {
  assert_eq!(
    code("<script>\n  let x;\n  $: x = m.a;\n  $: y = m.b\n  $: ({ c, d } = m.e);\n  $: if (z) w = m.f;\n  $: v == 1;\n  $: u => 1;\n  q = c ? $ : d;\n</script>"),
    "\n  let x;\n  $: x = $$_reactive, m.a;\n  $: y = $$_reactive, m.b\n  $: ({ c, d } = $$_reactive, m.e);\n  $: if (z) w = m.f;\n  $: v == 1;\n  $: u => 1;\n  q = c ? $ : d;\n\n;\n"
  );
}

#[test]
fn loose_markup_is_read_as_svelte_reads_it() {
  // What is left open at the end is closed there.
  assert_eq!(code("<div><p>{a}"), "(a);");
  assert_eq!(code("{#if a}<p>{b}"), "if (a) {(b);}");
  // A block closes the elements left open in it, and a closing tag the blocks.
  assert_eq!(code("{#if a}<p>{b}{/if}{c}"), "if (a) {(b);}(c);");
  assert_eq!(code("<div>{#if a}{b}</div>{c}"), "if (a) {(b);}(c);");
  // `<p>` is closed by the next `<p>`.
  assert_eq!(code("<p>{a}<p>{b}</p>"), "(a);(b);");
  // A tag being typed.
  assert_eq!(code("<div {#if a}{b}{/if}"), "if (a) {(b);}");
  assert_eq!(code("<Comp. {a}"), "$$_component({a,});");
}

#[test]
fn markup_svelte_rejects_is_an_error() {
  for source in [
    "<!-- open",
    "{/if}",
    "{#if a}<p>{:else}{/if}",
    "<Comp>{/if}",
    "{#unknown}",
    "{@attach x}",
    "<p class=\"a\" class=\"b\"></p>",
    "<p bind:value={a} value={b}></p>",
    "a < b",
    "</div>",
    "<script>a</script><script>b</script>",
    "<script>a",
    "<div><style>a</div>",
    "{a",
    "<svelte:unknown />",
    "<p {class}></p>",
    "<svelte:component />",
    "<div><svelte:head></svelte:head></div>",
    "{#each items as}{/each}",
    "{#if a}{:elseif b}{/if}",
    "{#if a}{:else}{:else}{/if}",
    "{var x = 1}",
    "<p title={#if a}></p>",
    "<p on:click=\"a {b}\"></p>",
  ] {
    rejected(source);
  }
}

#[test]
fn a_skipped_expression_is_zero() {
  let source = "<p title={m.broken(1 +)}>{m.after()}</p>{@const x = (}{x}";
  let mut skipped = Skipped::default();
  skipped.insert(0);
  skipped.insert(2);
  let generated = generate("/app/A.svelte", source, &skipped).map_err(|error| error.to_string());
  let generated = generated.unwrap_or_else(|error| panic!("{error}"));
  assert_eq!(generated.source.main.code, "(0);(m.after());(x);");
}

/// The module as the analysis reads it: written again without each construct that does not
/// parse, as `prepare_native` does.
fn prepared(source: &str) -> String {
  let mut skipped = Skipped::default();
  loop {
    let generated =
      generate("/app/A.svelte", source, &skipped).unwrap_or_else(|error| panic!("{error}"));
    let code = generated.source.main.code;
    let Err(error) = lower_located(&code, Lang::Ts) else {
      return code;
    };
    let unparsable = error
      .offset
      .and_then(|offset| expression_at(&generated.expressions, &skipped, offset));
    match unparsable {
      Some(expression) if skipped.len() < 20 => skipped.insert(expression),
      _ => panic!("{}\n{code}", error.message),
    };
  }
}

#[test]
fn a_pattern_that_does_not_parse_loses_only_itself() {
  assert_eq!(
    prepared("{#each list as {a b}}{x}{/each}{m.a()}"),
    "for (const $$_ of list ) {(x);}(m.a());"
  );
  assert_eq!(
    prepared("{#await p then {a b}}{x}{/await}<List let:x={a b}>{y}</List>{#snippet s(a b)}{z}{/snippet}{m.a()}"),
    "{const $$_await = await (p );{(x);}}List({});{(y);}async function $$_snippet() {(z);}(m.a());"
  );
}

#[test]
fn ends_of_expressions_skip_strings_templates_comments_and_regexes() {
  let end = |text: &str| js::closing(text.as_bytes(), 0, b'{', b'}').map(|closing| closing.at);
  assert_eq!(end("a}"), Some(1));
  assert_eq!(end("'}' + \"}\"}"), Some(9));
  assert_eq!(end("`${ {a: '}'} }}`}"), Some(16));
  assert_eq!(end("/}/.test(a) // }\n}"), Some(17));
  assert_eq!(end("a / b / c}"), Some(9));
  assert_eq!(end("/* } */ x}"), Some(9));
  assert_eq!(end("{ a: { b } }}"), Some(12));
  assert_eq!(end("m.x(}"), Some(4));
  assert_eq!(end("`unterminated }"), None);
  assert_eq!(end("a"), None);
  assert!(js::closing(b"a, b}", 0, b'{', b'}').is_some_and(|closing| closing.has_comma));
  assert!(js::closing(b"f(a, b)}", 0, b'{', b'}').is_some_and(|closing| !closing.has_comma));
}

#[test]
fn utf16_mappings() {
  let source = "<p>é {m.a()}</p>";
  let generated = generated(source);
  let mapping = generated.source.main.mappings[0];
  assert_eq!(
    (mapping.generated, mapping.source, mapping.length),
    (1, 6, 5)
  );
}

/// Times writing one file: `SVELTE_TIMING_FILE=<path> cargo test … languages::svelte::tests::timing
/// -- --ignored --nocapture`. Prints the time to write it, and to write and parse what is written.
#[test]
#[ignore]
fn timing() {
  let Ok(path) = std::env::var("SVELTE_TIMING_FILE") else {
    return;
  };
  let source = std::fs::read_to_string(&path).unwrap_or_else(|error| panic!("{path}: {error}"));
  let skipped = Skipped::default();
  let runs = 30;

  let measure = |parse: bool| {
    let mut times: Vec<f64> = (0..runs + 3)
      .map(|_| {
        let started = std::time::Instant::now();
        let generated =
          generate(&path, &source, &skipped).unwrap_or_else(|error| panic!("{error}"));
        if parse {
          let parsed = lower(&generated.source.main.code, Lang::Ts);
          assert!(parsed.is_ok());
        }
        started.elapsed().as_secs_f64() * 1000.0
      })
      .skip(3)
      .collect();
    times.sort_by(f64::total_cmp);
    (times[0], times[runs / 2])
  };

  let (write_min, write_median) = measure(false);
  let (parse_min, parse_median) = measure(true);
  let megabytes = source.len() as f64 / 1e6;
  println!(
    "{path}: {} bytes\n  write: min {write_min:.2} ms, median {write_median:.2} ms ({:.1} ms/MB)\n  write and parse: min {parse_min:.2} ms, median {parse_median:.2} ms",
    source.len(),
    write_median / megabytes,
  );
}

/// Every construct cut at every character, and with each character left out: errors, never panics.
#[test]
fn never_panics_on_truncated_or_mutated_markup() {
  let sample = concat!(
    "<script context=\"module\" lang=\"ts\">export const t = `a${1}`; /* } */</script>\n",
    "<script>\n  export let a = 1, b;\n  $: c = a;\n  const r = /[}]/g; // }\n</script>\n",
    "<!-- c --><svelte:head><title>{t}</title></svelte:head>\n",
    "<p title=\"a {b} c\" class:x style:y=\"z {w}\" use:act={p} on:click|once={f} {...s} {sh} {@attach at}>é {m.a()}</p>\n",
    "{#if a}x{:else if b}y{:else}z{/if}{#each l as {i, j: [k]}, n (i.id)}{i}{:else}e{/each}\n",
    "{#await p}w{:then v}{v}{:catch e}{e}{/await}{#await q then}d{/await}{#key k}{k}{/key}\n",
    "{#snippet s<T>(x: T)}{x}{/snippet}{@render s(1)}{@html h}{@const q = 1}{@debug a, b}{let d = 2}\n",
    "<Comp a={1} b=\"2\" c='{3}' bind:v let:item={{ u }}>{u}</Comp><svelte:component this={C} />\n",
    "<textarea>{ta}</textarea><div><script>{no}</script><style>{no}</style></div><br><ul><li>1<li>2</ul>\n",
    "<style>p { color: red }</style>"
  );
  let skipped = Skipped::default();
  let boundaries: Vec<usize> = sample
    .char_indices()
    .map(|(at, _)| at)
    .chain([sample.len()])
    .collect();

  assert!(generate("/app/A.svelte", sample, &skipped).is_ok());
  for &end in &boundaries {
    let _ = generate("/app/A.svelte", &sample[..end], &skipped);
  }
  for pair in boundaries.windows(2) {
    let mutated = format!("{}{}", &sample[..pair[0]], &sample[pair[1]..]);
    let _ = generate("/app/A.svelte", &mutated, &skipped);
  }

  // Characters that mean something in markup or code, put in at places a generator picks.
  let inserted = [
    "{", "}", "<", ">", "\"", "'", "`", "/", "\\", "é", "{#", "{/", "</", "${", "*/",
  ];
  let mut state: u64 = 0x2545_f491_4f6c_dd1d;
  let mut next = || {
    state ^= state << 13;
    state ^= state >> 7;
    state ^= state << 17;
    state
  };
  for _ in 0..20_000 {
    let mut text = sample.to_string();
    for _ in 0..3 {
      let at = boundaries[(next() % boundaries.len() as u64) as usize].min(text.len());
      let at = (0..=at)
        .rev()
        .find(|&at| text.is_char_boundary(at))
        .unwrap_or(0);
      text.insert_str(at, inserted[(next() % inserted.len() as u64) as usize]);
    }
    let _ = generate("/app/A.svelte", &text, &skipped);
  }
}
