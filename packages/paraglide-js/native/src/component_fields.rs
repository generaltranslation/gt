//! The names a template can use without declaring them: the fields of its
//! component classes, e.g. Angular's `protected readonly m = m`. A file with
//! several components has several templates: each reads its own class.

use std::sync::Arc;

use rustc_hash::FxHashMap;

use crate::{
  graph::{ComponentFields, FileId, Graph, Module},
  ir::{self, Ast, Kind, NodeId, Slot},
  paths::basename,
  scope::{AliasScope, Binding, BindingKind, GuardKey},
  syntax::{static_string, top_level_classes},
};

/// The fields of the classes one `ComponentFields` names, and where they are readable.
pub struct FieldScope {
  /// In the template's file; `None` for the whole file.
  range: Option<(i32, i32)>,
  pub bindings: FxHashMap<Box<str>, Binding>,
}

impl FieldScope {
  /// Fields readable in a part of the file are names only where an identifier in it reads them.
  pub fn is_readable_at(&self, at_start: Option<i32>) -> bool {
    match (self.range, at_start) {
      (None, _) => true,
      (Some((start, end)), Some(at)) => start <= at && at < end,
      (Some(_), None) => false,
    }
  }
}

pub fn field_scopes<'g>(graph: &'g Graph, template: &'g Module) -> &'g [FieldScope] {
  template.cache.field_scopes.get_or_init(|| {
    template
      .component_fields
      .iter()
      .enumerate()
      .map(|(index, classes)| FieldScope {
        range: classes.range,
        bindings: field_bindings(graph, template, classes, index as u32),
      })
      .collect()
  })
}

/// Of several classes with a field of the same name, the first one's counts.
fn field_bindings(
  graph: &Graph,
  template: &Module,
  classes: &ComponentFields,
  scope_index: u32,
) -> FxHashMap<Box<str>, Binding> {
  let mut bindings = FxHashMap::default();

  let is_in_template_module = classes.specifier.is_empty();
  let declaring_file: Option<FileId> = if is_in_template_module {
    Some(template.file)
  } else {
    template
      .resolved
      .get(classes.specifier.as_str())
      .copied()
      .flatten()
  };
  let Some(declaring_file) = declaring_file else {
    return bindings;
  };
  let Some(declaring_module) = graph.record(declaring_file) else {
    return bindings;
  };

  let ast = &declaring_module.ast;
  let template_file_name = basename(graph.file(template.file));

  for class in component_classes(ast, classes.class_name.as_deref(), template_file_name) {
    for (name, value) in initialized_fields(ast, class) {
      if bindings.contains_key(name) {
        continue;
      }

      let name_key: Arc<str> = Arc::from(name);

      bindings.insert(
        name.into(),
        Binding {
          owner: template.id,
          kind: BindingKind::Alias {
            init: value,
            path: Vec::new(),
            scope: AliasScope::File(declaring_file),
          },
          declaration: None,
          guard: Some(GuardKey::Field(template.id, scope_index, name_key)),
        },
      );
    }
  }

  bindings
}

fn initialized_fields(ast: &Ast, class: NodeId) -> Vec<(&str, NodeId)> {
  let mut fields = Vec::new();
  let Some(body) = ast.child(class, Slot::Body) else {
    return fields;
  };

  for element in ast.children(body) {
    let is_field = matches!(
      ast.kind(element),
      Kind::PropertyDefinition | Kind::AccessorProperty
    );
    if !is_field || ast.has(element, ir::STATIC) || ast.has(element, ir::COMPUTED) {
      continue;
    }

    let (Some(key), Some(value)) = (
      ast.child(element, Slot::Key),
      ast.child(element, Slot::Value),
    ) else {
      continue;
    };
    if ast.kind(key) != Kind::Identifier {
      continue;
    }

    fields.push((ast.text(key), value));
  }

  fields
}

/// The classes named `class_name`. Without a name: the decorated classes,
/// preferring those whose `templateUrl` is the template's file.
fn component_classes(ast: &Ast, class_name: Option<&str>, template_file_name: &str) -> Vec<NodeId> {
  let classes = top_level_classes(ast);

  if let Some(class_name) = class_name {
    return classes
      .into_iter()
      .filter(|&class| {
        ast
          .child(class, Slot::Id)
          .is_some_and(|id| ast.text(id) == class_name)
      })
      .collect();
  }

  let decorated: Vec<NodeId> = classes
    .into_iter()
    .filter(|&class| ast.child(class, Slot::Decorator).is_some())
    .collect();

  let of_template: Vec<NodeId> = decorated
    .iter()
    .copied()
    .filter(|&class| {
      ast.children_in(class, Slot::Decorator).any(|decorator| {
        template_url_of(ast, decorator).is_some_and(|url| url.ends_with(template_file_name))
      })
    })
    .collect();

  if of_template.is_empty() {
    decorated
  } else {
    of_template
  }
}

/// `@Component({ templateUrl: "./a.html" })` → "./a.html"
fn template_url_of(ast: &Ast, decorator: NodeId) -> Option<&str> {
  let call = ast.child(decorator, Slot::Expression)?;
  if ast.kind(call) != Kind::CallExpression {
    return None;
  }

  let options = ast.child(call, Slot::Arg)?;
  if ast.kind(options) != Kind::ObjectExpression {
    return None;
  }

  for property in ast.children_in(options, Slot::Property) {
    let is_property = ast.kind(property) == Kind::Property && !ast.has(property, ir::COMPUTED);
    if !is_property {
      continue;
    }

    let Some(key) = ast.child(property, Slot::Key) else {
      continue;
    };
    let is_template_url = ast.kind(key) == Kind::Identifier && ast.text(key) == "templateUrl";

    if is_template_url {
      return static_string(ast, ast.child(property, Slot::Value)?);
    }
  }

  None
}
