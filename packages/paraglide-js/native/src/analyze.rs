//! The usages in a module: every place a tracked value is called or referenced.

use std::sync::{Arc, OnceLock};

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
  /// The index of the target.
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
  /// The target's file.
  pub target_file: FileId,
}

/// The usages in a loaded file.
pub fn analyze_file(graph: &Graph, file: FileId, custom: Option<&dyn CustomTargets>) -> Vec<Usage> {
  let Some(record) = graph.record(file) else {
    return Vec::new();
  };

  let mut usages = Vec::new();
  for id in graph.modules_of(record) {
    collect_module(graph, graph.module(id), custom, &mut usages);
  }

  if record.source.generated {
    one_per_source_range(usages)
  } else {
    usages
  }
}

/// Language tools write some code twice (Vue's component props) or reference a
/// name next to its call (`[greeting]` and `greeting()` for `{{ greeting() }}`).
/// A call is kept rather than a reference.
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

/// A module of more nodes is split between the cores, in subtrees of up to `CHUNK_NODES` nodes.
const PARALLEL_NODES: usize = 32_768;
const CHUNK_NODES: u32 = 8_192;

fn collect_module(
  graph: &Graph,
  module: &Module,
  custom: Option<&dyn CustomTargets>,
  usages: &mut Vec<Usage>,
) {
  let length = module.ast.nodes.len();
  let line_starts = OnceLock::new();
  let mut marks = vec![0u8; length];

  // Custom targets are asked in JavaScript, on its own thread; a small module is one walk.
  if custom.is_some() || length < PARALLEL_NODES {
    UsageCollector::new(graph, module, custom, &mut marks, 0, &line_starts).walk(
      0,
      length as NodeId,
      usages,
    );
  } else {
    usages.extend(collect_subtree(graph, module, 0, &mut marks, &line_starts));
  }
}

/// The usages in the subtree of `node`, its children's on cores of their own: marks only reach descendants.
fn collect_subtree(
  graph: &Graph,
  module: &Module,
  node: NodeId,
  marks: &mut [u8],
  line_starts: &OnceLock<Vec<u32>>,
) -> Vec<Usage> {
  let ast = &module.ast;
  let next = ast.next(node);
  let mut usages = Vec::new();

  if next - node <= CHUNK_NODES {
    UsageCollector::new(graph, module, None, marks, node, line_starts).walk(
      node,
      next,
      &mut usages,
    );
    return usages;
  }

  let visits_children =
    UsageCollector::new(graph, module, None, marks, node, line_starts).enter(node, &mut usages);
  if !visits_children {
    return usages;
  }

  // Consecutive children of up to `CHUNK_NODES` nodes together; a larger one alone, split in turn.
  let mut groups: Vec<(NodeId, NodeId, &mut [u8])> = Vec::new();
  let mut rest = &mut marks[1..];
  let mut start = node + 1;
  let mut group_end = start;

  for child in ast.children(node) {
    let child_end = ast.next(child);
    let is_large = child_end - child > CHUNK_NODES;
    let overflows = child_end - start > CHUNK_NODES && group_end > start;

    if is_large || overflows {
      if group_end > start {
        let (group, after) = rest.split_at_mut((group_end - start) as usize);
        groups.push((start, group_end, group));
        rest = after;
        start = group_end;
      }

      if is_large {
        let (group, after) = rest.split_at_mut((child_end - child) as usize);
        groups.push((child, child_end, group));
        rest = after;
        start = child_end;
      }
    }

    group_end = child_end;
  }
  if group_end > start {
    groups.push((start, group_end, rest));
  }

  let parts: Vec<Vec<Usage>> = groups
    .into_par_iter()
    .map(|(start, end, marks)| {
      let is_one_subtree = ast.next(start) == end;

      if is_one_subtree && end - start > CHUNK_NODES {
        return collect_subtree(graph, module, start, marks, line_starts);
      }

      let mut usages = Vec::new();
      UsageCollector::new(graph, module, None, marks, start, line_starts).walk(
        start,
        end,
        &mut usages,
      );
      usages
    })
    .collect();

  usages.extend(parts.into_iter().flatten());
  usages
}

struct UsageCollector<'g, 'm> {
  cx: Cx<'g>,
  record: &'g Module,
  module: ModuleId,
  /// `SKIPPED`: alias initializers and assignment targets, which are not usages.
  /// `RECORDED`: recorded as part of a usage, e.g. a callee; their computed keys can still hold usages.
  /// Of the nodes from `base` on.
  marks: &'m mut [u8],
  base: NodeId,
  line_starts: &'m OnceLock<Vec<u32>>,
}

impl<'g, 'm> UsageCollector<'g, 'm> {
  fn new(
    graph: &'g Graph,
    record: &'g Module,
    custom: Option<&'g dyn CustomTargets>,
    marks: &'m mut [u8],
    base: NodeId,
    line_starts: &'m OnceLock<Vec<u32>>,
  ) -> Self {
    Self {
      cx: Cx::new(graph, custom),
      record,
      module: record.id,
      marks,
      base,
      line_starts,
    }
  }

  /// Walks the subtrees from `start` to `end`, which follow each other.
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

  /// An expression that only names a tracked value, so that assigning it makes
  /// an alias and not a usage: `m`, `m.greeting`, `await import(…)`, `require(…)`.
  /// `{ title: m.title }` does not: it uses `m.title`.
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

  /// A parameter's or prop's value, or a member of it, that is only returned
  /// (`(value) => value`) or inspected (`if (!message.parts)`, `typeof message`,
  /// `message && …`). Its call site is the reference.
  fn is_passed_through_or_inspected(&mut self, node: NodeId) -> bool {
    let graph = self.cx.g;
    let ast = &self.record.ast;

    // `props` of `props.message.parts`
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

    // The nearest ancestor that is not a wrapper like `(…)` or `… as T`, and its child on the way to `node`.
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

    let code: &'g str = &self.record.source.code;
    let starts = self.line_starts.get_or_init(|| line_starts(code));
    let (line, column) = line_column(starts, start);
    let (end_line, _) = line_column(starts, end.saturating_sub(1));

    usages.push(Usage {
      target: value.target,
      name: value.name.clone(),
      dynamic: value.dynamic,
      kind,
      start,
      end,
      line,
      column,
      end_line,
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

  /// A module of many statements, with usages at every depth: in functions,
  /// objects, aliases and assignments, whose marks must stay with their subtree.
  fn large_module() -> String {
    let mut code = String::from("import { m } from \"./paraglide/messages.js\";\nimport * as all from \"./paraglide/messages.js\";\n");

    for index in 0..1500 {
      code.push_str(&format!(
        "export function f{index}(t = m.a{index}) {{\n  const alias = m.b{index};\n  let later;\n  later = all.c{index};\n  return [t(), alias(), later(), {{ title: m.d{index}() }}, m[`e_${{index}}`]()];\n}}\n"
      ));
    }

    code
  }

  fn usages(parallel: bool) -> Vec<(u32, u32, String, &'static str, bool)> {
    let graph = script_graph("/app/src/large.ts", large_module());
    let module = module_of(&graph, "/app/src/large.ts");
    assert!(module.ast.nodes.len() > PARALLEL_NODES);

    let mut found = Vec::new();
    if parallel {
      collect_module(&graph, module, None, &mut found);
    } else {
      let line_starts = OnceLock::new();
      let mut marks = vec![0u8; module.ast.nodes.len()];
      let end = module.ast.nodes.len() as NodeId;
      UsageCollector::new(&graph, module, None, &mut marks, 0, &line_starts)
        .walk(0, end, &mut found);
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
    let sequential = usages(false);
    assert!(sequential.len() > 7000, "{}", sequential.len());
    assert_eq!(usages(true), sequential);
  }
}
