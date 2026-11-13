use std::{borrow::Cow, sync::Arc};

use crate::{
  call_sites::Candidate,
  graph::{FileId, Graph, Module, ModuleId},
  ir::{self, Ast, DefinitionKind, Kind, NodeId, Slot},
  syntax::{
    binding_path, imported_name, nth_child, path_of, static_property_name, static_string,
    unwrap_expression, Path,
  },
};

pub const MAX_ALIAS_CHAIN: u32 = 8;

/// The node a binding's call sites are indexed under: a function or an import
/// specifier of the binding's module, or an auto-imported name.
#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
pub enum Declaration {
  Node(NodeId),
  Global(u32),
}

#[derive(Clone, PartialEq, Eq, Hash, Debug)]
pub enum GuardKey {
  Variable(ModuleId, u32),
  Field(ModuleId, u32, Arc<str>),
  UndeclaredProp(ModuleId, Arc<str>),
  Props(ModuleId),
}

#[derive(Clone, Debug)]
pub struct Write {
  pub candidate: Candidate,
  pub node: NodeId,
  /// Set when the write is a statement of its own, which always runs when its block does.
  pub statement: Option<NodeId>,
}

#[derive(Clone, Debug)]
pub enum Lazy {
  /// `import * as ns from "x"`, `import ns = require("x")`
  Namespace { specifier: Box<str> },
  /// `import { name } from "x"`
  Export { specifier: Box<str>, name: Box<str> },
  /// The parameter of `import("x").then((ns) => …)`.
  DynamicImport { specifier: Box<str>, path: Path },
  /// An auto-imported name.
  Global(u32),
  /// An object whose members are the module's names.
  ScopeObject,
}

#[derive(Clone, Debug)]
pub enum AliasScope {
  Own,
  /// The module of another file, if it is loaded: a component class's.
  File(FileId),
}

#[derive(Clone, Debug)]
pub enum ValuesSource {
  /// What the function's call sites pass.
  Parameter {
    function: NodeId,
    index: usize,
    path: Path,
  },
  /// Svelte 4's `export let message`: its own values, and the prop of its name.
  PropVariable { own: Vec<Candidate>, name: Arc<str> },
  /// A `let` or `var`: every value written to it.
  Reassignable { writes: Vec<Write> },
  /// A name the module does not declare, which is a prop of the component.
  UndeclaredProp { name: Arc<str> },
}

#[derive(Clone, Debug)]
pub enum BindingKind {
  Shadow,
  Lazy(Lazy),
  Alias {
    init: NodeId,
    path: Path,
    scope: AliasScope,
  },
  Values {
    source: ValuesSource,
    /// Holds what call sites pass: a parameter or a prop.
    parameter: bool,
  },
}

#[derive(Clone, Debug)]
pub struct Binding {
  pub owner: ModuleId,
  pub kind: BindingKind,
  pub declaration: Option<Declaration>,
  /// What tells it from the bindings being resolved, and the key its values are cached under.
  pub guard: Option<GuardKey>,
}

impl Binding {
  pub fn shadow(owner: ModuleId, declaration: Option<NodeId>) -> Binding {
    Binding {
      owner,
      kind: BindingKind::Shadow,
      declaration: declaration.map(Declaration::Node),
      guard: None,
    }
  }

  fn lazy(owner: ModuleId, lazy: Lazy, declaration: Option<Declaration>) -> Binding {
    Binding {
      owner,
      kind: BindingKind::Lazy(lazy),
      declaration,
      guard: None,
    }
  }

  pub fn global(owner: ModuleId, index: u32) -> Binding {
    Binding::lazy(owner, Lazy::Global(index), Some(Declaration::Global(index)))
  }

  pub fn scope_object(owner: ModuleId) -> Binding {
    Binding::lazy(owner, Lazy::ScopeObject, None)
  }

  pub fn undeclared_prop(owner: ModuleId, name: &str) -> Binding {
    let name: Arc<str> = Arc::from(name);

    Binding {
      owner,
      kind: BindingKind::Values {
        source: ValuesSource::UndeclaredProp { name: name.clone() },
        parameter: true,
      },
      declaration: None,
      guard: Some(GuardKey::UndeclaredProp(owner, name)),
    }
  }

  /// The module whose scope an alias's initializer is read in.
  pub fn alias_module(&self, graph: &Graph) -> Option<ModuleId> {
    match &self.kind {
      BindingKind::Alias {
        scope: AliasScope::Own,
        ..
      } => Some(self.owner),
      BindingKind::Alias {
        scope: AliasScope::File(file),
        ..
      } => graph.records.get(file).copied(),
      _ => None,
    }
  }
}

pub fn is_reference(ast: &Ast, identifier: NodeId) -> bool {
  matches!(ast.kind(identifier), Kind::Identifier | Kind::JSXIdentifier)
    && ast.has(identifier, ir::REFERENCE)
}

/// False for declarations, keys, labels and plain writes.
pub fn is_read(ast: &Ast, identifier: NodeId) -> bool {
  is_reference(ast, identifier) && ast.has(identifier, ir::READ)
}

/// An identifier's name; nothing for any other node.
pub fn name_of(ast: &Ast, node: NodeId) -> Option<&str> {
  let has_name = matches!(
    ast.kind(node),
    Kind::Identifier | Kind::JSXIdentifier | Kind::PrivateIdentifier
  );

  has_name.then(|| ast.text(node))
}

pub fn is_global(ast: &Ast, identifier: NodeId) -> bool {
  if is_reference(ast, identifier) {
    return ast.symbol(identifier) == ir::NONE;
  }

  name_of(ast, identifier).is_some_and(|name| ast.module_level(name).is_none())
}

pub fn enclosing_function(ast: &Ast, node: NodeId) -> Option<NodeId> {
  ast
    .ancestors(node)
    .find(|&ancestor| ast.kind(ancestor).is_function())
}

/// A compact form of a variable's binding, since a project has tens of millions of variables.
pub enum CachedBinding {
  Shadow {
    declaration: Option<NodeId>,
  },
  /// `const t = init`
  Const {
    init: NodeId,
    /// The function `init` declares.
    declaration: Option<NodeId>,
  },
  /// `function f(t)`: what call sites pass as the parameter at `index`.
  Parameter {
    function: NodeId,
    index: u32,
  },
  Other(Box<Binding>),
}

impl CachedBinding {
  fn of(binding: Binding, owner: ModuleId, variable: u32) -> CachedBinding {
    let is_own = binding.owner == owner;
    let is_guarded = binding.guard == Some(GuardKey::Variable(owner, variable));
    let declaration = match binding.declaration {
      None => Some(None),
      Some(Declaration::Node(node)) => Some(Some(node)),
      Some(Declaration::Global(_)) => None,
    };

    match (&binding.kind, declaration) {
      (BindingKind::Shadow, Some(declaration)) if is_own && binding.guard.is_none() => {
        CachedBinding::Shadow { declaration }
      }
      (
        BindingKind::Alias {
          init,
          path,
          scope: AliasScope::Own,
        },
        Some(declaration),
      ) if is_own && is_guarded && path.is_empty() => CachedBinding::Const {
        init: *init,
        declaration,
      },
      (
        BindingKind::Values {
          source:
            ValuesSource::Parameter {
              function,
              index,
              path,
            },
          parameter: true,
        },
        Some(None),
      ) if is_own && is_guarded && path.is_empty() && u32::try_from(*index).is_ok() => {
        CachedBinding::Parameter {
          function: *function,
          index: *index as u32,
        }
      }
      _ => CachedBinding::Other(Box::new(binding)),
    }
  }

  fn binding(&self, owner: ModuleId, variable: u32) -> BindingRef<'_> {
    let guard = || Some(GuardKey::Variable(owner, variable));

    match *self {
      CachedBinding::Shadow { declaration } => Cow::Owned(Binding::shadow(owner, declaration)),
      CachedBinding::Const { init, declaration } => Cow::Owned(Binding {
        owner,
        kind: BindingKind::Alias {
          init,
          path: Vec::new(),
          scope: AliasScope::Own,
        },
        declaration: declaration.map(Declaration::Node),
        guard: guard(),
      }),
      CachedBinding::Parameter { function, index } => Cow::Owned(Binding {
        owner,
        kind: BindingKind::Values {
          source: ValuesSource::Parameter {
            function,
            index: index as usize,
            path: Vec::new(),
          },
          parameter: true,
        },
        declaration: None,
        guard: guard(),
      }),
      CachedBinding::Other(ref binding) => Cow::Borrowed(binding),
    }
  }
}

pub fn binding_of_variable(module: &Module, variable: u32) -> BindingRef<'_> {
  let bindings = module.cache.bindings.get_or_init(|| {
    let mut bindings = Vec::with_capacity(module.ast.variables.len());
    bindings.resize_with(module.ast.variables.len(), Default::default);
    bindings
  });

  bindings[variable as usize]
    .get_or_init(|| CachedBinding::of(create_binding(module, variable), module.id, variable))
    .binding(module.id, variable)
}

fn create_binding(module: &Module, index: u32) -> Binding {
  let ast = &module.ast;
  let Some(definition) = ast.definitions(index).first() else {
    return Binding::shadow(module.id, None);
  };

  let mut binding = match definition.kind {
    DefinitionKind::ImportBinding => import_binding(module, definition.node),
    DefinitionKind::FunctionName => Binding::shadow(module.id, Some(definition.node)),
    DefinitionKind::Parameter => parameter_binding(module, index, definition.node, definition.name),
    DefinitionKind::Variable => {
      if is_prop_variable(module, definition.name) {
        prop_variable_binding(module, index)
      } else {
        variable_binding(module, index)
      }
    }
    DefinitionKind::Other => Binding::shadow(module.id, None),
  };

  // An import is never entered, so its guard is only the key its values are cached under, by
  // variable.
  if matches!(binding.kind, BindingKind::Lazy(_)) {
    binding.guard = Some(GuardKey::Variable(module.id, index));
  }

  binding
}

fn import_binding(module: &Module, node: NodeId) -> Binding {
  let ast = &module.ast;
  let shadow = Binding::shadow(module.id, None);

  if ast.kind(node) == Kind::TSImportEqualsDeclaration {
    let specifier = ast
      .child(node, Slot::Reference)
      .filter(|&reference| ast.kind(reference) == Kind::TSExternalModuleReference)
      .and_then(|reference| ast.child(reference, Slot::Expression))
      .and_then(|expression| static_string(ast, expression));

    return match specifier {
      Some(specifier) => Binding::lazy(
        module.id,
        Lazy::Namespace {
          specifier: specifier.into(),
        },
        None,
      ),
      None => shadow,
    };
  }

  let Some(declaration) = ast
    .parent(node)
    .filter(|&parent| ast.kind(parent) == Kind::ImportDeclaration)
  else {
    return shadow;
  };
  let Some(specifier) = crate::syntax::source_of(ast, declaration) else {
    return shadow;
  };

  let lazy = if ast.kind(node) == Kind::ImportNamespaceSpecifier {
    Lazy::Namespace {
      specifier: specifier.into(),
    }
  } else {
    Lazy::Export {
      specifier: specifier.into(),
      name: imported_name(ast, node).into(),
    }
  };

  Binding::lazy(module.id, lazy, Some(Declaration::Node(node)))
}

fn parameter_binding(
  module: &Module,
  variable: u32,
  function: NodeId,
  identifier: NodeId,
) -> Binding {
  let ast = &module.ast;
  let shadow = Binding::shadow(module.id, None);

  let found = ast
    .children_in(function, Slot::Param)
    .enumerate()
    .find_map(|(index, parameter)| {
      binding_path(ast, parameter, identifier).map(|path| (index, path))
    });
  let Some((index, Some(path))) = found else {
    return shadow;
  };

  let imported_specifier = if index == 0 {
    dynamic_import_of_callback(ast, function)
  } else {
    None
  };

  if let Some(specifier) = imported_specifier {
    let lazy = Lazy::DynamicImport {
      specifier: specifier.into(),
      path,
    };
    return Binding::lazy(module.id, lazy, None);
  }

  Binding {
    owner: module.id,
    kind: BindingKind::Values {
      source: ValuesSource::Parameter {
        function,
        index,
        path,
      },
      parameter: true,
    },
    declaration: None,
    guard: Some(GuardKey::Variable(module.id, variable)),
  }
}

/// Svelte 4's `export let message` is the prop `message`.
fn is_prop_variable(module: &Module, name: NodeId) -> bool {
  let declared_at = module.ast.node(name).start;

  module
    .props
    .as_ref()
    .is_some_and(|props| props.variables.contains(&declared_at))
}

fn prop_variable_binding(module: &Module, index: u32) -> Binding {
  let own = variable_binding(module, index);
  let variable = &module.ast.variables[index as usize];
  let own_values = match &own.kind {
    BindingKind::Values {
      source: ValuesSource::Reassignable { writes },
      ..
    } => writes.iter().map(|write| write.candidate.clone()).collect(),
    _ => Vec::new(),
  };

  Binding {
    owner: module.id,
    kind: BindingKind::Values {
      source: ValuesSource::PropVariable {
        own: own_values,
        name: Arc::from(module.ast.atom(variable.name)),
      },
      parameter: true,
    },
    declaration: None,
    guard: Some(GuardKey::Variable(module.id, index)),
  }
}

/// A `const` is its initializer; a `let` or `var` may hold any value written to it.
fn variable_binding(module: &Module, index: u32) -> Binding {
  let ast = &module.ast;
  let guard = Some(GuardKey::Variable(module.id, index));

  let mut initializations: Vec<Write> = Vec::new();
  let mut is_const = false;
  let mut declaration: Option<NodeId> = None;

  for definition in ast.definitions(index) {
    if definition.kind != DefinitionKind::Variable {
      continue;
    }

    let declarator = definition.node;
    let statement = definition.parent;
    is_const = ast.has(statement, ir::CONST);

    let init = ast.child(declarator, Slot::Init);
    let path = ast
      .child(declarator, Slot::Id)
      .and_then(|id| path_of(ast, id, definition.name));
    let (Some(init), Some(path)) = (init, path) else {
      continue;
    };

    if is_const {
      return Binding {
        owner: module.id,
        kind: BindingKind::Alias {
          init,
          path,
          scope: AliasScope::Own,
        },
        declaration: declared_function(ast, init).map(Declaration::Node),
        guard,
      };
    }

    declaration = declaration.or_else(|| declared_function(ast, init));
    initializations.push(Write {
      candidate: Candidate::Expression {
        module: module.id,
        node: init,
        path,
      },
      node: declarator,
      statement: Some(export_or_self(ast, statement)),
    });
  }

  if is_const {
    return Binding::shadow(module.id, None);
  }

  // `let { message } = $props()`
  let holds_props = initializations.iter().any(|write| match &write.candidate {
    Candidate::Expression { node, .. } => reads_props(module, *node),
    _ => false,
  });

  let mut writes = initializations;
  writes.extend(
    ast
      .assignments(index)
      .iter()
      .filter_map(|&identifier| assignment_to(module, identifier)),
  );

  Binding {
    owner: module.id,
    kind: BindingKind::Values {
      source: ValuesSource::Reassignable { writes },
      parameter: holds_props,
    },
    declaration: declaration.map(Declaration::Node),
    guard,
  }
}

/// `export let t = m` is a statement of its block, as `let t = m` is.
fn export_or_self(ast: &Ast, statement: NodeId) -> NodeId {
  match ast.parent(statement) {
    Some(parent) if ast.kind(parent) == Kind::ExportNamedDeclaration => parent,
    _ => statement,
  }
}

fn is_destructuring_part(kind: Kind) -> bool {
  matches!(
    kind,
    Kind::ObjectPattern
      | Kind::ArrayPattern
      | Kind::Property
      | Kind::AssignmentPattern
      | Kind::RestElement
  )
}

/// `t = m` and `({ t } = obj)`; `+=`, `++` and `for (t of …)` write nothing known.
fn assignment_to(module: &Module, identifier: NodeId) -> Option<Write> {
  let ast = &module.ast;
  let mut child = identifier;

  for parent in ast.ancestors(identifier) {
    if ast.kind(parent) != Kind::AssignmentExpression {
      if is_destructuring_part(ast.kind(parent)) {
        child = parent;
        continue;
      }
      return None;
    }

    let is_target = ast.slot(child) == Slot::Left;
    let path = if is_target {
      path_of(ast, child, identifier)
    } else {
      None
    };
    let is_plain = ast.node(parent).data == ir::OP_PLAIN;
    let (true, Some(path)) = (is_plain, path) else {
      return None;
    };

    let right = ast.child(parent, Slot::Right)?;
    let statement = ast.parent(parent).filter(|&statement| {
      ast.kind(statement) == Kind::ExpressionStatement && ast.slot(parent) == Slot::Expression
    });

    return Some(Write {
      candidate: Candidate::Expression {
        module: module.id,
        node: right,
        path,
      },
      node: parent,
      statement,
    });
  }

  None
}

/// The writes that may reach `read`: the last one that is a statement of a block around it in the
/// same function replaces the earlier ones (`let t = m; t = other; t.x()` holds `other`), and
/// without one every write counts.
pub fn writes_reaching<'a>(ast: &Ast, writes: &'a [Write], read: NodeId) -> Vec<&'a Write> {
  let Some(replacing) = last_replacing_write(ast, writes, read) else {
    return writes.iter().collect();
  };

  let first_position = ast.parsed_start(replacing.node);
  let read_position = ast.parsed_start(read);

  writes
    .iter()
    .filter(|write| {
      let position = ast.parsed_start(write.node);
      position >= first_position && position < read_position
    })
    .collect()
}

fn is_block(kind: Kind) -> bool {
  matches!(
    kind,
    Kind::Program | Kind::BlockStatement | Kind::StaticBlock
  )
}

fn last_replacing_write<'a>(ast: &Ast, writes: &'a [Write], read: NodeId) -> Option<&'a Write> {
  let read_position = ast.parsed_start(read);
  let read_function = enclosing_function(ast, read);
  let mut last: Option<&Write> = None;

  for write in writes {
    let is_before_read = ast.parsed_start(write.node) < read_position;
    let (Some(statement), true) = (write.statement, is_before_read) else {
      continue;
    };

    let always_runs_before_read = ast.parent(statement).is_some_and(|block| {
      is_block(ast.kind(block))
        && ast.parsed_start(block) <= read_position
        && read_position < ast.parsed_end(block)
        && enclosing_function(ast, statement) == read_function
    });
    if !always_runs_before_read {
      continue;
    }

    let is_latest =
      last.is_none_or(|last| ast.parsed_start(write.node) > ast.parsed_start(last.node));
    if is_latest {
      last = Some(write);
    }
  }

  last
}

/// `$props()`, `defineProps(…)`, `Astro.props`: whatever the module's language says.
pub fn reads_props(module: &Module, expression: NodeId) -> bool {
  let Some(reads) = &module.props else {
    return false;
  };
  let ast = &module.ast;
  let node = unwrap_expression(ast, expression);

  match ast.kind(node) {
    Kind::CallExpression => {
      let Some(callee) = ast.child(node, Slot::Callee) else {
        return false;
      };
      let callee = unwrap_expression(ast, callee);

      ast.kind(callee) == Kind::Identifier
        && reads.calls.iter().any(|call| call == ast.text(callee))
    }

    Kind::MemberExpression => {
      let Some(object) = ast.child(node, Slot::Object) else {
        return false;
      };
      let object = unwrap_expression(ast, object);
      let Some(property) = static_property_name(ast, node) else {
        return false;
      };
      if ast.kind(object) != Kind::Identifier {
        return false;
      }

      let object_name = ast.text(object);

      reads.members.iter().any(|member| {
        member.len() == object_name.len() + 1 + property.len()
          && member.starts_with(object_name)
          && member.as_bytes()[object_name.len()] == b'.'
          && member.ends_with(property.as_ref())
      })
    }

    _ => false,
  }
}

/// `m` of the parameter `t = m`, or of the constructor's `private t = m`.
pub fn default_of(ast: &Ast, parameter: NodeId) -> Option<NodeId> {
  let pattern = if ast.kind(parameter) == Kind::TSParameterProperty {
    ast.child(parameter, Slot::Parameter)?
  } else {
    parameter
  };

  if ast.kind(pattern) == Kind::AssignmentPattern {
    ast.child(pattern, Slot::Right)
  } else {
    None
  }
}

/// `const f = memo(forwardRef((props) => …))` declares the innermost function.
fn declared_function(ast: &Ast, init: NodeId) -> Option<NodeId> {
  let mut node = unwrap_expression(ast, init);

  while ast.kind(node) == Kind::CallExpression {
    node = ast
      .children_in(node, Slot::Arg)
      .map(|argument| unwrap_expression(ast, argument))
      .find(|&argument| {
        ast.kind(argument).is_function() || ast.kind(argument) == Kind::CallExpression
      })?;
  }

  ast.kind(node).is_function().then_some(node)
}

/// `import("x").then(callback)` → "x"
fn dynamic_import_of_callback(ast: &Ast, callback: NodeId) -> Option<&str> {
  let parent = ast.parent(callback)?;
  let is_first_argument = ast.kind(parent) == Kind::CallExpression
    && nth_child(ast, parent, Slot::Arg, 0) == Some(callback);
  if !is_first_argument {
    return None;
  }

  let callee = unwrap_expression(ast, ast.child(parent, Slot::Callee)?);
  let is_then = ast.kind(callee) == Kind::MemberExpression
    && static_property_name(ast, callee).as_deref() == Some("then");
  if !is_then {
    return None;
  }

  let promise = unwrap_expression(ast, ast.child(callee, Slot::Object)?);
  if ast.kind(promise) != Kind::ImportExpression {
    return None;
  }

  static_string(ast, ast.child(promise, Slot::Source)?)
}

pub type BindingRef<'g> = Cow<'g, Binding>;

/// What a module-level name holds, where `at` is the identifier that reads it, if one does.
pub fn binding_of<'g>(
  graph: &'g Graph,
  module: &'g Module,
  name: &str,
  at: Option<NodeId>,
) -> Option<BindingRef<'g>> {
  // `__VLS_ctx.title` reads the module's `title`, whatever the generated code declares `__VLS_ctx` as.
  if is_scope_object(module, name) {
    return Some(Cow::Owned(Binding::scope_object(module.id)));
  }

  match module.ast.module_level(name) {
    Some(variable) => Some(binding_of_variable(module, variable)),
    None => implicit_names(graph, module, name, at),
  }
}

pub fn binding_at<'g>(
  graph: &'g Graph,
  module: &'g Module,
  identifier: NodeId,
) -> Option<BindingRef<'g>> {
  let ast = &module.ast;

  if !is_reference(ast, identifier) {
    return binding_of(graph, module, name_of(ast, identifier)?, Some(identifier));
  }

  let variable = ast.symbol(identifier);
  if variable == ir::NONE {
    return implicit_names(graph, module, name_of(ast, identifier)?, Some(identifier));
  }

  let declared = &ast.variables[variable as usize];
  let has_scope_objects = !module.scope_objects.is_empty();
  if has_scope_objects
    && declared.is_module_level
    && is_scope_object(module, ast.atom(declared.name))
  {
    return Some(Cow::Owned(Binding::scope_object(module.id)));
  }

  Some(binding_of_variable(module, variable))
}

fn is_scope_object(module: &Module, name: &str) -> bool {
  module.scope_objects.iter().any(|object| object == name)
}

/// Names a module uses without declaring them: component fields, auto-imports, and a component's props.
fn implicit_names<'g>(
  graph: &'g Graph,
  module: &'g Module,
  name: &str,
  at: Option<NodeId>,
) -> Option<BindingRef<'g>> {
  if !module.component_fields.is_empty() {
    let at_start = at.map(|at| module.ast.node(at).start);

    for scope in crate::component_fields::field_scopes(graph, module) {
      if !scope.is_readable_at(at_start) {
        continue;
      }
      if let Some(binding) = scope.bindings.get(name) {
        return Some(Cow::Borrowed(binding));
      }
    }
  }

  if let Some(&global) = graph.globals_by_name.get(name) {
    return Some(Cow::Owned(Binding::global(module.id, global)));
  }

  // Vue's template reads `message` of `defineProps(["message"])` without declaring it.
  let has_undeclared_props = module.props.as_ref().is_some_and(|props| props.undeclared);

  has_undeclared_props.then(|| Cow::Owned(Binding::undeclared_prop(module.id, name)))
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::graph::{module_of, script_graph};

  const CODE: &str = r#"
    import { m } from "./paraglide/messages.js";
    import * as all from "./paraglide/messages.js";
    import def, { a as b } from "./other.js";
    import ns = require("./legacy.js");
    const alias = m.greeting;
    const called = make(() => m.a);
    const factory = function named() { return m.b; };
    const arrow = (x) => x;
    const { greeting, nested: { deep } } = m;
    const [first, ...rest] = [m.a, m.b];
    let later;
    later = m.c;
    let counted = 0;
    counted += 1;
    var reassigned = m.a, other = m.b;
    reassigned = other;
    for (const item of [m.a]) item();
    for (let index = 0; index < 2; index++) {}
    function f(plain, { field }, [element], withDefault = m.a, ...spread) {
      try { plain(); } catch (error) { error; }
      return [field, element, withDefault, spread];
    }
    import("./lazy.js").then((module) => module.x);
    import("./lazy.js").then(({ x }) => x);
    class Store { field = m.a; method(parameter) { return parameter; } }
    label: for (;;) break label;
    export const exported = m.greeting;
    export let exportedLet = m.a;
    { const inner = m.b; let innerLet; function hoisted(p) { return p; } }
  "#;

  #[test]
  fn kept_bindings_are_the_bindings_made() {
    let graph = script_graph("/app/src/a.ts", CODE.into());
    let module = module_of(&graph, "/app/src/a.ts");

    let mut kept = std::collections::BTreeMap::<&str, usize>::new();
    for variable in 0..module.ast.variables.len() as u32 {
      let made = format!("{:?}", create_binding(module, variable));
      // Twice: made, then kept.
      for _ in 0..2 {
        let binding = binding_of_variable(module, variable);
        assert_eq!(format!("{binding:?}"), made, "variable {variable}");
      }

      let cached = module
        .cache
        .bindings
        .get()
        .and_then(|bindings| bindings[variable as usize].get());
      let shape = match cached {
        Some(CachedBinding::Shadow { .. }) => "shadow",
        Some(CachedBinding::Const { .. }) => "const",
        Some(CachedBinding::Parameter { .. }) => "parameter",
        Some(CachedBinding::Other(_)) => "other",
        None => "none",
      };
      *kept.entry(shape).or_default() += 1;
    }

    for shape in ["shadow", "const", "parameter", "other"] {
      assert!(kept.get(shape).is_some_and(|&count| count > 0), "{kept:?}");
    }
  }
}
