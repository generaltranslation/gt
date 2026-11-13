//! The texts a computed key can have: `"a"` → a; `` `err_${code}` `` → err_*;
//! `cond ? "a" : "b"` → a, b; `const k = "a"; k` → a; `"step_" + (1 + 2)` →
//! step_3; anything else → *.

use crate::{
  call_sites::Candidate,
  graph::{Graph, ModuleId},
  ir::{self, Kind, NodeId, Slot},
  scope::{binding_at, Binding, BindingKind, ValuesSource},
  syntax::unwrap_expression,
};

/// A text a computed key can have; when `dynamic`, each `*` in it stands for unknown text.
pub struct Key {
  pub text: String,
  pub dynamic: bool,
}

/// What a part of a key evaluates to. `+` adds numbers and joins texts; of an unknown value, it may do either.
#[derive(Clone, PartialEq)]
enum Operand {
  Text { text: String, dynamic: bool },
  Number(f64),
  Unknown,
}

const MAX_ALTERNATIVES: usize = 16;
const MAX_DEPTH: u32 = 32;

fn unknown() -> Vec<Operand> {
  vec![Operand::Unknown]
}

pub fn key_alternatives(graph: &Graph, module: ModuleId, expression: NodeId) -> Vec<Key> {
  let keys = operands_of(graph, module, expression, 0)
    .iter()
    .map(to_key)
    .collect();

  unique_by_text(keys)
}

fn operands_of(graph: &Graph, module: ModuleId, expression: NodeId, depth: u32) -> Vec<Operand> {
  if depth > MAX_DEPTH {
    return unknown();
  }

  let ast = &graph.module(module).ast;
  let node = unwrap_expression(ast, expression);
  let operands_of_part = |part: Option<NodeId>| match part {
    Some(part) => operands_of(graph, module, part, depth + 1),
    None => unknown(),
  };

  match ast.kind(node) {
    Kind::Literal => {
      if ast.has(node, ir::STRING) {
        vec![static_text(ast.text(node))]
      } else if ast.has(node, ir::NUMBER) {
        vec![Operand::Number(ast.numbers[ast.node(node).data as usize])]
      } else {
        unknown()
      }
    }

    // A template is a text, whatever its parts are: `` `step_${index + 1}` `` → step_*.
    Kind::TemplateLiteral => {
      let quasis: Vec<NodeId> = ast.children_in(node, Slot::Quasi).collect();
      let text_at = |index: usize| {
        let cooked = quasis
          .get(index)
          .map(|&quasi| ast.node(quasi).data)
          .filter(|&atom| atom != ir::NONE);
        vec![static_text(cooked.map_or("", |atom| ast.atom(atom)))]
      };

      let mut operands = text_at(0);
      for (index, part) in ast.children_in(node, Slot::Expression).enumerate() {
        operands = combine(&operands, &operands_of_part(Some(part)), join);
        operands = combine(&operands, &text_at(index + 1), join);
      }

      operands
    }

    Kind::BinaryExpression => {
      if ast.node(node).data != ir::OP_PLAIN {
        return unknown();
      }

      combine(
        &operands_of_part(ast.child(node, Slot::Left)),
        &operands_of_part(ast.child(node, Slot::Right)),
        sum,
      )
    }

    Kind::ConditionalExpression => union(
      operands_of_part(ast.child(node, Slot::Consequent)),
      operands_of_part(ast.child(node, Slot::Alternate)),
    ),

    Kind::LogicalExpression => union(
      operands_of_part(ast.child(node, Slot::Left)),
      operands_of_part(ast.child(node, Slot::Right)),
    ),

    Kind::Identifier => identifier_operands(graph, module, node, depth),

    _ => unknown(),
  }
}

/// The expressions a binding holds, each in its module.
fn expressions_of(graph: &Graph, binding: &Binding) -> Vec<(ModuleId, NodeId, bool)> {
  let expression = |candidate: &Candidate| match candidate {
    Candidate::Expression { module, node, path } => Some((*module, *node, !path.is_empty())),
    _ => None,
  };

  match &binding.kind {
    BindingKind::Values { source, .. } => match source {
      ValuesSource::Reassignable { writes } => writes
        .iter()
        .filter_map(|write| expression(&write.candidate))
        .collect(),
      source => crate::eval::candidates_of(graph, binding.owner, source, None)
        .iter()
        .filter_map(expression)
        .collect(),
    },

    BindingKind::Alias { init, path, .. } => match binding.alias_module(graph) {
      Some(scope) => vec![(scope, *init, !path.is_empty())],
      None => Vec::new(),
    },

    _ => Vec::new(),
  }
}

fn identifier_operands(
  graph: &Graph,
  module: ModuleId,
  identifier: NodeId,
  depth: u32,
) -> Vec<Operand> {
  let Some(binding) = binding_at(graph, graph.module(module), identifier) else {
    return unknown();
  };
  let held = expressions_of(graph, &binding);
  if held.is_empty() {
    return unknown();
  }

  let mut operands: Vec<Operand> = Vec::new();

  for (held_module, node, is_destructured) in held {
    if is_destructured {
      return unknown();
    }

    operands = union(operands, operands_of(graph, held_module, node, depth + 1));
  }

  operands
}

/// `1 + 2` → 3; `"step_" + index` → step_*; `index + 1` → *, not *1: an
/// unknown `index` may be a number.
fn sum(left: &Operand, right: &Operand) -> Operand {
  if let (Operand::Number(left), Operand::Number(right)) = (left, right) {
    return Operand::Number(left + right);
  }

  let joins_texts = matches!(left, Operand::Text { .. }) || matches!(right, Operand::Text { .. });

  if joins_texts {
    join(left, right)
  } else {
    Operand::Unknown
  }
}

fn join(left: &Operand, right: &Operand) -> Operand {
  let joined = text_of(left) + &text_of(right);

  // Unknown texts next to each other are one unknown text.
  let mut text = String::with_capacity(joined.len());
  for character in joined.chars() {
    if character == '*' && text.ends_with('*') {
      continue;
    }
    text.push(character);
  }

  Operand::Text {
    text,
    dynamic: is_dynamic(left) || is_dynamic(right),
  }
}

fn combine(
  left: &[Operand],
  right: &[Operand],
  operation: fn(&Operand, &Operand) -> Operand,
) -> Vec<Operand> {
  let mut operands = Vec::with_capacity(left.len() * right.len());
  for a in left {
    for b in right {
      operands.push(operation(a, b));
    }
  }

  if operands.len() > MAX_ALTERNATIVES {
    unknown()
  } else {
    unique(operands)
  }
}

fn union(mut left: Vec<Operand>, right: Vec<Operand>) -> Vec<Operand> {
  left.extend(right);
  let operands = unique(left);

  if operands.len() > MAX_ALTERNATIVES {
    unknown()
  } else {
    operands
  }
}

/// A number and a text are different operands, also when they read the same.
fn unique(operands: Vec<Operand>) -> Vec<Operand> {
  let mut kept: Vec<Operand> = Vec::with_capacity(operands.len());

  for operand in operands {
    let is_known = kept.iter().any(|known| {
      std::mem::discriminant(known) == std::mem::discriminant(&operand)
        && is_dynamic(known) == is_dynamic(&operand)
        && text_of(known) == text_of(&operand)
    });
    if !is_known {
      kept.push(operand);
    }
  }

  kept
}

fn static_text(text: &str) -> Operand {
  Operand::Text {
    text: text.to_string(),
    dynamic: false,
  }
}

fn text_of(operand: &Operand) -> String {
  match operand {
    Operand::Text { text, .. } => text.clone(),
    Operand::Number(value) => number_to_string(*value),
    Operand::Unknown => "*".to_string(),
  }
}

/// As JavaScript's `String(number)`.
fn number_to_string(value: f64) -> String {
  ryu_js::Buffer::new().format(value).to_string()
}

fn is_dynamic(operand: &Operand) -> bool {
  match operand {
    Operand::Text { dynamic, .. } => *dynamic,
    Operand::Number(_) => false,
    Operand::Unknown => true,
  }
}

fn to_key(operand: &Operand) -> Key {
  Key {
    text: text_of(operand),
    dynamic: is_dynamic(operand),
  }
}

/// A static key wins over a dynamic one with the same text.
fn unique_by_text(keys: Vec<Key>) -> Vec<Key> {
  let mut kept: Vec<Key> = Vec::with_capacity(keys.len());

  for key in keys {
    match kept.iter_mut().find(|known| known.text == key.text) {
      Some(existing) => {
        if existing.dynamic && !key.dynamic {
          *existing = key;
        }
      }
      None => kept.push(key),
    }
  }

  kept
}
