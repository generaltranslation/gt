use std::sync::Arc;

use rayon::prelude::*;
use rustc_hash::FxHashMap;

use crate::{
  eval::{CustomTargets, Cx},
  graph::{FileId, Graph, Module, ModuleId},
  ir::{self, Kind, NodeId, Slot},
  positions::{line_column, line_starts},
  scope::{binding_at, is_global, is_read, reads_props, Binding, BindingKind, MAX_ALIAS_CHAIN},
  symbols::{Symbol, Value},
  syntax::{require_specifier, static_property_name, unwrap_expression},
};

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum UsageKind {
  Call,
  Method,
  Reference,
}

impl UsageKind {
  pub fn as_str(self) -> &'static str {
    match self {
      UsageKind::Call => "call",
      UsageKind::Method => "method",
      UsageKind::Reference => "reference",
    }
  }
}

#[derive(Debug)]
pub struct Usage {
  pub target: u32,
  /// The name within the target, e.g. a message id.
  pub name: Arc<str>,
  /// The name is computed: `name` is a pattern where `*` stands for any text.
  pub dynamic: bool,
  pub kind: UsageKind,
  /// UTF-16 offsets.
  pub start: u32,
  pub end: u32,
  pub line: u32,
  pub column: u32,
  pub end_line: u32,
  pub target_file: FileId,
}

/// None if the file changed on disk since it was loaded: its usages' lines are not known.
pub fn analyze_file(
  graph: &Graph,
  file: FileId,
  custom: Option<&dyn CustomTargets>,
) -> Option<Vec<Usage>> {
  let Some(record) = graph.record(file) else {
    return Some(Vec::new());
  };

  let mut usages = Vec::new();
  for id in graph.modules_of(record) {
    collect_module(graph, graph.module(id), custom, &mut usages);
  }
  if usages.is_empty() {
    return Some(usages);
  }

  if record.source.generated {
    usages = one_per_source_range(usages);
  }

  let text = record.source.text(graph.file(file))?;
  let starts = line_starts(&text);
  for usage in &mut usages {
    (usage.line, usage.column) = line_column(&starts, usage.start);
    (usage.end_line, _) = line_column(&starts, usage.end.saturating_sub(1));
  }

  Some(usages)
}

/// Language tools write some code twice (Vue's component props) or reference a name next to its
/// call (`[greeting]` and `greeting()` for `{{ greeting() }}`), so a call is kept rather than a
/// reference.
fn one_per_source_range(usages: Vec<Usage>) -> Vec<Usage> {
  let rank = |usage: &Usage| u8::from(usage.kind != UsageKind::Reference);
  let mut kept: Vec<Usage> = Vec::with_capacity(usages.len());
  // Two outdirs can define a message of the same name: the target's file tells them apart.
  let mut index_of: FxHashMap<(u32, u32, FileId, Arc<str>), usize> = FxHashMap::default();

  for usage in usages {
    let key = (
      usage.start,
      usage.target,
      usage.target_file,
      usage.name.clone(),
    );

    match index_of.get(&key) {
      Some(&index) => {
        if rank(&usage) > rank(&kept[index]) {
          kept[index] = usage;
        }
      }
      None => {
        index_of.insert(key, kept.len());
        kept.push(usage);
      }
    }
  }

  kept.sort_by_key(|usage| usage.start);

  kept
}

const SKIPPED: u8 = 1;
const RECORDED: u8 = 2;

const PARALLEL_NODES: usize = 32_768;
const CHUNK_NODES: u32 = 8_192;

fn collect_module(
  graph: &Graph,
  module: &Module,
  custom: Option<&dyn CustomTargets>,
  usages: &mut Vec<Usage>,
) {
  let length = module.ast.nodes.len();
  let mut marks = vec![0u8; length];

  if length < PARALLEL_NODES {
    UsageCollector::new(graph, module, custom, &mut marks, 0).walk(0, length as NodeId, usages);
  } else {
    usages.extend(collect_split(graph, module, custom, &mut marks));
  }
}

fn collect_split(
  graph: &Graph,
  module: &Module,
  custom: Option<&dyn CustomTargets>,
  marks: &mut [u8],
) -> Vec<Usage> {
  let ast = &module.ast;
  // Marks only reach descendants, so the runs are walked once every node above them was entered.
  let mut entered: Vec<(NodeId, Vec<Usage>)> = Vec::new();
  let mut runs: Vec<(NodeId, NodeId)> = Vec::new();

  let mut collector = UsageCollector::new(graph, module, custom, marks, 0);
  let mut to_split = vec![0];

  while let Some(node) = to_split.pop() {
    let mut found = Vec::new();
    let visits_children = collector.enter(node, &mut found);
    if !found.is_empty() {
      entered.push((node, found));
    }
    if !visits_children {
      continue;
    }

    let mut start = node + 1;
    let mut run_end = start;

    for child in ast.children(node) {
      let child_end = ast.next(child);
      let is_large = child_end - child > CHUNK_NODES;
      let overflows = child_end - start > CHUNK_NODES && run_end > start;

      if is_large || overflows {
        if run_end > start {
          runs.push((start, run_end));
          start = run_end;
        }

        if is_large {
          to_split.push(child);
          start = child_end;
        }
      }

      run_end = child_end;
    }
    if run_end > start {
      runs.push((start, run_end));
    }
  }
  drop(collector);

  runs.sort_unstable_by_key(|&(start, _)| start);
  entered.sort_unstable_by_key(|&(node, _)| node);

  let mut parts = Vec::with_capacity(runs.len());
  let mut rest = marks;
  let mut offset = 0;
  for &(start, end) in &runs {
    let (_, after) = rest.split_at_mut((start - offset) as usize);
    let (run, after) = after.split_at_mut((end - start) as usize);
    parts.push((start, end, run));
    rest = after;
    offset = end;
  }

  let walked: Vec<Vec<Usage>> = parts
    .into_par_iter()
    .map(|(start, end, marks)| {
      let mut usages = Vec::new();
      UsageCollector::new(graph, module, custom, marks, start).walk(start, end, &mut usages);
      usages
    })
    .collect();

  // In walk order: an entered node's usages come before those of the runs after it.
  let mut usages = Vec::new();
  let mut entered = entered.into_iter().peekable();
  for (&(start, _), walked) in runs.iter().zip(walked) {
    while let Some((_, found)) = entered.next_if(|&(node, _)| node < start) {
      usages.extend(found);
    }
    usages.extend(walked);
  }
  usages.extend(entered.flat_map(|(_, found)| found));

  usages
}

struct UsageCollector<'g, 'm> {
  cx: Cx<'g>,
  record: &'g Module,
  module: ModuleId,
  /// Marks of the nodes from `base` on: `SKIPPED` for those that are not usages, and `RECORDED` for
  /// parts of a usage, whose computed keys can still hold usages.
  marks: &'m mut [u8],
  base: NodeId,
}

impl<'g, 'm> UsageCollector<'g, 'm> {
  fn new(
    graph: &'g Graph,
    record: &'g Module,
    custom: Option<&'g dyn CustomTargets>,
    marks: &'m mut [u8],
    base: NodeId,
  ) -> Self {
    Self {
      cx: Cx::new(graph, custom),
      record,
      module: record.id,
      marks,
      base,
    }
  }

  fn walk(mut self, start: NodeId, end: NodeId, usages: &mut Vec<Usage>) {
    let ast = &self.record.ast;
    let mut node = start;

    while node < end {
      let visits_children = self.enter(node, usages);

      node = if visits_children {
        node + 1
      } else {
        ast.next(node)
      };
    }
  }

  fn is_marked(&self, node: NodeId, mark: u8) -> bool {
    self.marks[(node - self.base) as usize] & mark != 0
  }

  fn mark(&mut self, node: NodeId, mark: u8) {
    self.marks[(node - self.base) as usize] |= mark;
  }

  /// Returns whether to visit the node's children.
  fn enter(&mut self, node: NodeId, usages: &mut Vec<Usage>) -> bool {
    let ast = &self.record.ast;

    if self.is_marked(node, SKIPPED) {
      return false;
    }

    match ast.kind(node) {
      Kind::ImportDeclaration
      | Kind::ExportAllDeclaration
      | Kind::TSImportEqualsDeclaration
      | Kind::TSInterfaceDeclaration
      | Kind::TSTypeAliasDeclaration
      | Kind::TSModuleDeclaration
      | Kind::TSDeclareFunction => false,

      // `export { a }` re-exports `a`.
      Kind::ExportNamedDeclaration => ast.child(node, Slot::Declaration).is_some(),

      Kind::VariableDeclarator => {
        // A generated one, `const __VLS_1 = ParaglideMessage` for a tag, is not
        // an alias: its initializer is the usage.
        if ast.node(node).start >= 0 {
          if let Some(init) = ast.child(node, Slot::Init) {
            self.skip_alias(init);
          }
        }
        true
      }

      Kind::AssignmentExpression => {
        self.skip_assignment(node);
        true
      }

      Kind::ExportDefaultDeclaration => {
        if let Some(declaration) = ast.child(node, Slot::Declaration) {
          self.skip_alias(declaration);
        }
        true
      }

      Kind::CallExpression => {
        self.record_call(node, usages);
        true
      }

      Kind::Identifier | Kind::MemberExpression => self.record_reference(node, usages),

      _ => true,
    }
  }

  fn skip_alias(&mut self, expression: NodeId) {
    if self.is_alias(expression) {
      self.mark(expression, SKIPPED);
    }
  }

  fn skip_assignment(&mut self, assignment: NodeId) {
    let ast = &self.record.ast;
    if ast.node(assignment).data != ir::OP_PLAIN {
      return;
    }

    if let Some(left) = ast.child(assignment, Slot::Left) {
      let writes_name = ast.kind(left) != Kind::MemberExpression;
      if writes_name {
        self.mark(left, SKIPPED);
      }
    }

    if let Some(right) = ast.child(assignment, Slot::Right) {
      self.skip_alias(right);
    }
  }

  /// An expression that only names a tracked value, so assigning it makes an alias and not a usage:
  /// `m`, `m.greeting`, `await import(…)`, `require(…)`, but not `{ title: m.title }`.
  fn is_alias(&mut self, expression: NodeId) -> bool {
    let ast = &self.record.ast;
    let node = unwrap_expression(ast, expression);

    let names_value = match ast.kind(node) {
      Kind::Identifier | Kind::MemberExpression | Kind::AwaitExpression => true,
      Kind::CallExpression => {
        let is_global_name = |identifier: NodeId| is_global(ast, identifier);
        require_specifier(ast, node, Some(&is_global_name)).is_some()
      }
      _ => false,
    };

    names_value && self.cx.evaluate(self.module, node).is_some()
  }

  fn values_of(&mut self, expression: NodeId) -> Vec<Arc<Value>> {
    self
      .cx
      .evaluate_all(self.module, expression)
      .into_iter()
      .filter_map(|symbol| match symbol {
        Symbol::Value(value) => Some(value),
        Symbol::Namespace(_) => None,
      })
      .collect()
  }

  fn record_call(&mut self, call: NodeId, usages: &mut Vec<Usage>) {
    let ast = &self.record.ast;
    let Some(callee) = ast.child(call, Slot::Callee) else {
      return;
    };
    let callee = unwrap_expression(ast, callee);

    let called = self.values_of(callee);
    if !called.is_empty() {
      for value in &called {
        self.add(call, value, UsageKind::Call, usages);
      }

      self.mark_recorded(callee);
      return;
    }

    if ast.kind(callee) != Kind::MemberExpression {
      return;
    }

    let Some(method) = static_property_name(ast, callee) else {
      return;
    };
    let Some(object) = ast.child(callee, Slot::Object) else {
      return;
    };

    let receivers: Vec<Arc<Value>> = self
      .values_of(object)
      .into_iter()
      .filter(|value| value.methods.includes(&method))
      .collect();
    if receivers.is_empty() {
      return;
    }

    for value in &receivers {
      self.add(call, value, UsageKind::Method, usages);
    }
    self.mark_recorded(callee);
  }

  fn record_reference(&mut self, node: NodeId, usages: &mut Vec<Usage>) -> bool {
    let ast = &self.record.ast;

    if self.is_marked(node, RECORDED) {
      return true;
    }
    if ast.kind(node) == Kind::Identifier && !is_read(ast, node) {
      return false;
    }

    let symbols = self.cx.evaluate_all(self.module, node);
    if symbols.is_empty() {
      return true;
    }

    self.mark_recorded(node);

    let values: Vec<&Arc<Value>> = symbols.iter().filter_map(Symbol::as_value).collect();
    if values.is_empty() || self.is_passed_through_or_inspected(node) {
      return true;
    }

    for value in values {
      self.add(node, value, UsageKind::Reference, usages);
    }

    true
  }

  /// With the objects it is a member of: `m.greeting` and `m` of `m.greeting()`.
  fn mark_recorded(&mut self, node: NodeId) {
    let ast = &self.record.ast;
    let mut current = unwrap_expression(ast, node);
    self.mark(current, RECORDED);

    while ast.kind(current) == Kind::MemberExpression {
      let Some(object) = ast.child(current, Slot::Object) else {
        break;
      };
      current = unwrap_expression(ast, object);
      self.mark(current, RECORDED);
    }
  }

  /// A parameter's or prop's value, or a member of it, that is only returned or inspected
  /// (`if (!message.parts)`, `typeof message`), so that its call site is the reference.
  fn is_passed_through_or_inspected(&mut self, node: NodeId) -> bool {
    let graph = self.cx.g;
    let ast = &self.record.ast;

    let mut root = node;
    while ast.kind(root) == Kind::MemberExpression {
      let Some(object) = ast.child(root, Slot::Object) else {
        return false;
      };
      root = unwrap_expression(ast, object);
    }
    if ast.kind(root) != Kind::Identifier {
      return false;
    }

    let binding = binding_at(graph, self.record, root);
    if !binding.is_some_and(|binding| holds_arguments(graph, &binding, 0)) {
      return false;
    }

    let mut child = node;
    let mut parent = ast.parent(node);
    while let Some(wrapper) = parent.filter(|&parent| ast.kind(parent).is_transparent_wrapper()) {
      child = wrapper;
      parent = ast.parent(wrapper);
    }
    let Some(parent) = parent else { return false };
    let slot = ast.slot(child);

    match ast.kind(parent) {
      Kind::ReturnStatement => slot == Slot::Argument,
      Kind::ArrowFunctionExpression => slot == Slot::Body,
      Kind::MemberExpression => slot == Slot::Object,
      Kind::UnaryExpression | Kind::BinaryExpression | Kind::LogicalExpression => true,
      Kind::IfStatement
      | Kind::ConditionalExpression
      | Kind::WhileStatement
      | Kind::DoWhileStatement => slot == Slot::Test,
      _ => false,
    }
  }

  fn add(&mut self, node: NodeId, value: &Value, kind: UsageKind, usages: &mut Vec<Usage>) {
    let position = self.record.ast.node(node);

    // Code a language tool generated is not in the file.
    if position.start < 0 {
      return;
    }

    let (start, end) = (
      position.start as u32,
      self.record.ast.end(node).max(0) as u32,
    );

    usages.push(Usage {
      target: value.target,
      name: value.name.clone(),
      dynamic: value.dynamic,
      kind,
      start,
      end,
      line: 0,
      column: 0,
      end_line: 0,
      target_file: value.file,
    });
  }
}

/// A parameter, a prop, or a `const` of one: `const { message } = Astro.props`.
fn holds_arguments(graph: &Graph, binding: &Binding, depth: u32) -> bool {
  let init = match &binding.kind {
    BindingKind::Values { parameter, .. } => return *parameter,
    BindingKind::Alias { init, .. } if depth <= MAX_ALIAS_CHAIN => *init,
    _ => return false,
  };

  let Some(scope) = binding.alias_module(graph) else {
    return false;
  };
  let record = graph.module(scope);
  let ast = &record.ast;
  let init = unwrap_expression(ast, init);

  if reads_props(record, init) {
    return true;
  }
  if ast.kind(init) != Kind::Identifier {
    return false;
  }

  binding_at(graph, record, init).is_some_and(|binding| holds_arguments(graph, &binding, depth + 1))
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::graph::{module_of, script_graph};

  fn large_module() -> String {
    let mut code = String::from("import { m } from \"./paraglide/messages.js\";\nimport * as all from \"./paraglide/messages.js\";\n");

    for index in 0..1500 {
      code.push_str(&format!(
        "export function f{index}(t = m.a{index}) {{\n  const alias = m.b{index};\n  let later;\n  later = all.c{index};\n  return [t(), alias(), later(), {{ title: m.d{index}() }}, m[`e_${{index}}`]()];\n}}\n"
      ));
    }

    code
  }

  /// `"s0" + m.k1() + "s2" + …`: a chain of `+` as deep as it is long, with usages along it.
  fn deep_module(terms: usize) -> String {
    let mut code =
      String::from("import { m } from \"./paraglide/messages.js\";\nexport const x = \"s0\"");

    for index in 1..terms {
      if index % 50 == 0 {
        code.push_str(&format!(" + m.k{index}()"));
      } else {
        code.push_str(&format!(" + \"s{index}\""));
      }
    }
    code.push_str(";\n");

    code
  }

  fn usages(code: String, parallel: bool) -> Vec<(u32, u32, String, &'static str, bool)> {
    let graph = script_graph("/app/src/large.ts", code);
    let module = module_of(&graph, "/app/src/large.ts");
    assert!(module.ast.nodes.len() > PARALLEL_NODES);

    let mut found = Vec::new();
    if parallel {
      collect_module(&graph, module, None, &mut found);
    } else {
      let mut marks = vec![0u8; module.ast.nodes.len()];
      let end = module.ast.nodes.len() as NodeId;
      UsageCollector::new(&graph, module, None, &mut marks, 0).walk(0, end, &mut found);
    }

    found
      .into_iter()
      .map(|usage| {
        (
          usage.start,
          usage.end,
          usage.name.to_string(),
          usage.kind.as_str(),
          usage.dynamic,
        )
      })
      .collect()
  }

  #[test]
  fn a_large_module_split_between_cores_has_the_usages_of_one_walk() {
    let sequential = usages(large_module(), false);
    assert!(sequential.len() > 7000, "{}", sequential.len());
    assert_eq!(usages(large_module(), true), sequential);
  }

  #[test]
  fn usages_of_a_file_on_disk_get_their_lines_from_it_unless_it_changed() {
    use crate::{
      graph::{GraphOptions, Target, TargetKind},
      load::{link_with, load, unlinked, Input, Request},
    };

    let root = std::env::temp_dir().join(format!("on-disk-{}", std::process::id()));
    let _ = std::fs::create_dir_all(&root);
    let file = root.join("a.ts").to_string_lossy().into_owned();
    let code = "import { m } from './paraglide/messages.js';\n\nexport const t = m.greeting();\n";
    let _ = std::fs::write(&file, code);

    let mut graph = Graph::new(GraphOptions {
      targets: vec![Target {
        name: "message".into(),
        kind: TargetKind::Messages,
      }],
      outdirs: vec![root.join("paraglide").to_string_lossy().into_owned()],
      source_extensions: Vec::new(),
      sources_on_disk: true,
    });
    let request = Request {
      file: file.clone(),
      order: 0,
      input: Input::Read,
    };
    load(&mut graph, vec![request], &[], None);
    let modules = unlinked(&graph);
    let messages = root
      .join("paraglide/messages.js")
      .to_string_lossy()
      .into_owned();
    link_with(&mut graph, &modules, vec![Some(messages)]);
    graph.prepare();
    let id = graph.known_file(&file).unwrap_or_default();

    let usages = analyze_file(&graph, id, None).unwrap_or_default();
    let lines: Vec<(u32, u32, u32)> = usages
      .iter()
      .map(|usage| (usage.line, usage.column, usage.end_line))
      .collect();
    assert_eq!(lines, [(3, 18, 3)]);

    // The same length, other text: its offsets no longer say where the usages are.
    let _ = std::fs::write(&file, code.replace("greeting", "farewell"));
    assert!(analyze_file(&graph, id, None).is_none());

    let _ = std::fs::remove_dir_all(&root);
  }

  #[test]
  fn a_deep_module_is_split_without_a_call_per_level() {
    // As the addon's threads, whose stack is `WORKER_STACK_BYTES`.
    let Ok(pool) = rayon::ThreadPoolBuilder::new().stack_size(16 << 20).build() else {
      panic!("no threads");
    };

    pool.install(|| {
      let sequential = usages(deep_module(40_000), false);
      assert_eq!(sequential.len(), 799);
      assert_eq!(usages(deep_module(40_000), true), sequential);
    });
  }
}
