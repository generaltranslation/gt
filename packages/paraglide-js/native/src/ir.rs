//! An ESTree-shaped syntax tree without types, whose nodes are in walk order so that a node's
//! descendants are the nodes after it, up to `next`.

pub type NodeId = u32;

/// No node, atom or symbol.
pub const NONE: u32 = u32::MAX;

/// The source position of code a language tool generated.
pub const UNMAPPED: i32 = -1;

#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
#[repr(u8)]
pub enum Kind {
  Program,
  ExpressionStatement,
  BlockStatement,
  EmptyStatement,
  DebuggerStatement,
  IfStatement,
  ForStatement,
  ForInStatement,
  ForOfStatement,
  WhileStatement,
  DoWhileStatement,
  ReturnStatement,
  ThrowStatement,
  TryStatement,
  CatchClause,
  SwitchStatement,
  SwitchCase,
  LabeledStatement,
  BreakStatement,
  ContinueStatement,
  WithStatement,
  VariableDeclaration,
  VariableDeclarator,
  FunctionDeclaration,
  FunctionExpression,
  ArrowFunctionExpression,
  TSDeclareFunction,
  TSEmptyBodyFunctionExpression,
  ClassDeclaration,
  ClassExpression,
  ClassBody,
  MethodDefinition,
  PropertyDefinition,
  AccessorProperty,
  TSAbstractMethodDefinition,
  TSAbstractPropertyDefinition,
  TSAbstractAccessorProperty,
  StaticBlock,
  TSIndexSignature,
  ImportDeclaration,
  ImportSpecifier,
  ImportDefaultSpecifier,
  ImportNamespaceSpecifier,
  ExportNamedDeclaration,
  ExportDefaultDeclaration,
  ExportAllDeclaration,
  ExportSpecifier,
  Identifier,
  Literal,
  TemplateLiteral,
  TemplateElement,
  TaggedTemplateExpression,
  ThisExpression,
  Super,
  ArrayExpression,
  ObjectExpression,
  Property,
  SpreadElement,
  MemberExpression,
  CallExpression,
  NewExpression,
  ImportExpression,
  MetaProperty,
  UnaryExpression,
  UpdateExpression,
  BinaryExpression,
  LogicalExpression,
  ConditionalExpression,
  AssignmentExpression,
  SequenceExpression,
  AwaitExpression,
  YieldExpression,
  ChainExpression,
  ParenthesizedExpression,
  PrivateIdentifier,
  V8IntrinsicExpression,
  ObjectPattern,
  ArrayPattern,
  AssignmentPattern,
  RestElement,
  TSParameterProperty,
  JSXElement,
  JSXFragment,
  JSXOpeningElement,
  JSXClosingElement,
  JSXOpeningFragment,
  JSXClosingFragment,
  JSXAttribute,
  JSXSpreadAttribute,
  JSXExpressionContainer,
  JSXEmptyExpression,
  JSXSpreadChild,
  JSXText,
  JSXIdentifier,
  JSXMemberExpression,
  JSXNamespacedName,
  TSAsExpression,
  TSSatisfiesExpression,
  TSTypeAssertion,
  TSNonNullExpression,
  TSInstantiationExpression,
  TSEnumDeclaration,
  TSEnumBody,
  TSEnumMember,
  TSModuleDeclaration,
  TSModuleBlock,
  TSImportEqualsDeclaration,
  TSExternalModuleReference,
  TSExportAssignment,
  TSNamespaceExportDeclaration,
  TSInterfaceDeclaration,
  TSTypeAliasDeclaration,
  /// A type where the tree has a value, e.g. the reference of `import a = b.c`.
  TSType,
  Decorator,
}

impl Kind {
  pub fn is_function(self) -> bool {
    matches!(
      self,
      Kind::FunctionDeclaration | Kind::FunctionExpression | Kind::ArrowFunctionExpression
    )
  }

  pub fn is_class(self) -> bool {
    matches!(self, Kind::ClassDeclaration | Kind::ClassExpression)
  }

  /// Expressions that wrap another without changing what it is: `(m as any)!`.
  pub fn is_transparent_wrapper(self) -> bool {
    matches!(
      self,
      Kind::ParenthesizedExpression
        | Kind::TSAsExpression
        | Kind::TSSatisfiesExpression
        | Kind::TSNonNullExpression
        | Kind::TSTypeAssertion
        | Kind::ChainExpression
    )
  }
}

/// The field of its parent that a node is, or is an item of.
#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
#[repr(u8)]
pub enum Slot {
  Root,
  Body,
  Expression,
  Test,
  Consequent,
  Alternate,
  Init,
  Update,
  Left,
  Right,
  Argument,
  Arg,
  Callee,
  Object,
  Property,
  Key,
  Value,
  Id,
  Param,
  Decorator,
  SuperClass,
  Element,
  Declaration,
  Specifier,
  Source,
  Local,
  Exported,
  Imported,
  Tag,
  Quasi,
  Block,
  Handler,
  Finalizer,
  Discriminant,
  Case,
  Opening,
  Closing,
  Child,
  Name,
  Attribute,
  Namespace,
  Member,
  Parameter,
  Reference,
  Options,
  /// TypeScript's `this` parameter: not one of the parameters that arguments are passed to.
  This,
}

// Flags, whose bits mean something different for each kind.
pub const COMPUTED: u16 = 1 << 0;
pub const STATIC: u16 = 1 << 1;
pub const METHOD: u16 = 1 << 2;
pub const SHORTHAND: u16 = 1 << 3;
/// `kind: "get"` of a property or method.
pub const GETTER: u16 = 1 << 4;
pub const SETTER: u16 = 1 << 5;
pub const CONSTRUCTOR: u16 = 1 << 6;
/// `importKind` or `exportKind` is "type".
pub const TYPE_ONLY: u16 = 1 << 7;
/// An arrow function whose body is an expression.
pub const EXPRESSION_BODY: u16 = 1 << 8;

// Of an identifier.
/// The identifier refers to a variable, or to a global.
pub const REFERENCE: u16 = 1 << 0;
pub const READ: u16 = 1 << 1;
pub const WRITE: u16 = 1 << 2;

// Of a literal.
pub const STRING: u16 = 1 << 0;
pub const NUMBER: u16 = 1 << 1;

// Of a variable declaration.
pub const CONST: u16 = 1 << 0;

// Operators, in `data`.
pub const OP_OTHER: u32 = 0;
/// `=`, `+` or `void`, by the node's kind.
pub const OP_PLAIN: u32 = 1;

/// Of any node: `next` holds the identifier's variable, and the node after it is the next one.
pub const SYMBOL_IN_NEXT: u16 = 1 << 9;

/// The bits of `Node::bits` that hold flags, with the node's length above them.
const FLAG_BITS: u16 = (1 << 10) - 1;
const LENGTH_SHIFT: u16 = 10;
/// The length of a node at least this long is in `Ast::long_ends`.
const LONG: u16 = u16::MAX >> LENGTH_SHIFT;

#[derive(Clone, Copy, Debug)]
pub struct Node {
  pub kind: Kind,
  pub slot: Slot,
  /// The flags and, above them, the node's length up to `LONG`, so where it ends is read with
  /// `Ast::end`.
  bits: u16,
  /// In the source file, UTF-16; `UNMAPPED` for generated-only code.
  pub start: i32,
  pub parent: NodeId,
  /// The node after this one's last descendant, or with `SYMBOL_IN_NEXT` an identifier's variable,
  /// so it is read with `Ast::next`.
  pub next: NodeId,
  /// An atom (a name or a string value), a number's index, or an operator.
  pub data: u32,
}

impl Node {
  /// A node that ends where it starts: see `set_end`.
  pub fn new(kind: Kind, slot: Slot, start: i32, parent: NodeId, next: NodeId, data: u32) -> Node {
    Node {
      kind,
      slot,
      bits: 0,
      start,
      parent,
      next,
      data,
    }
  }

  #[inline]
  pub fn flags(&self) -> u16 {
    self.bits & FLAG_BITS
  }

  #[inline]
  pub fn has(&self, flag: u16) -> bool {
    self.bits & flag & FLAG_BITS != 0
  }

  #[inline]
  pub fn add_flags(&mut self, flags: u16) {
    self.bits |= flags & FLAG_BITS;
  }

  #[inline]
  pub fn remove_flags(&mut self, flags: u16) {
    self.bits &= !(flags & FLAG_BITS);
  }

  /// Must be called in node order, since an end too long for the node's bits is appended to
  /// `long_ends`, which is searched by node.
  pub fn set_end(&mut self, id: NodeId, end: i32, long_ends: &mut Vec<(NodeId, i32)>) {
    let length = i64::from(end) - i64::from(self.start);
    let length = match u16::try_from(length) {
      Ok(length) if length < LONG => length,
      _ => {
        debug_assert!(long_ends.last().is_none_or(|&(last, _)| last < id));
        long_ends.push((id, end));
        LONG
      }
    };

    self.bits = (self.bits & FLAG_BITS) | (length << LENGTH_SHIFT);
  }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum DefinitionKind {
  ImportBinding,
  FunctionName,
  Parameter,
  Variable,
  /// A class, a catch parameter, an enum, a namespace: tracked as nothing.
  Other,
}

#[derive(Clone, Copy, Debug)]
pub struct Definition {
  pub kind: DefinitionKind,
  /// The import specifier, the function or the declarator.
  pub node: NodeId,
  pub name: NodeId,
  /// The `VariableDeclaration` or `ImportDeclaration`.
  pub parent: NodeId,
}

#[derive(Clone, Copy, Debug, Default)]
pub struct Variable {
  pub name: u32,
  pub is_module_level: bool,
  /// Where its definitions are in `Ast::definitions`, none for a type.
  definitions: (u32, u32),
  assignments: (u32, u32),
}

#[derive(Default)]
pub struct Ast {
  pub nodes: Vec<Node>,
  /// Where each node starts in the parsed code, where it differs from the node's.
  pub parsed: Option<Vec<u32>>,
  /// Where each node too long for its bits ends, by node.
  pub long_ends: Vec<(NodeId, i32)>,
  pub atom_text: String,
  pub atom_spans: Vec<(u32, u32)>,
  pub numbers: Vec<f64>,
  pub variables: Vec<Variable>,
  /// Every variable's definitions, a variable's own next to each other.
  definitions: Vec<Definition>,
  /// Every variable's assigned identifiers, without initializations.
  assignments: Vec<NodeId>,
  /// The module-level variables with the hash of their names, in the order of the hashes.
  module_level: Vec<(u32, u32)>,
  /// The variable of each identifier that has children (a parameter's decorators), by node.
  pub symbols_of_parents: Vec<(NodeId, u32)>,
}

fn name_hash(name: &str) -> u32 {
  use std::hash::BuildHasher;

  rustc_hash::FxBuildHasher.hash_one(name) as u32
}

impl Ast {
  /// Groups what was found for each variable while the tree was written, in the order it was found.
  pub fn set_variables(
    &mut self,
    mut variables: Vec<Variable>,
    mut definitions: Vec<(u32, Definition)>,
    mut assignments: Vec<(u32, NodeId)>,
  ) {
    definitions.sort_by_key(|&(variable, _)| variable);
    assignments.sort_by_key(|&(variable, _)| variable);

    fn set_ranges(
      variables: &mut [Variable],
      sorted: impl Iterator<Item = u32>,
      range_of: impl Fn(&mut Variable) -> &mut (u32, u32),
    ) {
      for (index, variable) in sorted.enumerate() {
        let range = range_of(&mut variables[variable as usize]);
        if range.1 == 0 {
          range.0 = index as u32;
        }
        range.1 += 1;
      }
    }
    set_ranges(
      &mut variables,
      definitions.iter().map(|&(variable, _)| variable),
      |variable| &mut variable.definitions,
    );
    set_ranges(
      &mut variables,
      assignments.iter().map(|&(variable, _)| variable),
      |variable| &mut variable.assignments,
    );

    let mut module_level: Vec<(u32, u32)> = (0..variables.len() as u32)
      .filter(|&variable| variables[variable as usize].is_module_level)
      .map(|variable| {
        let name = self.atom(variables[variable as usize].name);
        (name_hash(name), variable)
      })
      .collect();
    module_level.sort_unstable();

    // Copies of the exact size, without spare capacity.
    self.variables = variables.as_slice().to_vec();
    self.definitions = definitions
      .into_iter()
      .map(|(_, definition)| definition)
      .collect();
    self.assignments = assignments
      .into_iter()
      .map(|(_, identifier)| identifier)
      .collect();
    self.module_level = module_level.as_slice().to_vec();
  }

  /// A variable's definitions; none for a type.
  pub fn definitions(&self, variable: u32) -> &[Definition] {
    let (start, length) = self.variables[variable as usize].definitions;

    &self.definitions[start as usize..(start + length) as usize]
  }

  /// A variable's assigned identifiers, without initializations.
  pub fn assignments(&self, variable: u32) -> &[NodeId] {
    let (start, length) = self.variables[variable as usize].assignments;

    &self.assignments[start as usize..(start + length) as usize]
  }

  pub fn module_level(&self, name: &str) -> Option<u32> {
    let hash = name_hash(name);
    let first = self
      .module_level
      .partition_point(|&(other, _)| other < hash);

    self.module_level[first..]
      .iter()
      .take_while(|&&(other, _)| other == hash)
      .map(|&(_, variable)| variable)
      .find(|&variable| self.atom(self.variables[variable as usize].name) == name)
  }

  #[inline]
  pub fn node(&self, id: NodeId) -> &Node {
    &self.nodes[id as usize]
  }

  #[inline]
  pub fn kind(&self, id: NodeId) -> Kind {
    self.nodes[id as usize].kind
  }

  #[inline]
  pub fn slot(&self, id: NodeId) -> Slot {
    self.nodes[id as usize].slot
  }

  #[inline]
  pub fn flags(&self, id: NodeId) -> u16 {
    self.nodes[id as usize].flags()
  }

  #[inline]
  pub fn has(&self, id: NodeId, flag: u16) -> bool {
    self.nodes[id as usize].has(flag)
  }

  #[inline]
  pub fn parent(&self, id: NodeId) -> Option<NodeId> {
    let parent = self.nodes[id as usize].parent;
    (parent != NONE).then_some(parent)
  }

  #[inline]
  pub fn atom(&self, atom: u32) -> &str {
    let (start, end) = self.atom_spans[atom as usize];
    &self.atom_text[start as usize..end as usize]
  }

  /// The name of an identifier, or the value of a string literal.
  #[inline]
  pub fn text(&self, id: NodeId) -> &str {
    self.atom(self.nodes[id as usize].data)
  }

  /// The node after a node's last descendant.
  #[inline]
  pub fn next(&self, id: NodeId) -> NodeId {
    let node = &self.nodes[id as usize];

    if node.has(SYMBOL_IN_NEXT) {
      id + 1
    } else {
      node.next
    }
  }

  /// An identifier's variable; `NONE` for a global or a name that is not a reference.
  #[inline]
  pub fn symbol(&self, id: NodeId) -> u32 {
    let node = &self.nodes[id as usize];

    if node.has(SYMBOL_IN_NEXT) {
      return node.next;
    }
    if self.symbols_of_parents.is_empty() {
      return NONE;
    }

    match self
      .symbols_of_parents
      .binary_search_by_key(&id, |&(node, _)| node)
    {
      Ok(index) => self.symbols_of_parents[index].1,
      Err(_) => NONE,
    }
  }

  pub fn children(&self, id: NodeId) -> Children<'_> {
    Children {
      ast: self,
      current: id + 1,
      end: self.next(id),
    }
  }

  /// The first child in `slot`.
  pub fn child(&self, id: NodeId, slot: Slot) -> Option<NodeId> {
    self.children(id).find(|&child| self.slot(child) == slot)
  }

  pub fn children_in(&self, id: NodeId, slot: Slot) -> impl Iterator<Item = NodeId> + '_ {
    self
      .children(id)
      .filter(move |&child| self.slot(child) == slot)
  }

  /// A node and its ancestors, innermost first.
  pub fn ancestors(&self, id: NodeId) -> Ancestors<'_> {
    Ancestors {
      ast: self,
      current: self.nodes[id as usize].parent,
    }
  }

  /// The node's position in the parsed code: generated code keeps it apart from its position in the file.
  #[inline]
  pub fn parsed_start(&self, id: NodeId) -> u32 {
    match &self.parsed {
      Some(parsed) => parsed[id as usize],
      None => self.nodes[id as usize].start as u32,
    }
  }

  /// Where a node ends, in the source file as `start` is.
  #[inline]
  pub fn end(&self, id: NodeId) -> i32 {
    let node = &self.nodes[id as usize];
    let length = node.bits >> LENGTH_SHIFT;
    if length < LONG {
      return node.start + i32::from(length);
    }

    match self.long_ends.binary_search_by_key(&id, |&(node, _)| node) {
      Ok(index) => self.long_ends[index].1,
      // Every long node is there.
      Err(_) => node.start,
    }
  }

  pub fn is_string_literal(&self, id: NodeId) -> bool {
    self.kind(id) == Kind::Literal && self.has(id, STRING)
  }

  pub fn memory(&self) -> usize {
    self.nodes.capacity() * std::mem::size_of::<Node>()
      + self
        .parsed
        .as_ref()
        .map_or(0, |parsed| parsed.capacity() * 4)
      + self.long_ends.capacity() * 8
      + self.atom_text.capacity()
      + self.atom_spans.capacity() * 8
      + self.variables.capacity() * std::mem::size_of::<Variable>()
      + self.definitions.capacity() * std::mem::size_of::<Definition>()
      + self.assignments.capacity() * 4
      + self.module_level.capacity() * 8
      + self.symbols_of_parents.capacity() * 8
  }
}

pub struct Children<'a> {
  ast: &'a Ast,
  current: NodeId,
  end: NodeId,
}

impl Iterator for Children<'_> {
  type Item = NodeId;

  #[inline]
  fn next(&mut self) -> Option<NodeId> {
    if self.current >= self.end {
      return None;
    }

    let child = self.current;
    self.current = self.ast.next(child);

    Some(child)
  }
}

pub struct Ancestors<'a> {
  ast: &'a Ast,
  current: NodeId,
}

impl Iterator for Ancestors<'_> {
  type Item = NodeId;

  #[inline]
  fn next(&mut self) -> Option<NodeId> {
    if self.current == NONE {
      return None;
    }

    let ancestor = self.current;
    self.current = self.ast.nodes[ancestor as usize].parent;

    Some(ancestor)
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn ends_are_kept_in_the_node_or_beside_it() {
    let mut ast = Ast::default();
    // (start, end): short, at the limit, long, unmapped, and an end before the start.
    let spans = [
      (0, 0),
      (5, 9),
      (10, 10 + i32::from(LONG) - 1),
      (10, 10 + i32::from(LONG)),
      (0, 1_000_000),
      (UNMAPPED, UNMAPPED),
      (7, 3),
      (i32::MAX - 1, i32::MAX),
      (0, i32::MAX),
    ];

    for (id, &(start, end)) in spans.iter().enumerate() {
      let mut node = Node::new(
        Kind::Identifier,
        Slot::Root,
        start,
        NONE,
        id as NodeId + 1,
        NONE,
      );
      node.add_flags(REFERENCE | READ | SYMBOL_IN_NEXT);
      node.set_end(id as NodeId, end, &mut ast.long_ends);
      ast.nodes.push(node);
    }

    for (id, &(start, end)) in spans.iter().enumerate() {
      let id = id as NodeId;
      assert_eq!((ast.nodes[id as usize].start, ast.end(id)), (start, end));
      // The length does not reach into the flags.
      assert_eq!(ast.flags(id), REFERENCE | READ | SYMBOL_IN_NEXT);
    }
    assert_eq!(ast.long_ends.len(), 4);
  }
}
