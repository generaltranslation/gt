use std::sync::Arc;

use rustc_hash::FxHashMap;

use crate::{
  graph::{Graph, InstantiationSyntax, Module, ModuleId},
  ir::{self, Ast, Kind, NodeId, Slot},
  scope::{binding_at, is_global, AliasScope, BindingKind, Declaration, MAX_ALIAS_CHAIN},
  syntax::{nth_child, static_string, unwrap_expression, Path},
};

#[derive(Clone, Debug)]
pub enum Candidate {
  /// The values of `node`, then their members along `path`.
  Expression {
    module: ModuleId,
    node: NodeId,
    path: Path,
  },
  /// Every value of an argument of a call in another module than the callee, whose literals, unlike
  /// an expression's, do not narrow a computed key.
  Imported {
    module: ModuleId,
    node: NodeId,
  },
  JsxProps {
    module: ModuleId,
    element: NodeId,
  },
  /// The members along `path` of another candidate's values.
  Follow {
    candidate: Arc<Candidate>,
    path: Path,
  },
}

pub fn follow_candidate(candidate: Candidate, path: &[Arc<str>]) -> Candidate {
  if path.is_empty() {
    return candidate;
  }

  match candidate {
    Candidate::Expression {
      module,
      node,
      path: mut own,
    } => {
      own.extend_from_slice(path);
      Candidate::Expression {
        module,
        node,
        path: own,
      }
    }
    other => Candidate::Follow {
      candidate: Arc::new(other),
      path: path.to_vec(),
    },
  }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum SiteKind {
  /// A call or a `new`: `node` holds the arguments.
  Call,
  /// A JSX element: `node` is its opening element.
  Jsx,
}

#[derive(Clone, Copy, Debug)]
pub struct Site {
  pub kind: SiteKind,
  pub node: NodeId,
}

/// A call of a function or a JSX element of a component; `imported` when in another module than the callee.
#[derive(Clone, Copy, Debug)]
pub struct CallSite {
  pub module: ModuleId,
  pub site: Site,
  pub imported: bool,
}

#[derive(Default)]
pub struct CallSiteIndex {
  /// By the node that declares the callee: a function, or an import specifier.
  pub by_declaration: FxHashMap<Declaration, Vec<Site>>,
  /// `ns.f(…)` and `<ns.F />`: by the namespace import specifier, then by member name.
  pub by_namespace_member: FxHashMap<NodeId, FxHashMap<Box<str>, Vec<Site>>>,
}

pub fn call_sites_in<'g>(graph: &'g Graph, module: &'g Module) -> &'g CallSiteIndex {
  module.cache.call_sites.get_or_init(|| {
    let ast = &module.ast;
    let mut index = CallSiteIndex::default();

    for (id, node) in ast.nodes.iter().enumerate() {
      let id = id as NodeId;

      let (slot, kind) = match node.kind {
        Kind::CallExpression => (Slot::Callee, SiteKind::Call),
        Kind::JSXOpeningElement => (Slot::Name, SiteKind::Jsx),
        _ => continue,
      };

      if let Some(called) = ast.child(id, slot) {
        add_site(graph, module, &mut index, called, Site { kind, node: id });
      }
    }

    index
  })
}

/// The components a language tool's generated code renders with `new C(props)` or `C(props)`.
pub fn component_instances_in<'g>(
  graph: &'g Graph,
  module: &'g Module,
  syntax: InstantiationSyntax,
) -> &'g CallSiteIndex {
  let (cache, instantiation) = match syntax {
    InstantiationSyntax::New => (&module.cache.new_instances, Kind::NewExpression),
    InstantiationSyntax::Call => (&module.cache.call_instances, Kind::CallExpression),
  };

  cache.get_or_init(|| {
    let ast = &module.ast;
    let mut index = CallSiteIndex::default();

    for (id, node) in ast.nodes.iter().enumerate() {
      if node.kind != instantiation {
        continue;
      }

      let id = id as NodeId;
      let Some(callee) = ast.child(id, Slot::Callee) else {
        continue;
      };

      if let Some(component) = instantiated_component(graph, module, callee, 0) {
        add_site(
          graph,
          module,
          &mut index,
          component,
          Site {
            kind: SiteKind::Call,
            node: id,
          },
        );
      }
    }

    index
  })
}

fn add_site(graph: &Graph, module: &Module, index: &mut CallSiteIndex, callee: NodeId, site: Site) {
  let ast = &module.ast;
  let node = unwrap_expression(ast, callee);

  if matches!(ast.kind(node), Kind::Identifier | Kind::JSXIdentifier) {
    let declaration = binding_at(graph, module, node).and_then(|binding| binding.declaration);
    if let Some(declaration) = declaration {
      index
        .by_declaration
        .entry(declaration)
        .or_default()
        .push(site);
    }
    return;
  }

  if !matches!(
    ast.kind(node),
    Kind::MemberExpression | Kind::JSXMemberExpression
  ) {
    return;
  }

  let Some(member) = callee_member_name(ast, node) else {
    return;
  };
  let Some(object) = ast.child(node, Slot::Object) else {
    return;
  };
  let object = unwrap_expression(ast, object);
  if !matches!(ast.kind(object), Kind::Identifier | Kind::JSXIdentifier) {
    return;
  }

  let namespace = binding_at(graph, module, object).and_then(|binding| binding.declaration);
  let Some(Declaration::Node(namespace)) = namespace else {
    return;
  };
  if ast.kind(namespace) != Kind::ImportNamespaceSpecifier {
    return;
  }

  index
    .by_namespace_member
    .entry(namespace)
    .or_default()
    .entry(member.into())
    .or_default()
    .push(site);
}

fn callee_member_name(ast: &Ast, member: NodeId) -> Option<&str> {
  let property = ast.child(member, Slot::Property)?;

  if ast.kind(member) == Kind::JSXMemberExpression {
    return Some(ast.text(property));
  }
  if ast.has(member, ir::COMPUTED) {
    return static_string(ast, property);
  }

  (ast.kind(property) == Kind::Identifier).then(|| ast.text(property))
}

/// Generated code wraps and aliases the component it instantiates:
/// `const $$C = __sveltets_2_ensureComponent(Label)` (Svelte),
/// `const C = Label || Label` (Vue, for the opening and the closing tag).
fn instantiated_component(
  graph: &Graph,
  module: &Module,
  expression: NodeId,
  depth: u32,
) -> Option<NodeId> {
  if depth > MAX_ALIAS_CHAIN {
    return None;
  }

  let ast = &module.ast;
  let node = unwrap_expression(ast, expression);

  match ast.kind(node) {
    Kind::CallExpression => {
      let wrapped = ast.child(node, Slot::Arg)?;
      return instantiated_component(graph, module, wrapped, depth + 1);
    }
    Kind::LogicalExpression => {
      let left = ast.child(node, Slot::Left)?;
      return instantiated_component(graph, module, left, depth + 1);
    }
    Kind::Identifier => {}
    _ => return Some(node),
  }

  let local_alias = binding_at(graph, module, node).and_then(|binding| match &binding.kind {
    BindingKind::Alias {
      init,
      path,
      scope: AliasScope::Own,
      ..
    } if path.is_empty() => Some(*init),
    _ => None,
  });

  match local_alias {
    Some(init) => instantiated_component(graph, module, init, depth + 1),
    None => Some(node),
  }
}

/// `undefined` and `void 0`
fn is_undefined(ast: &Ast, expression: NodeId) -> bool {
  let node = unwrap_expression(ast, expression);

  match ast.kind(node) {
    Kind::UnaryExpression => ast.node(node).data == ir::OP_PLAIN,
    Kind::Identifier => ast.text(node) == "undefined" && is_global(ast, node),
    _ => false,
  }
}

/// What a call site passes as parameter `index`; a JSX element passes its props as the first.
pub fn argument_of(graph: &Graph, site: &CallSite, index: usize) -> Option<Candidate> {
  let CallSite {
    module,
    site: Site { kind, node },
    imported,
  } = *site;

  if kind == SiteKind::Jsx {
    return (index == 0).then_some(Candidate::JsxProps {
      module,
      element: node,
    });
  }

  let ast = &graph.module(module).ast;
  let mut arguments = ast.children_in(node, Slot::Arg);

  // A spread before it shifts the positions.
  for _ in 0..index {
    if ast.kind(arguments.next()?) == Kind::SpreadElement {
      return None;
    }
  }

  let argument = arguments.next()?;
  if ast.kind(argument) == Kind::SpreadElement {
    return None;
  }

  Some(if imported {
    Candidate::Imported {
      module,
      node: argument,
    }
  } else {
    Candidate::Expression {
      module,
      node: argument,
      path: Vec::new(),
    }
  })
}

/// Whether a call site passes nothing or `undefined` as parameter `index`, leaving it to its
/// default; a JSX element passes only its props.
pub fn omits_argument(graph: &Graph, site: &CallSite, index: usize) -> bool {
  if site.site.kind == SiteKind::Jsx {
    return index > 0;
  }

  let ast = &graph.module(site.module).ast;
  let node = site.site.node;

  // After a spread, what is passed where is unknown.
  let has_spread_up_to_index = ast
    .children_in(node, Slot::Arg)
    .take(index + 1)
    .any(|argument| ast.kind(argument) == Kind::SpreadElement);
  if has_spread_up_to_index {
    return false;
  }

  match nth_child(ast, node, Slot::Arg, index) {
    None => true,
    Some(argument) => is_undefined(ast, argument),
  }
}
