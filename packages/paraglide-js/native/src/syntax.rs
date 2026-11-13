use std::{borrow::Cow, sync::Arc};

use rustc_hash::{FxHashMap, FxHashSet};

use crate::ir::{self, Ast, Kind, NodeId, Slot};

pub type Path = Vec<Arc<str>>;

// ---------------------------------------------------------------- expressions

pub fn unwrap_expression(ast: &Ast, mut node: NodeId) -> NodeId {
  loop {
    match ast.kind(node) {
      Kind::ParenthesizedExpression
      | Kind::TSAsExpression
      | Kind::TSSatisfiesExpression
      | Kind::TSNonNullExpression
      | Kind::TSTypeAssertion
      | Kind::TSInstantiationExpression
      | Kind::ChainExpression => match ast.child(node, Slot::Expression) {
        Some(expression) => node = expression,
        None => return node,
      },
      _ => return node,
    }
  }
}

pub fn source_of(ast: &Ast, statement: NodeId) -> Option<&str> {
  static_string(ast, ast.child(statement, Slot::Source)?)
}

pub fn static_string(ast: &Ast, node: NodeId) -> Option<&str> {
  match ast.kind(node) {
    Kind::Literal if ast.has(node, ir::STRING) => Some(ast.text(node)),
    Kind::TemplateLiteral => {
      let has_expressions = ast.child(node, Slot::Expression).is_some();
      if has_expressions {
        return None;
      }

      let quasi = ast.child(node, Slot::Quasi)?;
      let cooked = ast.node(quasi).data;

      (cooked != ir::NONE).then(|| ast.atom(cooked))
    }
    _ => None,
  }
}

fn private_name(ast: &Ast, node: NodeId) -> Cow<'_, str> {
  Cow::Owned(format!("#{}", ast.text(node)))
}

pub fn static_property_name(ast: &Ast, member: NodeId) -> Option<Cow<'_, str>> {
  let property = ast.child(member, Slot::Property)?;

  if ast.has(member, ir::COMPUTED) {
    return static_string(ast, property).map(Cow::Borrowed);
  }

  match ast.kind(property) {
    Kind::PrivateIdentifier => Some(private_name(ast, property)),
    Kind::Identifier => Some(Cow::Borrowed(ast.text(property))),
    _ => None,
  }
}

/// Of a property, a class member or a pattern's property.
pub fn static_key_name(ast: &Ast, property: NodeId) -> Option<Cow<'_, str>> {
  let key = ast.child(property, Slot::Key)?;

  if ast.has(property, ir::COMPUTED) {
    return static_string(ast, key).map(Cow::Borrowed);
  }

  match ast.kind(key) {
    Kind::PrivateIdentifier => Some(private_name(ast, key)),
    Kind::Identifier => Some(Cow::Borrowed(ast.text(key))),
    _ => static_string(ast, key).map(Cow::Borrowed),
  }
}

/// `a` or `"a"` of an import or export specifier.
pub fn module_export_name(ast: &Ast, name: NodeId) -> &str {
  if ast.node(name).data == ir::NONE {
    return "";
  }

  ast.text(name)
}

pub fn nth_child(ast: &Ast, node: NodeId, slot: Slot, index: usize) -> Option<NodeId> {
  ast.children_in(node, slot).nth(index)
}

// ---------------------------------------------------------------- patterns

pub struct PatternBinding {
  pub node: NodeId,
  /// The properties leading to the name; `None` in an array or rest element.
  pub path: Option<Path>,
}

pub fn pattern_bindings(
  ast: &Ast,
  pattern: NodeId,
  path: Option<Path>,
  out: &mut Vec<PatternBinding>,
) {
  match ast.kind(pattern) {
    Kind::Identifier => out.push(PatternBinding {
      node: pattern,
      path,
    }),

    Kind::ObjectPattern => {
      for property in ast.children_in(pattern, Slot::Property) {
        if ast.kind(property) == Kind::RestElement {
          if let Some(argument) = ast.child(property, Slot::Argument) {
            pattern_bindings(ast, argument, None, out);
          }
          continue;
        }

        let Some(value) = ast.child(property, Slot::Value) else {
          continue;
        };
        let key = static_key_name(ast, property);

        let value_path = match (&path, key) {
          (Some(path), Some(key)) => {
            let mut value_path = path.clone();
            value_path.push(Arc::from(key.as_ref()));
            Some(value_path)
          }
          _ => None,
        };

        pattern_bindings(ast, value, value_path, out);
      }
    }

    Kind::ArrayPattern => {
      for element in ast.children_in(pattern, Slot::Element) {
        pattern_bindings(ast, element, None, out);
      }
    }

    Kind::AssignmentPattern => {
      if let Some(left) = ast.child(pattern, Slot::Left) {
        pattern_bindings(ast, left, path, out);
      }
    }

    Kind::RestElement => {
      if let Some(argument) = ast.child(pattern, Slot::Argument) {
        pattern_bindings(ast, argument, None, out);
      }
    }

    Kind::TSParameterProperty => {
      if let Some(parameter) = ast.child(pattern, Slot::Parameter) {
        pattern_bindings(ast, parameter, path, out);
      }
    }

    _ => {}
  }
}

/// How `pattern` binds `identifier`: None if it is not one of its names, else
/// the properties leading to it, `None` when they are not all known.
pub fn binding_path(ast: &Ast, pattern: NodeId, identifier: NodeId) -> Option<Option<Path>> {
  let is_inside = identifier >= pattern && identifier < ast.next(pattern);
  if !is_inside {
    return None;
  }

  let mut bindings = Vec::new();
  pattern_bindings(ast, pattern, Some(Vec::new()), &mut bindings);

  bindings
    .into_iter()
    .find(|binding| binding.node == identifier)
    .map(|binding| binding.path)
}

/// The properties leading from a pattern to a name it binds; `None` when they are not all known.
pub fn path_of(ast: &Ast, pattern: NodeId, identifier: NodeId) -> Option<Path> {
  binding_path(ast, pattern, identifier).flatten()
}

/// The names a declaration gives values to: `const { a, b } = …` → a, b.
pub fn declared_names<'a>(ast: &'a Ast, declaration: NodeId, out: &mut Vec<&'a str>) {
  match ast.kind(declaration) {
    Kind::VariableDeclaration => {
      for declarator in ast.children_in(declaration, Slot::Declaration) {
        let Some(id) = ast.child(declarator, Slot::Id) else {
          continue;
        };

        let mut bindings = Vec::new();
        pattern_bindings(ast, id, None, &mut bindings);
        out.extend(bindings.iter().map(|binding| ast.text(binding.node)));
      }
    }

    // `declare function f(): void`, as in a `.d.ts` file.
    Kind::FunctionDeclaration
    | Kind::TSDeclareFunction
    | Kind::ClassDeclaration
    | Kind::TSEnumDeclaration => {
      if let Some(id) = ast.child(declaration, Slot::Id) {
        out.push(ast.text(id));
      }
    }

    _ => {}
  }
}

// ---------------------------------------------------------------- statements

/// The specifier of a call of the global `require`, where `is_global` says whether an identifier is
/// a global.
pub fn require_specifier<'a>(
  ast: &'a Ast,
  call: NodeId,
  is_global: Option<&dyn Fn(NodeId) -> bool>,
) -> Option<&'a str> {
  let callee = unwrap_expression(ast, ast.child(call, Slot::Callee)?);
  if ast.kind(callee) != Kind::Identifier || ast.text(callee) != "require" {
    return None;
  }

  let is_shadowed = is_global.is_some_and(|is_global| !is_global(callee));
  if is_shadowed {
    return None;
  }

  static_string(ast, ast.child(call, Slot::Arg)?)
}

#[derive(Default)]
pub struct ModuleSyntax {
  /// The export statements by exported name, without the names of `export *`.
  pub exporting: FxHashMap<Box<str>, Vec<NodeId>>,
  pub has_esm_exports: bool,
  /// The `export * from "…"` statements of values, in order.
  pub star_exports: Vec<NodeId>,
}

impl ModuleSyntax {
  pub fn of(ast: &Ast) -> Self {
    let mut syntax = Self::default();

    for statement in ast.children(0) {
      let mut names: Vec<&str> = Vec::new();

      match ast.kind(statement) {
        Kind::ExportDefaultDeclaration => names.push("default"),

        // `export * as ns from "./a"`
        Kind::ExportAllDeclaration => match ast.child(statement, Slot::Exported) {
          Some(exported) => names.push(module_export_name(ast, exported)),
          None if !ast.has(statement, ir::TYPE_ONLY) => syntax.star_exports.push(statement),
          None => {}
        },

        Kind::ExportNamedDeclaration => {
          if let Some(declaration) = ast.child(statement, Slot::Declaration) {
            declared_names(ast, declaration, &mut names);
          }

          for specifier in ast.children_in(statement, Slot::Specifier) {
            if let Some(exported) = ast.child(specifier, Slot::Exported) {
              names.push(module_export_name(ast, exported));
            }
          }
        }

        _ => continue,
      }

      syntax.has_esm_exports = true;
      for name in names {
        syntax
          .exporting
          .entry(name.into())
          .or_default()
          .push(statement);
      }
    }

    syntax
  }
}

/// The specifiers of every module a program loads values from.
pub fn loaded_specifiers<'a>(ast: &'a Ast) -> Vec<Box<str>> {
  let mut specifiers: Vec<Box<str>> = Vec::new();
  let mut seen: FxHashSet<&'a str> = FxHashSet::default();
  let mut add = |specifier: Option<&'a str>| {
    if let Some(specifier) = specifier {
      if seen.insert(specifier) {
        specifiers.push(specifier.into());
      }
    }
  };

  let source_of = |node: NodeId| self::source_of(ast, node);

  let end = ast.nodes.len() as NodeId;
  let mut node = 0;

  while node < end {
    let is_type_only = ast.has(node, ir::TYPE_ONLY);
    let mut skips_children = false;

    match ast.kind(node) {
      Kind::ImportDeclaration | Kind::ExportAllDeclaration => {
        if !is_type_only {
          add(source_of(node));
        }
        skips_children = true;
      }

      Kind::ExportNamedDeclaration => {
        if !is_type_only {
          add(source_of(node));
        }
      }

      // `import a = require("./a")`
      Kind::TSImportEqualsDeclaration => {
        let external = ast
          .child(node, Slot::Reference)
          .filter(|&reference| ast.kind(reference) == Kind::TSExternalModuleReference);

        if let (false, Some(external)) = (is_type_only, external) {
          add(
            ast
              .child(external, Slot::Expression)
              .and_then(|value| static_string(ast, value)),
          );
        }
        skips_children = true;
      }

      Kind::ImportExpression => add(source_of(node)),
      Kind::CallExpression => add(require_specifier(ast, node, None)),
      _ => {}
    }

    node = if skips_children {
      ast.next(node)
    } else {
      node + 1
    };
  }

  specifiers
}

/// The name a specifier imports: "default" for `import a from`.
pub fn imported_name(ast: &Ast, specifier: NodeId) -> &str {
  if ast.kind(specifier) == Kind::ImportDefaultSpecifier {
    return "default";
  }

  match ast.child(specifier, Slot::Imported) {
    Some(imported) => module_export_name(ast, imported),
    None => "",
  }
}

/// Where a module imports the name `local` from; `None` for a namespace import.
pub fn import_of<'a>(ast: &'a Ast, local: &str) -> Option<(&'a str, &'a str)> {
  for statement in ast.children(0) {
    if ast.kind(statement) != Kind::ImportDeclaration {
      continue;
    }

    for specifier in ast.children_in(statement, Slot::Specifier) {
      let Some(local_name) = ast.child(specifier, Slot::Local) else {
        continue;
      };
      let is_namespace = ast.kind(specifier) == Kind::ImportNamespaceSpecifier;

      if ast.text(local_name) != local || is_namespace {
        continue;
      }

      let source = source_of(ast, statement)?;

      return Some((source, imported_name(ast, specifier)));
    }
  }

  None
}

/// Declared or exported at the top level of a module.
pub fn top_level_classes(ast: &Ast) -> Vec<NodeId> {
  let mut classes = Vec::new();

  for statement in ast.children(0) {
    let is_export = matches!(
      ast.kind(statement),
      Kind::ExportNamedDeclaration | Kind::ExportDefaultDeclaration
    );
    let declaration = if is_export {
      ast.child(statement, Slot::Declaration)
    } else {
      Some(statement)
    };

    if let Some(declaration) = declaration {
      if ast.kind(declaration).is_class() {
        classes.push(declaration);
      }
    }
  }

  classes
}

// ---------------------------------------------------------------- CommonJS

#[derive(Default)]
pub struct CommonJsExports {
  /// `module.exports = …`; the last one wins.
  pub whole: Option<NodeId>,
  /// `exports.x = …`, `Object.defineProperty(exports, "x", …)`
  pub named: FxHashMap<Box<str>, NodeId>,
  /// The modules it re-exports everything of: `__exportStar(require("./a"), exports)`.
  pub stars: Vec<NodeId>,
}

pub fn common_js_exports(ast: &Ast) -> Option<CommonJsExports> {
  let mut exports = CommonJsExports::default();

  for statement in ast.children(0) {
    if ast.kind(statement) != Kind::ExpressionStatement {
      continue;
    }

    let Some(expression) = ast.child(statement, Slot::Expression) else {
      continue;
    };
    let mut sequence = Vec::new();
    sequence_of(ast, expression, &mut sequence);

    for expression in sequence {
      read_export(ast, expression, &mut exports);
    }
  }

  let has_exports =
    exports.whole.is_some() || !exports.named.is_empty() || !exports.stars.is_empty();

  has_exports.then_some(exports)
}

/// `a, b` → a, b
fn sequence_of(ast: &Ast, expression: NodeId, out: &mut Vec<NodeId>) {
  let node = unwrap_expression(ast, expression);

  if ast.kind(node) == Kind::SequenceExpression {
    for part in ast.children_in(node, Slot::Expression) {
      sequence_of(ast, part, out);
    }
  } else {
    out.push(node);
  }
}

fn read_export(ast: &Ast, node: NodeId, exports: &mut CommonJsExports) {
  match ast.kind(node) {
    Kind::AssignmentExpression if ast.node(node).data == ir::OP_PLAIN => {
      read_assignment(ast, node, exports);
    }
    Kind::CallExpression => read_call(ast, node, exports),
    _ => {}
  }
}

enum ExportTarget<'a> {
  Whole,
  Named(Cow<'a, str>),
}

fn read_assignment(ast: &Ast, assignment: NodeId, exports: &mut CommonJsExports) {
  let (Some(left), Some(right)) = (
    ast.child(assignment, Slot::Left),
    ast.child(assignment, Slot::Right),
  ) else {
    return;
  };

  let target = export_target(ast, left);
  let value = unwrap_expression(ast, right);

  // TypeScript declares the names before it assigns them: `exports.b = exports.a = void 0`.
  let is_declaration_only = is_void(ast, value);

  match target {
    Some(ExportTarget::Whole) => exports.whole = Some(right),
    Some(ExportTarget::Named(name)) if !is_declaration_only => {
      exports.named.insert(name.as_ref().into(), right);
    }
    _ => {}
  }

  if ast.kind(value) == Kind::AssignmentExpression {
    read_export(ast, value, exports);
  }
}

fn read_call(ast: &Ast, call: NodeId, exports: &mut CommonJsExports) {
  let Some(callee) = ast.child(call, Slot::Callee) else {
    return;
  };
  let callee = unwrap_expression(ast, callee);
  let name = callee_name(ast, callee);
  let name = name.as_deref();

  let mut arguments = ast.children_in(call, Slot::Arg);
  let first = arguments.next();
  let second = arguments.next();
  let third = arguments.next();

  if let (Some("defineProperty"), Some(first)) = (name, first) {
    if is_exports_object(ast, first) {
      let key = second.and_then(|second| static_string(ast, second));
      let value = third.and_then(|third| property_descriptor_value(ast, third));

      if let (Some(key), Some(value)) = (key, value) {
        exports.named.insert(key.into(), value);
      }
      return;
    }
  }

  // TypeScript and tslib: `__exportStar(require("./a"), exports)`, `__export(require("./a"))`
  let is_export_star = matches!(name, Some("__exportStar" | "__export"));

  if let (true, Some(first)) = (is_export_star, first) {
    if ast.kind(first) != Kind::SpreadElement {
      exports.stars.push(first);
      return;
    }
  }

  if name == Some("forEach") && ast.kind(callee) == Kind::MemberExpression {
    if let Some(source) = babel_export_star_source(ast, callee, first) {
      exports.stars.push(source);
    }
  }
}

fn callee_name(ast: &Ast, callee: NodeId) -> Option<Cow<'_, str>> {
  match ast.kind(callee) {
    Kind::Identifier => Some(Cow::Borrowed(ast.text(callee))),
    Kind::MemberExpression => static_property_name(ast, callee),
    _ => None,
  }
}

/// `Object.keys(_a).forEach(function (key) { … exports[key] = _a[key] … })` → `_a`
fn babel_export_star_source(
  ast: &Ast,
  for_each: NodeId,
  callback: Option<NodeId>,
) -> Option<NodeId> {
  let keys = unwrap_expression(ast, ast.child(for_each, Slot::Object)?);
  if ast.kind(keys) != Kind::CallExpression {
    return None;
  }

  let keys_callee = ast.child(keys, Slot::Callee)?;
  let is_keys_call = ast.kind(keys_callee) == Kind::MemberExpression
    && static_property_name(ast, keys_callee).as_deref() == Some("keys");
  if !is_keys_call {
    return None;
  }

  let source = ast.child(keys, Slot::Arg)?;
  if ast.kind(source) == Kind::SpreadElement {
    return None;
  }

  let callback = callback?;
  let copies_to_exports = ast.kind(callback).is_function() && mentions_exports(ast, callback);

  copies_to_exports.then_some(source)
}

/// `module.exports` → whole; `exports.x`, `module.exports.x`, `exports["x"]` → "x"
fn export_target(ast: &Ast, target: NodeId) -> Option<ExportTarget<'_>> {
  if ast.kind(target) != Kind::MemberExpression {
    return None;
  }
  if is_module_exports(ast, target) {
    return Some(ExportTarget::Whole);
  }

  let object = ast.child(target, Slot::Object)?;

  if is_exports_object(ast, object) {
    static_property_name(ast, target).map(ExportTarget::Named)
  } else {
    None
  }
}

fn is_module_exports(ast: &Ast, node: NodeId) -> bool {
  let member = unwrap_expression(ast, node);
  if ast.kind(member) != Kind::MemberExpression
    || static_property_name(ast, member).as_deref() != Some("exports")
  {
    return false;
  }

  let Some(object) = ast.child(member, Slot::Object) else {
    return false;
  };
  let object = unwrap_expression(ast, object);

  ast.kind(object) == Kind::Identifier && ast.text(object) == "module"
}

fn is_exports_object(ast: &Ast, node: NodeId) -> bool {
  let target = unwrap_expression(ast, node);
  let is_exports_name = ast.kind(target) == Kind::Identifier && ast.text(target) == "exports";

  is_exports_name || is_module_exports(ast, target)
}

/// `{ get: function () { return a.x; } }`, `{ get: () => a.x }`, `{ value: a.x }` → `a.x`
fn property_descriptor_value(ast: &Ast, descriptor: NodeId) -> Option<NodeId> {
  let node = unwrap_expression(ast, descriptor);
  if ast.kind(node) != Kind::ObjectExpression {
    return None;
  }

  for property in ast.children_in(node, Slot::Property) {
    if ast.kind(property) != Kind::Property || ast.has(property, ir::COMPUTED) {
      continue;
    }

    let (Some(key), Some(value)) = (
      ast.child(property, Slot::Key),
      ast.child(property, Slot::Value),
    ) else {
      continue;
    };
    if ast.kind(key) != Kind::Identifier {
      continue;
    }

    match ast.text(key) {
      "value" => return Some(value),
      "get" if ast.kind(value).is_function() => {}
      _ => continue,
    }

    let Some(body) = ast.child(value, Slot::Body) else {
      continue;
    };

    return if ast.kind(body) == Kind::BlockStatement {
      returned_value(ast, body)
    } else {
      Some(body)
    };
  }

  None
}

fn returned_value(ast: &Ast, body: NodeId) -> Option<NodeId> {
  let returned = ast
    .children_in(body, Slot::Body)
    .find(|&statement| ast.kind(statement) == Kind::ReturnStatement)?;

  ast.child(returned, Slot::Argument)
}

fn mentions_exports(ast: &Ast, root: NodeId) -> bool {
  (root..ast.next(root))
    .any(|node| ast.kind(node) == Kind::Identifier && ast.text(node) == "exports")
}

fn is_void(ast: &Ast, node: NodeId) -> bool {
  ast.kind(node) == Kind::UnaryExpression && ast.node(node).data == ir::OP_PLAIN
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::lower::{lower, Lang};

  #[test]
  fn each_loaded_specifier_once_in_order_of_first_use() {
    let code = [
      "import a from './a';",
      "export * from './b';",
      "import type { T } from './types';",
      "const lazy = import('./a');",
      "const c = require('./c');",
      "export { x } from './b';",
      "import d = require('./d');",
    ]
    .join("\n");
    let Ok(ast) = lower(&code, Lang::Ts) else {
      panic!("not parsed");
    };

    let specifiers = loaded_specifiers(&ast);
    let specifiers: Vec<&str> = specifiers.iter().map(|specifier| &**specifier).collect();
    assert_eq!(specifiers, ["./a", "./b", "./c", "./d"]);
  }
}
