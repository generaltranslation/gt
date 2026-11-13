//! What an expression refers to: follows names through declarations, imports,
//! exports, call sites and props to the tracked values they hold.

use std::{hash::BuildHasher, sync::Arc};

use rustc_hash::{FxBuildHasher, FxHashMap, FxHashSet};

use crate::{
  call_sites::{argument_of, follow_candidate, omits_argument, Candidate},
  computed_keys::key_alternatives,
  graph::{FileId, Graph, Module, ModuleId, TargetKind},
  importers::{call_sites_of, component_props},
  ir::{self, Kind, NodeId, Slot},
  scope::{
    binding_at, binding_of, default_of, is_global, reads_props, writes_reaching, Binding,
    BindingKind, GuardKey, Lazy, ValuesSource,
  },
  symbols::{as_dynamic, Methods, Namespace, Symbol, Value},
  syntax::{
    common_js_exports, declared_names, module_export_name, nth_child, require_specifier,
    static_key_name, static_property_name, static_string, unwrap_expression,
  },
};

const MAX_DEPTH: u32 = 64;

/// More distinct values than this, e.g. of a helper called with every message, become one `*`.
const MAX_VALUES: usize = 16;

/// What a custom target's JavaScript says an export, or a member of one, is.
pub enum CustomSymbol {
  Value { name: String, methods: Vec<String> },
  Namespace,
}

/// The targets defined in JavaScript.
pub trait CustomTargets {
  /// `export` of `file`, then its members along `path`.
  fn symbol(
    &self,
    target: u32,
    file: &str,
    export: &str,
    path: &[Arc<str>],
  ) -> Option<CustomSymbol>;
}

/// One evaluation at a time: what is being resolved, so that cycles end. Each
/// is a stack: what is entered is left before what was entered before it.
pub struct Cx<'g> {
  pub g: &'g Graph,
  pub custom: Option<&'g dyn CustomTargets>,
  /// The bindings being resolved; its length is how deep the evaluation is.
  in_progress: Vec<GuardKey>,
  members_being_read: Vec<(ModuleId, NodeId, Box<str>)>,
  /// With the hash of each name: a chain of `export *` can be a thousand modules deep.
  exports_being_resolved: Vec<(FileId, u64, Box<str>)>,
  export_hashes_being_resolved: FxHashMap<(FileId, u64), u32>,
  /// What bindings hold, resolved with nothing else in progress: no cycle was cut short, so it holds every time.
  resolved: FxHashMap<GuardKey, Vec<Symbol>>,
}

fn to_list(symbol: Option<Symbol>) -> Vec<Symbol> {
  symbol.into_iter().collect()
}

impl<'g> Cx<'g> {
  pub fn new(graph: &'g Graph, custom: Option<&'g dyn CustomTargets>) -> Self {
    Self {
      g: graph,
      custom,
      in_progress: Vec::new(),
      members_being_read: Vec::new(),
      exports_being_resolved: Vec::new(),
      export_hashes_being_resolved: FxHashMap::default(),
      resolved: FxHashMap::default(),
    }
  }

  #[inline]
  fn module(&self, id: ModuleId) -> &'g Module {
    self.g.module(id)
  }

  // ---------------------------------------------------------------- names

  /// What a module-level name holds.
  pub fn lookup(&mut self, module: ModuleId, name: &str) -> Option<Symbol> {
    let binding = binding_of(self.g, self.module(module), name, None)?;

    self.resolve_binding(&binding, None).into_iter().next()
  }

  pub fn lookup_at(&mut self, module: ModuleId, identifier: NodeId) -> Option<Symbol> {
    self.lookup_all_at(module, identifier).into_iter().next()
  }

  /// Every value an identifier or JSX tag name may hold where it is.
  pub fn lookup_all_at(&mut self, module: ModuleId, identifier: NodeId) -> Vec<Symbol> {
    match binding_at(self.g, self.module(module), identifier) {
      Some(binding) => self.resolve_binding(&binding, Some(identifier)),
      None => Vec::new(),
    }
  }

  /// The class whose method or field initializer `node` is in.
  fn this_at(&mut self, module: ModuleId, node: NodeId) -> Option<Symbol> {
    let ast = &self.module(module).ast;
    let mut child = node;

    for parent in ast.ancestors(node) {
      let kind = ast.kind(parent);

      if kind == Kind::ArrowFunctionExpression {
        child = parent;
        continue;
      }

      if kind.is_function() {
        let owner = ast.parent(parent)?;

        return if ast.kind(owner) == Kind::MethodDefinition {
          self.class_of(module, owner)
        } else {
          None
        };
      }

      let is_field = matches!(kind, Kind::PropertyDefinition | Kind::AccessorProperty);
      let is_field_initializer = is_field && ast.slot(child) == Slot::Value;

      if is_field_initializer || kind == Kind::StaticBlock {
        return self.class_of(module, parent);
      }

      child = parent;
    }

    None
  }

  fn class_of(&mut self, module: ModuleId, member: NodeId) -> Option<Symbol> {
    let ast = &self.module(module).ast;
    let class_body = ast.parent(member)?;
    let class = ast.parent(class_body)?;

    ast.kind(class).is_class().then(|| {
      Symbol::namespace(Namespace::Class {
        module,
        node: class,
      })
    })
  }

  // ---------------------------------------------------------------- expressions

  /// What a node refers to; nothing if it is not tracked.
  pub fn evaluate(&mut self, module: ModuleId, expression: NodeId) -> Option<Symbol> {
    let ast = &self.module(module).ast;
    let node = unwrap_expression(ast, expression);

    match ast.kind(node) {
      Kind::Identifier => self.lookup_at(module, node),
      Kind::ThisExpression => self.this_at(module, node),
      Kind::MemberExpression => self.evaluate_member(module, node),
      Kind::ObjectExpression => Some(Symbol::namespace(Namespace::Object { module, node })),
      Kind::AwaitExpression => self.evaluate_await(module, node),
      Kind::CallExpression => self.evaluate_call(module, node),
      _ => None,
    }
  }

  /// Every value a node may refer to: `m[cond ? "a" : "b"]` refers to two
  /// messages. A key with unknown parts gives a `dynamic` value whose name is a
  /// pattern: `m[key]` → "*", `` m[`err_${code}`] `` → "err_*".
  pub fn evaluate_all(&mut self, module: ModuleId, expression: NodeId) -> Vec<Symbol> {
    let record = self.module(module);
    let ast = &record.ast;
    let node = unwrap_expression(ast, expression);

    if ast.kind(node) == Kind::Identifier {
      return self.lookup_all_at(module, node);
    }
    if reads_props(record, node) {
      return self.props_of(module);
    }
    if ast.kind(node) != Kind::MemberExpression {
      return to_list(self.evaluate(module, node));
    }

    let Some(object) = ast.child(node, Slot::Object) else {
      return Vec::new();
    };

    if let Some(name) = static_property_name(ast, node) {
      let objects = self.evaluate_all(module, object);
      let mut members = Vec::with_capacity(objects.len());

      for object in &objects {
        members.extend(self.member_of(Some(object), &name));
      }

      return distinct(members);
    }

    if ast.has(node, ir::COMPUTED) {
      let members = self.computed_members(module, node, object);
      return distinct(members);
    }

    Vec::new()
  }

  fn evaluate_member(&mut self, module: ModuleId, node: NodeId) -> Option<Symbol> {
    let record = self.module(module);
    let ast = &record.ast;

    if reads_props(record, node) {
      return self.props_of(module).into_iter().next();
    }

    let name = static_property_name(ast, node);
    if ast.has(node, ir::COMPUTED) && name.is_none() {
      return self.evaluate_all(module, node).into_iter().next();
    }

    let object = self.evaluate(module, ast.child(node, Slot::Object)?);

    self.member_of(object.as_ref(), &name?)
  }

  /// `await import("./messages.js")`
  fn evaluate_await(&mut self, module: ModuleId, node: NodeId) -> Option<Symbol> {
    let ast = &self.module(module).ast;
    let awaited = unwrap_expression(ast, ast.child(node, Slot::Argument)?);
    if ast.kind(awaited) != Kind::ImportExpression {
      return None;
    }

    let specifier = static_string(ast, ast.child(awaited, Slot::Source)?)?;

    self.host_namespace(module, specifier)
  }

  fn evaluate_call(&mut self, module: ModuleId, call: NodeId) -> Option<Symbol> {
    let record = self.module(module);
    let ast = &record.ast;

    if reads_props(record, call) {
      return self.props_of(module).into_iter().next();
    }

    let is_global_name = |identifier: NodeId| is_global(ast, identifier);
    if let Some(required) = require_specifier(ast, call, Some(&is_global_name)) {
      return self.host_namespace(module, required);
    }

    self.object_method_call(module, call)
  }

  /// `Object.assign({}, m)` merges its arguments; `Object.freeze(x)` and the like are `x`.
  fn object_method_call(&mut self, module: ModuleId, call: NodeId) -> Option<Symbol> {
    let ast = &self.module(module).ast;
    let callee = unwrap_expression(ast, ast.child(call, Slot::Callee)?);
    if ast.kind(callee) != Kind::MemberExpression {
      return None;
    }

    let object = unwrap_expression(ast, ast.child(callee, Slot::Object)?);
    let is_global_object = ast.kind(object) == Kind::Identifier
      && ast.text(object) == "Object"
      && is_global(ast, object);
    if !is_global_object {
      return None;
    }

    let method = static_property_name(ast, callee)?;

    match method.as_ref() {
      "freeze" | "seal" | "preventExtensions" => {
        let first = ast
          .children_in(call, Slot::Arg)
          .find(|&argument| ast.kind(argument) != Kind::SpreadElement)?;

        self.evaluate(module, first)
      }
      "assign" => Some(Symbol::namespace(Namespace::Assign { module, call })),
      _ => None,
    }
  }

  fn computed_members(&mut self, module: ModuleId, node: NodeId, object: NodeId) -> Vec<Symbol> {
    let ast = &self.module(module).ast;
    let mut members = Vec::new();
    let Some(property) = ast.child(node, Slot::Property) else {
      return members;
    };

    for object in self.evaluate_all(module, object) {
      if !matches!(object, Symbol::Namespace(_)) {
        continue;
      }

      for key in key_alternatives(self.g, module, property) {
        let Some(member) = self.member_of(Some(&object), &key.text) else {
          continue;
        };

        members.push(match &member {
          Symbol::Value(value) if key.dynamic => Symbol::Value(Arc::new(as_dynamic(value))),
          _ => member,
        });
      }
    }

    members
  }

  // ---------------------------------------------------------------- bindings

  /// Every value a binding may hold; `read` narrows a reassigned variable to the writes reaching it.
  pub fn resolve_binding(&mut self, binding: &Binding, read: Option<NodeId>) -> Vec<Symbol> {
    let is_top_level = self.in_progress.is_empty()
      && self.members_being_read.is_empty()
      && self.exports_being_resolved.is_empty();
    let key = match &binding.kind {
      // Narrowed by the read.
      BindingKind::Values {
        source: ValuesSource::Reassignable { .. },
        ..
      } if read.is_some() => None,
      BindingKind::Values { .. } | BindingKind::Alias { .. } | BindingKind::Lazy(_)
        if is_top_level =>
      {
        binding.guard.as_ref()
      }
      _ => None,
    };

    if let Some(symbols) = key.and_then(|key| self.resolved.get(key)) {
      return symbols.clone();
    }

    let symbols = self.resolve_binding_anew(binding, read);

    if let Some(key) = key {
      self.resolved.insert(key.clone(), symbols.clone());
    }

    symbols
  }

  fn resolve_binding_anew(&mut self, binding: &Binding, read: Option<NodeId>) -> Vec<Symbol> {
    match &binding.kind {
      BindingKind::Shadow => Vec::new(),
      BindingKind::Lazy(lazy) => to_list(self.resolve_lazy(binding.owner, lazy)),

      BindingKind::Values { source, .. } => {
        if !self.enter(binding.guard.as_ref()) {
          return Vec::new();
        }

        let candidates = candidates_of(self.g, binding.owner, source, read);
        let mut symbols = Vec::new();
        for candidate in &candidates {
          symbols.extend(self.evaluate_candidate(candidate));
        }

        self.leave();

        distinct(symbols)
      }

      BindingKind::Alias { init, path, .. } => {
        if !self.enter(binding.guard.as_ref()) {
          return Vec::new();
        }

        let mut symbols = Vec::new();
        if let Some(scope) = binding.alias_module(self.g) {
          for symbol in self.evaluate_all(scope, *init) {
            symbols.extend(self.follow_path(Some(symbol), path));
          }
        }

        self.leave();

        symbols
      }
    }
  }

  fn resolve_lazy(&mut self, owner: ModuleId, lazy: &Lazy) -> Option<Symbol> {
    match lazy {
      Lazy::Namespace { specifier } => self.host_namespace(owner, specifier),
      Lazy::Export { specifier, name } => self.host_export(owner, specifier, name),
      Lazy::DynamicImport { specifier, path } => {
        let namespace = self.host_namespace(owner, specifier);
        self.follow_path(namespace, path)
      }
      Lazy::Global(index) => {
        let global = &self.g.globals[*index as usize];

        if global.export_name == "*" {
          self.namespace_of(global.file)
        } else {
          self.export_of(global.file, &global.export_name)
        }
      }
      Lazy::ScopeObject => Some(Symbol::namespace(Namespace::ScopeObject { module: owner })),
    }
  }

  /// Every props object the module's component may be rendered with.
  fn props_of(&mut self, module: ModuleId) -> Vec<Symbol> {
    let record = self.module(module);
    if record.props.is_none() {
      return Vec::new();
    }

    if !self.enter(Some(&GuardKey::Props(module))) {
      return Vec::new();
    }

    let candidates = component_props(self.g, record);
    let mut symbols = Vec::new();
    for candidate in candidates.iter() {
      symbols.extend(self.evaluate_candidate(candidate));
    }

    self.leave();

    distinct(symbols)
  }

  fn evaluate_candidate(&mut self, candidate: &Candidate) -> Vec<Symbol> {
    match candidate {
      Candidate::Expression { module, node, path } => {
        let symbols = self.evaluate_all(*module, *node);
        if path.is_empty() {
          return symbols;
        }

        let mut followed = Vec::with_capacity(symbols.len());
        for symbol in symbols {
          followed.extend(self.follow_path(Some(symbol), path));
        }

        followed
      }

      // Every value: `show(m[cond ? "first" : "second"])` passes two messages.
      Candidate::Imported { module, node } => self.evaluate_all(*module, *node),

      Candidate::JsxProps { module, element } => vec![Symbol::namespace(Namespace::JsxProps {
        module: *module,
        element: *element,
      })],

      Candidate::Follow { candidate, path } => {
        let symbols = self.evaluate_candidate(candidate);
        let mut followed = Vec::with_capacity(symbols.len());
        for symbol in symbols {
          followed.extend(self.follow_path(Some(symbol), path));
        }

        followed
      }
    }
  }

  /// Ends cycles (`let a = b; b = a`) and bounds chains through call sites and
  /// assignments. Whether to go on; each entry is followed by a `leave`.
  fn enter(&mut self, key: Option<&GuardKey>) -> bool {
    let Some(key) = key else { return false };
    if self.in_progress.len() >= MAX_DEPTH as usize || self.in_progress.contains(key) {
      return false;
    }

    self.in_progress.push(key.clone());

    true
  }

  fn leave(&mut self) {
    self.in_progress.pop();
  }

  // ---------------------------------------------------------------- members

  pub fn follow_path(&mut self, symbol: Option<Symbol>, path: &[Arc<str>]) -> Option<Symbol> {
    let mut current = symbol;

    for name in path {
      current = self.member_of(current.as_ref(), name);
    }

    current
  }

  pub fn member_of(&mut self, symbol: Option<&Symbol>, name: &str) -> Option<Symbol> {
    match symbol? {
      Symbol::Value(_) => None,
      Symbol::Namespace(namespace) => self.namespace_member(namespace, name),
    }
  }

  fn namespace_member(&mut self, namespace: &Namespace, name: &str) -> Option<Symbol> {
    match namespace {
      Namespace::File(file) => self.export_of(*file, name),

      Namespace::Messages { target, file } => Some(Symbol::Value(Arc::new(Value {
        dynamic: false,
        target: *target,
        name: Arc::from(name),
        methods: Methods::Parts,
        file: *file,
      }))),

      Namespace::Custom {
        target,
        file,
        export,
        path,
      } => {
        let mut member_path = path.clone();
        member_path.push(Arc::from(name));

        self.custom_symbol(*target, *file, export.clone(), member_path)
      }

      Namespace::Object { module, node } => self.object_member(*module, *node, name),
      Namespace::Assign { module, call } => self.assign_member(*module, *call, name),
      Namespace::JsxProps { module, element } => self.jsx_props_member(*module, *element, name),
      Namespace::Class { module, node } => self.class_namespace_member(*module, *node, name),
      Namespace::ScopeObject { module } => self.lookup(*module, name),
    }
  }

  /// `{ title: m.title, ...m }`: later properties override earlier ones.
  fn object_member(&mut self, module: ModuleId, object: NodeId, name: &str) -> Option<Symbol> {
    let ast = &self.module(module).ast;
    let properties: Vec<NodeId> = ast.children_in(object, Slot::Property).collect();

    for &property in properties.iter().rev() {
      if ast.kind(property) == Kind::SpreadElement {
        let Some(argument) = ast.child(property, Slot::Argument) else {
          continue;
        };
        let spread = self.evaluate(module, argument);

        if let Some(member) = self.member_of(spread.as_ref(), name) {
          return Some(member);
        }
        continue;
      }

      let holds_value = !ast.has(property, ir::GETTER | ir::SETTER | ir::METHOD);
      if !holds_value || static_key_name(ast, property).as_deref() != Some(name) {
        continue;
      }

      return self.evaluate(module, ast.child(property, Slot::Value)?);
    }

    None
  }

  /// `Object.assign({}, m)`: later arguments override earlier ones.
  fn assign_member(&mut self, module: ModuleId, call: NodeId, name: &str) -> Option<Symbol> {
    let ast = &self.module(module).ast;
    let values: Vec<NodeId> = ast
      .children_in(call, Slot::Arg)
      .filter(|&argument| ast.kind(argument) != Kind::SpreadElement)
      .collect();

    for &value in values.iter().rev() {
      let object = self.evaluate(module, value);

      if let Some(member) = self.member_of(object.as_ref(), name) {
        return Some(member);
      }
    }

    None
  }

  /// `<Show msgs={m} {...rest} />`: later attributes override earlier ones.
  fn jsx_props_member(&mut self, module: ModuleId, element: NodeId, name: &str) -> Option<Symbol> {
    let ast = &self.module(module).ast;
    let attributes: Vec<NodeId> = ast.children_in(element, Slot::Attribute).collect();

    for &attribute in attributes.iter().rev() {
      if ast.kind(attribute) == Kind::JSXSpreadAttribute {
        let Some(argument) = ast.child(attribute, Slot::Argument) else {
          continue;
        };
        let spread = self.evaluate(module, argument);

        if let Some(member) = self.member_of(spread.as_ref(), name) {
          return Some(member);
        }
        continue;
      }

      let Some(expression) = jsx_attribute_expression(ast, attribute, name) else {
        continue;
      };

      return self.evaluate(module, expression);
    }

    None
  }

  /// A class's fields and getters: `label = m.title`, `get label() { return m.title }`.
  fn class_namespace_member(
    &mut self,
    module: ModuleId,
    class: NodeId,
    name: &str,
  ) -> Option<Symbol> {
    // `label = this.label` refers to itself.
    let is_being_read =
      self
        .members_being_read
        .iter()
        .any(|(read_module, read_class, read_name)| {
          *read_module == module && *read_class == class && &**read_name == name
        });
    if is_being_read {
      return None;
    }

    self
      .members_being_read
      .push((module, class, Box::from(name)));
    let member = self.class_member(module, class, name);
    self.members_being_read.pop();

    member
  }

  fn class_member(&mut self, module: ModuleId, class: NodeId, name: &str) -> Option<Symbol> {
    let ast = &self.module(module).ast;
    let body = ast.child(class, Slot::Body)?;

    let element = ast.children(body).find(|&candidate| {
      let is_field_or_method = matches!(
        ast.kind(candidate),
        Kind::PropertyDefinition | Kind::AccessorProperty | Kind::MethodDefinition
      );

      is_field_or_method && class_element_name(ast, candidate).as_deref() == Some(name)
    })?;

    if ast.kind(element) == Kind::MethodDefinition {
      if !ast.has(element, ir::GETTER) {
        return None;
      }

      // Of a getter that only returns: `get label() { return m.title }`.
      let function = ast.child(element, Slot::Value)?;
      let body = ast.child(function, Slot::Body)?;
      let mut statements = ast.children(body);
      let only_statement = statements.next().filter(|_| statements.next().is_none())?;
      if ast.kind(only_statement) != Kind::ReturnStatement {
        return None;
      }

      return self.evaluate(module, ast.child(only_statement, Slot::Argument)?);
    }

    self.evaluate(module, ast.child(element, Slot::Value)?)
  }

  // ---------------------------------------------------------------- modules

  fn host_namespace(&mut self, module: ModuleId, specifier: &str) -> Option<Symbol> {
    let file = self.module(module).resolved_file(specifier)?;

    self.namespace_of(file)
  }

  fn host_export(&mut self, module: ModuleId, specifier: &str, name: &str) -> Option<Symbol> {
    let file = self.module(module).resolved_file(specifier)?;

    self.export_of(file, name)
  }

  pub fn namespace_of(&mut self, file: FileId) -> Option<Symbol> {
    let is_known = self.g.target_of(file).is_some() || self.g.records.contains_key(&file);

    is_known.then(|| Symbol::namespace(Namespace::File(file)))
  }

  pub fn export_of(&mut self, file: FileId, name: &str) -> Option<Symbol> {
    if let Some(target) = self.g.target_of(file) {
      return self.target_export(target, file, name);
    }

    let record = self.g.record(file)?;
    let hash = FxBuildHasher.hash_one(name);
    let is_being_resolved = self
      .export_hashes_being_resolved
      .contains_key(&(file, hash))
      && self
        .exports_being_resolved
        .iter()
        .any(|(other_file, other_hash, other_name)| {
          *other_file == file && *other_hash == hash && &**other_name == name
        });
    if is_being_resolved {
      return None;
    }

    self
      .exports_being_resolved
      .push((file, hash, Box::from(name)));
    *self
      .export_hashes_being_resolved
      .entry((file, hash))
      .or_default() += 1;

    let symbol = self.local_export(record, name);

    self.exports_being_resolved.pop();
    if let Some(count) = self.export_hashes_being_resolved.get_mut(&(file, hash)) {
      *count -= 1;
      if *count == 0 {
        self.export_hashes_being_resolved.remove(&(file, hash));
      }
    }

    symbol
  }

  /// What a target says the export `name` of its file is.
  fn target_export(&mut self, target: u32, file: FileId, name: &str) -> Option<Symbol> {
    let value = |methods: Methods| {
      Some(Symbol::Value(Arc::new(Value {
        dynamic: false,
        target,
        name: Arc::from(name),
        methods,
        file,
      })))
    };

    match &self.g.options.targets[target as usize].kind {
      TargetKind::Messages => {
        let is_namespace = name == "m"
          && self
            .g
            .target_match(file)
            .is_some_and(|found| found.is_messages_module);

        if is_namespace {
          Some(Symbol::namespace(Namespace::Messages { target, file }))
        } else {
          value(Methods::Parts)
        }
      }
      TargetKind::Custom => self.custom_symbol(target, file, Arc::from(name), Vec::new()),
    }
  }

  fn custom_symbol(
    &mut self,
    target: u32,
    file: FileId,
    export: Arc<str>,
    path: Vec<Arc<str>>,
  ) -> Option<Symbol> {
    let custom = self.custom?;

    Some(
      match custom.symbol(target, self.g.file(file), &export, &path)? {
        CustomSymbol::Value { name, methods } => Symbol::Value(Arc::new(Value {
          dynamic: false,
          target,
          name: Arc::from(name),
          methods: if methods.is_empty() {
            Methods::None
          } else {
            Methods::Custom(methods.into_iter().map(String::into_boxed_str).collect())
          },
          file,
        })),
        CustomSymbol::Namespace => Symbol::namespace(Namespace::Custom {
          target,
          file,
          export,
          path,
        }),
      },
    )
  }

  fn local_export(&mut self, record: &'g Module, name: &str) -> Option<Symbol> {
    if let Some(statements) = record.syntax.exporting.get(name) {
      for &statement in statements {
        if let Some(found) = self.export_declared_by(record, statement, name) {
          return found;
        }
      }
    }

    if !record.syntax.has_esm_exports {
      return self.common_js_export(record, name);
    }

    // `export *` does not re-export "default".
    if name == "default" {
      return None;
    }

    for &statement in &record.syntax.star_exports {
      let Some(file) = resolved_source(record, statement) else {
        continue;
      };
      if !self.may_export(file, name) {
        continue;
      }

      if let Some(symbol) = self.export_of(file, name) {
        return Some(symbol);
      }
    }

    None
  }

  /// False only when `file` is known not to export `name`.
  fn may_export(&mut self, file: FileId, name: &str) -> bool {
    let graph = self.g;

    // A module without `export *` lists its names itself.
    if let Some(record) = graph.record(file) {
      let is_leaf = record.syntax.star_exports.is_empty() && graph.target_of(file).is_none();
      if is_leaf {
        return !record.syntax.has_esm_exports || record.syntax.exporting.contains_key(name);
      }
    }

    let names = match graph.cache.export_names.get(file as usize) {
      Some(names) => names
        .get_or_init(|| list_export_names(graph, file))
        .as_ref(),
      None => return list_export_names(graph, file).is_none_or(|names| names.contains(name)),
    };

    names.is_none_or(|names| names.contains(name))
  }

  /// The export `name`, if `statement` is the one that declares it. The inner
  /// `None` is an export that is not tracked.
  fn export_declared_by(
    &mut self,
    record: &'g Module,
    statement: NodeId,
    name: &str,
  ) -> Option<Option<Symbol>> {
    let ast = &record.ast;
    let module = record.id;

    match ast.kind(statement) {
      Kind::ExportDefaultDeclaration => {
        if name != "default" {
          return None;
        }

        let declaration = ast.child(statement, Slot::Declaration);
        Some(declaration.and_then(|declaration| self.evaluate(module, declaration)))
      }

      // `export * as name from "./a"`
      Kind::ExportAllDeclaration => {
        let exported = ast.child(statement, Slot::Exported)?;
        if ast.has(statement, ir::TYPE_ONLY) || module_export_name(ast, exported) != name {
          return None;
        }

        let file = resolved_source(record, statement)?;
        Some(self.namespace_of(file))
      }

      Kind::ExportNamedDeclaration => {
        if ast.has(statement, ir::TYPE_ONLY) {
          return None;
        }

        if let Some(declaration) = ast.child(statement, Slot::Declaration) {
          let mut declared = Vec::new();
          declared_names(ast, declaration, &mut declared);

          return declared.contains(&name).then(|| self.lookup(module, name));
        }

        let specifier = ast
          .children_in(statement, Slot::Specifier)
          .find(|&candidate| {
            !ast.has(candidate, ir::TYPE_ONLY)
              && ast
                .child(candidate, Slot::Exported)
                .is_some_and(|exported| module_export_name(ast, exported) == name)
          })?;
        let local = module_export_name(ast, ast.child(specifier, Slot::Local)?);

        if ast.child(statement, Slot::Source).is_none() {
          return Some(self.lookup(module, local));
        }

        let file = resolved_source(record, statement);
        Some(file.and_then(|file| self.export_of(file, local)))
      }

      _ => None,
    }
  }

  fn common_js_export(&mut self, record: &'g Module, name: &str) -> Option<Symbol> {
    let module = record.id;
    let exports = record
      .cache
      .commonjs
      .get_or_init(|| common_js_exports(&record.ast))
      .as_ref()?;

    if let Some(&named) = exports.named.get(name) {
      return self.evaluate(module, named);
    }

    if let Some(whole) = exports.whole {
      let whole = self.evaluate(module, whole);
      // `import x from "./cjs"` is the whole `module.exports`.
      if name == "default" {
        return whole;
      }

      if let Some(member) = self.member_of(whole.as_ref(), name) {
        return Some(member);
      }
    }

    if name == "default" {
      return None;
    }

    for &star in &exports.stars {
      let namespace = self.evaluate(module, star);

      if let Some(member) = self.member_of(namespace.as_ref(), name) {
        return Some(member);
      }
    }

    None
  }
}

/// A file's names are not listed when reaching them reads more modules than this,
/// e.g. at the start of a long chain of `export *`: each set would repeat the next one's.
const MAX_EXPORT_WALK: usize = 64;
const MAX_EXPORT_NAMES: usize = 4096;

/// The names a file exports. `None` when unknown: a target or a CommonJS module
/// is among its `export *`, or there are too many to list.
fn list_export_names(graph: &Graph, file: FileId) -> Option<FxHashSet<Box<str>>> {
  let mut names: FxHashSet<Box<str>> = FxHashSet::default();
  let mut seen: FxHashSet<FileId> = FxHashSet::default();
  seen.insert(file);
  // Grows while it is read.
  let mut modules = vec![file];
  let mut next = 0;

  while next < modules.len() {
    if next >= MAX_EXPORT_WALK || names.len() > MAX_EXPORT_NAMES {
      return None;
    }

    let module = modules[next];
    next += 1;

    if graph.target_of(module).is_some() {
      return None;
    }

    let Some(record) = graph.record(module) else {
      continue;
    };
    if !record.syntax.has_esm_exports {
      return None;
    }

    names.extend(record.syntax.exporting.keys().cloned());

    for &statement in &record.syntax.star_exports {
      if let Some(reexported) = resolved_source(record, statement) {
        if seen.insert(reexported) {
          modules.push(reexported);
        }
      }
    }
  }

  Some(names)
}

/// The file a statement's `from "…"` resolves to.
fn resolved_source(record: &Module, statement: NodeId) -> Option<FileId> {
  record.resolved_file(crate::syntax::source_of(&record.ast, statement)?)
}

/// What a values binding may hold; `read` narrows a reassigned variable to the writes reaching it.
pub fn candidates_of(
  graph: &Graph,
  owner: ModuleId,
  source: &ValuesSource,
  read: Option<NodeId>,
) -> Vec<Candidate> {
  let record = graph.module(owner);
  let passed_as = |name: &Arc<str>| {
    let path = [name.clone()];
    let props = props_candidates(graph, record);

    props
      .iter()
      .map(|candidate| follow_candidate(candidate.clone(), &path))
      .collect::<Vec<_>>()
  };

  match source {
    ValuesSource::Parameter {
      function,
      index,
      path,
    } => parameter_candidates(graph, record, *function, *index, path),

    ValuesSource::PropVariable { own, name } => {
      let mut candidates = own.clone();
      candidates.extend(passed_as(name));

      candidates
    }

    ValuesSource::Reassignable { writes } => match read {
      Some(read) => writes_reaching(&record.ast, writes, read)
        .into_iter()
        .map(|write| write.candidate.clone())
        .collect(),
      None => writes.iter().map(|write| write.candidate.clone()).collect(),
    },

    ValuesSource::UndeclaredProp { name } => passed_as(name),
  }
}

fn parameter_candidates(
  graph: &Graph,
  record: &Module,
  function: NodeId,
  index: usize,
  path: &[Arc<str>],
) -> Vec<Candidate> {
  let ast = &record.ast;
  let sites = call_sites_of(graph, record, function);
  let mut candidates = Vec::new();

  for site in sites.iter() {
    if let Some(argument) = argument_of(graph, site, index) {
      candidates.push(follow_candidate(argument, path));
    }
  }

  // `function show(t = m)` called as `show()` holds `m`.
  let default_value =
    nth_child(ast, function, Slot::Param, index).and_then(|parameter| default_of(ast, parameter));

  if let Some(default_value) = default_value {
    let is_default_used = sites.iter().any(|site| omits_argument(graph, site, index));

    if is_default_used {
      candidates.push(Candidate::Expression {
        module: record.id,
        node: default_value,
        path: path.to_vec(),
      });
    }
  }

  candidates
}

/// What each place that renders the module's component passes.
fn props_candidates<'g>(graph: &'g Graph, record: &'g Module) -> &'g [Candidate] {
  if record.props.is_none() {
    return &[];
  }

  component_props(graph, record)
}

/// The expression of the attribute `name={…}`.
fn jsx_attribute_expression(ast: &ir::Ast, attribute: NodeId, name: &str) -> Option<NodeId> {
  let attribute_name = ast.child(attribute, Slot::Name)?;
  if ast.kind(attribute_name) != Kind::JSXIdentifier || ast.text(attribute_name) != name {
    return None;
  }

  let value = ast.child(attribute, Slot::Value)?;
  if ast.kind(value) != Kind::JSXExpressionContainer {
    return None;
  }

  let expression = ast.child(value, Slot::Expression)?;

  (ast.kind(expression) != Kind::JSXEmptyExpression).then_some(expression)
}

fn class_element_name(ast: &ir::Ast, element: NodeId) -> Option<std::borrow::Cow<'_, str>> {
  let key = ast.child(element, Slot::Key)?;

  if ast.kind(key) == Kind::PrivateIdentifier {
    return Some(format!("#{}", ast.text(key)).into());
  }
  if ast.has(element, ir::COMPUTED) {
    return None;
  }

  if ast.kind(key) == Kind::Identifier {
    Some(ast.text(key).into())
  } else {
    static_string(ast, key).map(Into::into)
  }
}

/// One value per name and origin, the first found; namespaces as they are. Two
/// outdirs can define a message of the same name: those are two values.
fn distinct(symbols: Vec<Symbol>) -> Vec<Symbol> {
  if symbols.len() <= 1 {
    return symbols;
  }

  let mut values: Vec<Arc<Value>> = Vec::new();
  let mut namespaces: Vec<Arc<Namespace>> = Vec::new();
  let mut seen: FxHashSet<(u32, FileId, Arc<str>, bool)> = FxHashSet::default();

  for symbol in symbols {
    match symbol {
      Symbol::Namespace(namespace) => {
        if !namespaces
          .iter()
          .any(|known| Arc::ptr_eq(known, &namespace))
        {
          namespaces.push(namespace);
        }
      }
      Symbol::Value(value) => {
        let (target, origin) = value.origin();
        if seen.insert((target, origin, value.name.clone(), value.dynamic)) {
          values.push(value);
        }
      }
    }
  }

  let collapsed = if values.len() > MAX_VALUES {
    any_value_per_origin(&values)
  } else {
    values
  };
  namespaces.truncate(MAX_VALUES);

  collapsed
    .into_iter()
    .map(Symbol::Value)
    .chain(namespaces.into_iter().map(Symbol::Namespace))
    .collect()
}

fn any_value_per_origin(values: &[Arc<Value>]) -> Vec<Arc<Value>> {
  let mut by_origin: Vec<Arc<Value>> = Vec::new();

  for value in values {
    if by_origin
      .iter()
      .any(|known| known.origin() == value.origin())
    {
      continue;
    }

    by_origin.push(Arc::new(Value {
      name: Arc::from("*"),
      dynamic: true,
      ..(**value).clone()
    }));
  }

  by_origin
}
