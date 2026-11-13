//! What a name can refer to: a tracked value, e.g. a message, or an object whose members are looked up.

use std::sync::Arc;

use crate::{
  graph::{FileId, ModuleId},
  ir::NodeId,
};

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Methods {
  None,
  /// `.parts()` on messages.
  Parts,
  Custom(Arc<[Box<str>]>),
}

impl Methods {
  pub fn includes(&self, method: &str) -> bool {
    match self {
      Methods::None => false,
      Methods::Parts => method == "parts",
      Methods::Custom(methods) => methods.iter().any(|known| &**known == method),
    }
  }
}

#[derive(Clone, Debug)]
pub struct Value {
  /// `name` is a pattern where `*` stands for any text.
  pub dynamic: bool,
  /// The index of the target.
  pub target: u32,
  pub name: Arc<str>,
  pub methods: Methods,
  /// The target's file.
  pub file: FileId,
}

impl Value {
  /// The target and its file that a value comes from, e.g. an outdir's `messages.js`.
  pub fn origin(&self) -> (u32, FileId) {
    (self.target, self.file)
  }
}

#[derive(Debug)]
pub enum Namespace {
  /// A module's exports.
  File(FileId),
  /// The `m` of `messages.js`: every member is a message.
  Messages { target: u32, file: FileId },
  /// A namespace a custom target's JavaScript describes.
  Custom {
    target: u32,
    file: FileId,
    export: Arc<str>,
    path: Vec<Arc<str>>,
  },
  /// `{ title: m.title, ...m }`
  Object { module: ModuleId, node: NodeId },
  /// `Object.assign({}, m)`: the call.
  Assign { module: ModuleId, call: NodeId },
  /// The props of `<Show msgs={m} {...rest} />`: the opening element.
  JsxProps { module: ModuleId, element: NodeId },
  /// A class's fields and getters.
  Class { module: ModuleId, node: NodeId },
  /// An object whose members are the module's names, e.g. Vue's `__VLS_ctx`.
  ScopeObject { module: ModuleId },
}

#[derive(Clone, Debug)]
pub enum Symbol {
  Value(Arc<Value>),
  Namespace(Arc<Namespace>),
}

impl Symbol {
  pub fn namespace(namespace: Namespace) -> Symbol {
    Symbol::Namespace(Arc::new(namespace))
  }

  pub fn as_value(&self) -> Option<&Arc<Value>> {
    match self {
      Symbol::Value(value) => Some(value),
      Symbol::Namespace(_) => None,
    }
  }

  pub fn is_dynamic(&self) -> bool {
    matches!(self, Symbol::Value(value) if value.dynamic)
  }
}

pub fn as_dynamic(value: &Value) -> Value {
  Value {
    dynamic: true,
    ..value.clone()
  }
}
