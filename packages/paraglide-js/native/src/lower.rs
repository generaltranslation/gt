//! Writes a module's tree as `ir::Ast`: the nodes `oxc-parser` gives JavaScript (ESTree, with
//! TypeScript's nodes), in the order a walk by its visitor keys reaches them.

use oxc_allocator::Allocator;
use oxc_ast::ast::*;
use oxc_parser::{ParseOptions, Parser};
use oxc_semantic::{Scoping, SemanticBuilder};
use oxc_span::{GetSpan, SourceType, Span};
use oxc_syntax::{
  operator::{AssignmentOperator, BinaryOperator, UnaryOperator},
  symbol::SymbolId,
};
use rustc_hash::FxHashMap;
use std::collections::hash_map::Entry;

use crate::{
  ir::{self, Ast, Definition, DefinitionKind, Kind, Node, NodeId, Slot, Variable, NONE},
  positions::Utf16Offsets,
};

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Lang {
  Js,
  Jsx,
  Ts,
  Tsx,
}

impl Lang {
  pub fn parse(name: &str) -> Lang {
    match name {
      "js" => Lang::Js,
      "ts" => Lang::Ts,
      "tsx" => Lang::Tsx,
      _ => Lang::Jsx,
    }
  }

  /// `.js` often contains JSX.
  pub fn of_script(file: &str) -> Lang {
    if file.ends_with(".tsx") {
      return Lang::Tsx;
    }

    let is_typescript = file.ends_with(".ts") || file.ends_with(".mts") || file.ends_with(".cts");

    if is_typescript {
      Lang::Ts
    } else {
      Lang::Jsx
    }
  }

  fn source_type(self) -> SourceType {
    match self {
      Lang::Js => SourceType::mjs(),
      Lang::Jsx => SourceType::jsx(),
      Lang::Ts => SourceType::ts(),
      Lang::Tsx => SourceType::tsx(),
    }
  }
}

thread_local! {
  static ALLOCATOR: std::cell::RefCell<Allocator> = std::cell::RefCell::new(Allocator::default());
}

/// Above this, the memory of one large file is given back instead of being kept.
const MAX_KEPT_ALLOCATOR_BYTES: usize = 32 << 20;

/// Gives back the parser memory each thread keeps between files: no file is parsed until the next
/// load.
pub fn release_allocators() {
  rayon::broadcast(|_| {
    ALLOCATOR.with(|allocator| *allocator.borrow_mut() = Allocator::default());
  });
}

/// Fails with the first syntax error's message, since the parser recovers from errors and a program
/// with one may be incomplete.
pub fn lower(code: &str, lang: Lang) -> Result<Ast, String> {
  lower_located(code, lang).map_err(|error| error.message)
}

/// A syntax error, and the UTF-8 offset in the code where it is reported, if any.
pub struct SyntaxError {
  pub message: String,
  pub offset: Option<usize>,
}

/// As `lower`, with where the syntax error is.
pub fn lower_located(code: &str, lang: Lang) -> Result<Ast, SyntaxError> {
  ALLOCATOR.with(|allocator| {
    let mut allocator = allocator.borrow_mut();
    let result = lower_in(&allocator, code, lang);

    if allocator.capacity() > MAX_KEPT_ALLOCATOR_BYTES {
      *allocator = Allocator::default();
    } else {
      allocator.reset();
    }

    result
  })
}

fn lower_in(allocator: &Allocator, code: &str, lang: Lang) -> Result<Ast, SyntaxError> {
  let options = ParseOptions {
    preserve_parens: true,
    ..ParseOptions::default()
  };
  let parsed = Parser::new(allocator, code, lang.source_type())
    .with_options(options)
    .parse();

  if let Some(error) = parsed.diagnostics.errors().next() {
    return Err(SyntaxError {
      message: error.message.to_string(),
      offset: error.labels.first().map(|label| label.offset() as usize),
    });
  }

  let program = parsed.program;
  let semantic = SemanticBuilder::new()
    .with_build_nodes(false)
    .build(&program)
    .semantic;
  let scoping = semantic.scoping();

  let utf16 = Utf16Offsets::new(code);
  let mut lowerer = Lowerer::new(scoping, &utf16, code.len());
  lowerer.program(&program);

  Ok(lowerer.finish())
}

struct Lowerer<'a, 's> {
  scoping: &'s Scoping,
  utf16: &'s Utf16Offsets<'s>,
  nodes: Vec<Node>,
  atoms: FxHashMap<&'a str, u32>,
  atom_text: String,
  atom_spans: Vec<(u32, u32)>,
  numbers: Vec<f64>,
  variables: Vec<Variable>,
  /// Each definition, with its variable.
  definitions: Vec<(u32, Definition)>,
  /// Each assigned identifier, with its variable.
  assignments: Vec<(u32, NodeId)>,
  /// The variable of each identifier that has children.
  symbols_of_parents: Vec<(NodeId, u32)>,
  long_ends: Vec<(NodeId, i32)>,
  /// How many functions that have their own `arguments` are around the node being lowered.
  function_depth: u32,
  /// What `arguments` refers to in a function: a variable no declaration gives a value.
  arguments: Option<u32>,
}

impl<'a, 's> Lowerer<'a, 's> {
  fn new(scoping: &'s Scoping, utf16: &'s Utf16Offsets<'s>, code_length: usize) -> Self {
    let mut variables = Vec::with_capacity(scoping.symbols_len());
    variables.resize_with(scoping.symbols_len(), Variable::default);

    Self {
      scoping,
      utf16,
      // About one node per five or six bytes of code.
      nodes: Vec::with_capacity(code_length / 4 + 16),
      atoms: FxHashMap::default(),
      atom_text: String::new(),
      atom_spans: Vec::new(),
      numbers: Vec::new(),
      variables,
      definitions: Vec::new(),
      assignments: Vec::new(),
      symbols_of_parents: Vec::new(),
      long_ends: Vec::new(),
      function_depth: 0,
      arguments: None,
    }
  }

  fn finish(mut self) -> Ast {
    let scoping = self.scoping;
    let root = scoping.root_scope_id();
    let symbols: Vec<SymbolId> = scoping.symbol_ids().collect();

    for symbol in symbols {
      let atom = self.atom_of(scoping.symbol_name(symbol));

      let variable = &mut self.variables[symbol.index()];
      variable.name = atom;
      variable.is_module_level = scoping.symbol_scope_id(symbol) == root;
    }

    // Copies of the exact size: the allocator keeps a shrunk buffer at up to twice its size.
    let mut ast = Ast::default();
    ast.nodes = self.nodes.as_slice().to_vec();
    ast.atom_text = self.atom_text.as_str().to_string();
    ast.atom_spans = self.atom_spans.as_slice().to_vec();
    ast.numbers = self.numbers.as_slice().to_vec();
    self.symbols_of_parents.sort_unstable();
    ast.symbols_of_parents = self.symbols_of_parents;
    ast.long_ends = self.long_ends.as_slice().to_vec();
    ast.top_level = if ast.nodes.is_empty() {
      Vec::new()
    } else {
      ast.children(0).collect()
    };
    ast.set_variables(self.variables, self.definitions, self.assignments);

    ast
  }

  // ---------------------------------------------------------------- nodes

  fn push_atom(atom_text: &mut String, atom_spans: &mut Vec<(u32, u32)>, text: &str) -> u32 {
    let start = atom_text.len() as u32;
    atom_text.push_str(text);
    let atom = atom_spans.len() as u32;
    atom_spans.push((start, atom_text.len() as u32));

    atom
  }

  fn atom_of(&mut self, text: &str) -> u32 {
    // The key must live as long as the arena; texts that do not are copied into `atom_text` only.
    if let Some(&atom) = self.atoms.get(text) {
      return atom;
    }

    Self::push_atom(&mut self.atom_text, &mut self.atom_spans, text)
  }

  fn atom(&mut self, text: &'a str) -> u32 {
    match self.atoms.entry(text) {
      Entry::Occupied(found) => *found.get(),
      Entry::Vacant(missing) => *missing.insert(Self::push_atom(
        &mut self.atom_text,
        &mut self.atom_spans,
        text,
      )),
    }
  }

  fn push(&mut self, kind: Kind, slot: Slot, start: u32, end: u32) -> NodeId {
    let id = self.nodes.len() as NodeId;

    let mut node = Node::new(kind, slot, self.utf16.of(start) as i32, id + 1, NONE);
    node.set_end(id, self.utf16.of(end) as i32, &mut self.long_ends);
    self.nodes.push(node);

    id
  }

  fn leaf(&mut self, kind: Kind, slot: Slot, span: Span) -> NodeId {
    self.push(kind, slot, span.start, span.end)
  }

  /// A node whose children are the nodes lowered until `close`.
  fn open(&mut self, kind: Kind, slot: Slot, span: Span) -> NodeId {
    self.push(kind, slot, span.start, span.end)
  }

  fn close(&mut self, id: NodeId) {
    let next = self.nodes.len() as NodeId;
    let node = &mut self.nodes[id as usize];

    // An identifier with children, e.g. a decorated parameter, keeps its variable apart.
    if node.has(ir::SYMBOL_IN_NEXT) && next > id + 1 {
      self.symbols_of_parents.push((id, node.next));
      node.remove_flags(ir::SYMBOL_IN_NEXT);
    }

    node.next = next;
  }

  /// Sets the variable of an identifier, before it has children.
  fn set_symbol(&mut self, id: NodeId, symbol: u32) {
    let node = &mut self.nodes[id as usize];
    node.next = symbol;
    node.add_flags(ir::SYMBOL_IN_NEXT);
  }

  fn flag(&mut self, id: NodeId, flags: u16) {
    self.nodes[id as usize].add_flags(flags);
  }

  fn flag_if(&mut self, id: NodeId, condition: bool, flags: u16) {
    if condition {
      self.flag(id, flags);
    }
  }

  fn define(&mut self, symbol: Option<SymbolId>, definition: Definition) {
    if let Some(symbol) = symbol {
      self.definitions.push((symbol.index() as u32, definition));
    }
  }

  // ---------------------------------------------------------------- identifiers and literals

  fn name_node(&mut self, kind: Kind, slot: Slot, span: Span, name: &'a str) -> NodeId {
    let id = self.leaf(kind, slot, span);
    self.nodes[id as usize].data = self.atom(name);

    id
  }

  /// An identifier that is not a reference: a key, a label, a declared name.
  fn identifier_name(&mut self, ident: &IdentifierName<'a>, slot: Slot) -> NodeId {
    self.name_node(Kind::Identifier, slot, ident.span, ident.name.as_str())
  }

  fn binding_identifier(&mut self, ident: &BindingIdentifier<'a>, slot: Slot) -> NodeId {
    let id = self.name_node(Kind::Identifier, slot, ident.span, ident.name.as_str());

    if let Some(symbol) = ident.symbol_id.get() {
      self.set_symbol(id, symbol.index() as u32);
    }

    id
  }

  fn reference(&mut self, ident: &IdentifierReference<'a>, kind: Kind, slot: Slot) -> NodeId {
    let id = self.name_node(kind, slot, ident.span, ident.name.as_str());
    let Some(reference_id) = ident.reference_id.get() else {
      return id;
    };

    let reference = self.scoping.get_reference(reference_id);
    let mut flags = ir::REFERENCE;
    if reference.is_read() {
      flags |= ir::READ;
    }
    if reference.is_write() {
      flags |= ir::WRITE;
    }

    if let Some(symbol) = reference.symbol_id() {
      let index = symbol.index();
      self.set_symbol(id, index as u32);

      if reference.is_write() {
        self.assignments.push((index as u32, id));
      }
    } else if self.function_depth > 0 && ident.name.as_str() == "arguments" {
      let arguments = self.arguments_variable();
      self.set_symbol(id, arguments);
    }
    self.flag(id, flags);

    id
  }

  /// A function's own `arguments` is not a name of the module, or a global.
  fn arguments_variable(&mut self) -> u32 {
    if let Some(variable) = self.arguments {
      return variable;
    }

    let variable = self.variables.len() as u32;
    let name = self.atom_of("arguments");
    let mut arguments = Variable::default();
    arguments.name = name;
    self.variables.push(arguments);
    self.arguments = Some(variable);

    variable
  }

  fn identifier_reference(&mut self, ident: &IdentifierReference<'a>, slot: Slot) -> NodeId {
    self.reference(ident, Kind::Identifier, slot)
  }

  fn private_identifier(&mut self, ident: &PrivateIdentifier<'a>, slot: Slot) -> NodeId {
    self.name_node(
      Kind::PrivateIdentifier,
      slot,
      ident.span,
      ident.name.as_str(),
    )
  }

  fn string_literal(&mut self, literal: &StringLiteral<'a>, slot: Slot) -> NodeId {
    let id = self.leaf(Kind::Literal, slot, literal.span);
    // A string with a lone surrogate names nothing.
    if let Some(value) = literal.value.as_str() {
      self.nodes[id as usize].data = self.atom(value);
      self.flag(id, ir::STRING);
    }

    id
  }

  fn other_literal(&mut self, span: Span, slot: Slot) -> NodeId {
    self.leaf(Kind::Literal, slot, span)
  }

  fn numeric_literal(&mut self, literal: &NumericLiteral<'a>, slot: Slot) -> NodeId {
    let id = self.leaf(Kind::Literal, slot, literal.span);
    self.nodes[id as usize].data = self.numbers.len() as u32;
    self.numbers.push(literal.value);
    self.flag(id, ir::NUMBER);

    id
  }

  fn template_literal(&mut self, template: &TemplateLiteral<'a>, slot: Slot) -> NodeId {
    let id = self.open(Kind::TemplateLiteral, slot, template.span);

    for quasi in &template.quasis {
      // TypeScript's ESTree: the element with its delimiters.
      let start = quasi.span.start.saturating_sub(1);
      let end = quasi.span.end + if quasi.tail { 1 } else { 2 };
      let element = self.push(Kind::TemplateElement, Slot::Quasi, start, end);

      if let Some(cooked) = quasi.value.cooked.and_then(|cooked| cooked.as_str()) {
        self.nodes[element as usize].data = self.atom(cooked);
      }
    }

    for expression in &template.expressions {
      self.expression(expression, Slot::Expression);
    }

    self.close(id);

    id
  }

  // ---------------------------------------------------------------- program and statements

  fn program(&mut self, program: &Program<'a>) {
    let id = self.open(Kind::Program, Slot::Root, program.span);

    for directive in &program.directives {
      self.directive(directive);
    }
    for statement in &program.body {
      self.statement(statement, Slot::Body);
    }

    self.close(id);
  }

  fn directive(&mut self, directive: &Directive<'a>) {
    let id = self.open(Kind::ExpressionStatement, Slot::Body, directive.span);
    self.string_literal(&directive.expression, Slot::Expression);
    self.close(id);
  }

  fn statements(&mut self, statements: &[Statement<'a>], slot: Slot) {
    for statement in statements {
      self.statement(statement, slot);
    }
  }

  fn block(&mut self, block: &BlockStatement<'a>, slot: Slot) -> NodeId {
    let id = self.open(Kind::BlockStatement, slot, block.span);
    self.statements(&block.body, Slot::Body);
    self.close(id);

    id
  }

  fn function_body(&mut self, body: &FunctionBody<'a>, slot: Slot) -> NodeId {
    let id = self.open(Kind::BlockStatement, slot, body.span);

    for directive in &body.directives {
      self.directive(directive);
    }
    self.statements(&body.statements, Slot::Body);

    self.close(id);

    id
  }

  fn statement(&mut self, statement: &Statement<'a>, slot: Slot) {
    match statement {
      Statement::BlockStatement(block) => {
        self.block(block, slot);
      }
      Statement::BreakStatement(node) => {
        self.leaf(Kind::BreakStatement, slot, node.span);
      }
      Statement::ContinueStatement(node) => {
        self.leaf(Kind::ContinueStatement, slot, node.span);
      }
      Statement::DebuggerStatement(node) => {
        self.leaf(Kind::DebuggerStatement, slot, node.span);
      }
      Statement::EmptyStatement(node) => {
        self.leaf(Kind::EmptyStatement, slot, node.span);
      }
      Statement::DoWhileStatement(node) => {
        let id = self.open(Kind::DoWhileStatement, slot, node.span);
        self.statement(&node.body, Slot::Body);
        self.expression(&node.test, Slot::Test);
        self.close(id);
      }
      Statement::ExpressionStatement(node) => {
        let id = self.open(Kind::ExpressionStatement, slot, node.span);
        self.expression(&node.expression, Slot::Expression);
        self.close(id);
      }
      Statement::ForInStatement(node) => {
        let id = self.open(Kind::ForInStatement, slot, node.span);
        self.for_left(&node.left);
        self.expression(&node.right, Slot::Right);
        self.statement(&node.body, Slot::Body);
        self.close(id);
      }
      Statement::ForOfStatement(node) => {
        let id = self.open(Kind::ForOfStatement, slot, node.span);
        self.for_left(&node.left);
        self.expression(&node.right, Slot::Right);
        self.statement(&node.body, Slot::Body);
        self.close(id);
      }
      Statement::ForStatement(node) => {
        let id = self.open(Kind::ForStatement, slot, node.span);

        match &node.init {
          Some(ForStatementInit::VariableDeclaration(declaration)) => {
            self.variable_declaration(declaration, Slot::Init);
          }
          Some(init) => {
            if let Some(expression) = init.as_expression() {
              self.expression(expression, Slot::Init);
            }
          }
          None => {}
        }
        if let Some(test) = &node.test {
          self.expression(test, Slot::Test);
        }
        if let Some(update) = &node.update {
          self.expression(update, Slot::Update);
        }
        self.statement(&node.body, Slot::Body);

        self.close(id);
      }
      Statement::IfStatement(node) => {
        let id = self.open(Kind::IfStatement, slot, node.span);
        self.expression(&node.test, Slot::Test);
        self.statement(&node.consequent, Slot::Consequent);
        if let Some(alternate) = &node.alternate {
          self.statement(alternate, Slot::Alternate);
        }
        self.close(id);
      }
      Statement::LabeledStatement(node) => {
        let id = self.open(Kind::LabeledStatement, slot, node.span);
        self.statement(&node.body, Slot::Body);
        self.close(id);
      }
      Statement::ReturnStatement(node) => {
        let id = self.open(Kind::ReturnStatement, slot, node.span);
        if let Some(argument) = &node.argument {
          self.expression(argument, Slot::Argument);
        }
        self.close(id);
      }
      Statement::SwitchStatement(node) => {
        let id = self.open(Kind::SwitchStatement, slot, node.span);
        self.expression(&node.discriminant, Slot::Discriminant);

        for case in &node.cases {
          let case_id = self.open(Kind::SwitchCase, Slot::Case, case.span);
          if let Some(test) = &case.test {
            self.expression(test, Slot::Test);
          }
          self.statements(&case.consequent, Slot::Consequent);
          self.close(case_id);
        }

        self.close(id);
      }
      Statement::ThrowStatement(node) => {
        let id = self.open(Kind::ThrowStatement, slot, node.span);
        self.expression(&node.argument, Slot::Argument);
        self.close(id);
      }
      Statement::TryStatement(node) => {
        let id = self.open(Kind::TryStatement, slot, node.span);
        self.block(&node.block, Slot::Block);

        if let Some(handler) = &node.handler {
          let handler_id = self.open(Kind::CatchClause, Slot::Handler, handler.span);
          if let Some(param) = &handler.param {
            let definition = DefinitionSite::other();
            self.binding_pattern(&param.pattern, Slot::Param, definition);
          }
          self.block(&handler.body, Slot::Body);
          self.close(handler_id);
        }
        if let Some(finalizer) = &node.finalizer {
          self.block(finalizer, Slot::Finalizer);
        }

        self.close(id);
      }
      Statement::WhileStatement(node) => {
        let id = self.open(Kind::WhileStatement, slot, node.span);
        self.expression(&node.test, Slot::Test);
        self.statement(&node.body, Slot::Body);
        self.close(id);
      }
      Statement::WithStatement(node) => {
        let id = self.open(Kind::WithStatement, slot, node.span);
        self.expression(&node.object, Slot::Object);
        self.statement(&node.body, Slot::Body);
        self.close(id);
      }

      Statement::VariableDeclaration(declaration) => {
        self.variable_declaration(declaration, slot);
      }
      Statement::FunctionDeclaration(function) => {
        self.function(function, slot);
      }
      Statement::ClassDeclaration(class) => {
        self.class(class, slot);
      }
      Statement::TSTypeAliasDeclaration(node) => {
        self.leaf(Kind::TSTypeAliasDeclaration, slot, node.span);
      }
      Statement::TSInterfaceDeclaration(node) => {
        self.leaf(Kind::TSInterfaceDeclaration, slot, node.span);
      }
      Statement::TSEnumDeclaration(node) => self.ts_enum(node, slot),
      Statement::TSExternalModuleDeclaration(node) => {
        let id = self.open(Kind::TSModuleDeclaration, slot, node.span);
        if let Some(body) = &node.body {
          self.module_block(body);
        }
        self.close(id);
      }
      Statement::TSNamespaceDeclaration(node) => self.ts_namespace(node, slot),
      Statement::TSGlobalDeclaration(node) => {
        let id = self.open(Kind::TSModuleDeclaration, slot, node.span);
        self.module_block(&node.body);
        self.close(id);
      }
      Statement::TSImportEqualsDeclaration(node) => self.ts_import_equals(node, slot),

      Statement::ImportDeclaration(node) => self.import_declaration(node, slot),
      Statement::ExportAllDeclaration(node) => {
        let id = self.open(Kind::ExportAllDeclaration, slot, node.span);
        self.flag_if(id, node.export_kind.is_type(), ir::TYPE_ONLY);
        if let Some(exported) = &node.exported {
          self.module_export_name(exported, Slot::Exported);
        }
        self.string_literal(&node.source, Slot::Source);
        self.close(id);
      }
      Statement::ExportDefaultDeclaration(node) => {
        let id = self.open(Kind::ExportDefaultDeclaration, slot, node.span);

        match &node.declaration {
          ExportDefaultDeclarationKind::FunctionDeclaration(function) => {
            self.function(function, Slot::Declaration);
          }
          ExportDefaultDeclarationKind::ClassDeclaration(class) => {
            self.class(class, Slot::Declaration);
          }
          ExportDefaultDeclarationKind::TSInterfaceDeclaration(interface) => {
            self.leaf(
              Kind::TSInterfaceDeclaration,
              Slot::Declaration,
              interface.span,
            );
          }
          declaration => {
            if let Some(expression) = declaration.as_expression() {
              self.expression(expression, Slot::Declaration);
            }
          }
        }

        self.close(id);
      }
      Statement::ExportDeclaration(node) => {
        let id = self.open(Kind::ExportNamedDeclaration, slot, node.span);
        self.flag_if(id, node.export_kind().is_type(), ir::TYPE_ONLY);
        self.declaration(&node.declaration, Slot::Declaration);
        self.close(id);
      }
      Statement::ExportNamedDeclaration(node) => {
        let id = self.open(Kind::ExportNamedDeclaration, slot, node.span);
        self.flag_if(id, node.export_kind.is_type(), ir::TYPE_ONLY);
        self.export_specifiers(&node.specifiers);
        self.close(id);
      }
      Statement::ExportFromDeclaration(node) => {
        let id = self.open(Kind::ExportNamedDeclaration, slot, node.span);
        self.flag_if(id, node.export_kind.is_type(), ir::TYPE_ONLY);
        self.export_specifiers(&node.specifiers);
        self.string_literal(&node.source, Slot::Source);
        self.close(id);
      }
      Statement::TSExportAssignment(node) => {
        let id = self.open(Kind::TSExportAssignment, slot, node.span);
        self.expression(&node.expression, Slot::Expression);
        self.close(id);
      }
      Statement::TSNamespaceExportDeclaration(node) => {
        self.leaf(Kind::TSNamespaceExportDeclaration, slot, node.span);
      }
    }
  }

  fn declaration(&mut self, declaration: &Declaration<'a>, slot: Slot) {
    match declaration {
      Declaration::VariableDeclaration(node) => {
        self.variable_declaration(node, slot);
      }
      Declaration::FunctionDeclaration(node) => {
        self.function(node, slot);
      }
      Declaration::ClassDeclaration(node) => {
        self.class(node, slot);
      }
      Declaration::TSTypeAliasDeclaration(node) => {
        self.leaf(Kind::TSTypeAliasDeclaration, slot, node.span);
      }
      Declaration::TSInterfaceDeclaration(node) => {
        self.leaf(Kind::TSInterfaceDeclaration, slot, node.span);
      }
      Declaration::TSEnumDeclaration(node) => self.ts_enum(node, slot),
      Declaration::TSExternalModuleDeclaration(node) => {
        let id = self.open(Kind::TSModuleDeclaration, slot, node.span);
        if let Some(body) = &node.body {
          self.module_block(body);
        }
        self.close(id);
      }
      Declaration::TSNamespaceDeclaration(node) => self.ts_namespace(node, slot),
      Declaration::TSGlobalDeclaration(node) => {
        let id = self.open(Kind::TSModuleDeclaration, slot, node.span);
        self.module_block(&node.body);
        self.close(id);
      }
      Declaration::TSImportEqualsDeclaration(node) => self.ts_import_equals(node, slot),
    }
  }

  fn for_left(&mut self, left: &ForStatementLeft<'a>) {
    match left {
      ForStatementLeft::VariableDeclaration(declaration) => {
        self.variable_declaration(declaration, Slot::Left);
      }
      left => {
        if let Some(target) = left.as_assignment_target() {
          self.assignment_target(target, Slot::Left);
        }
      }
    }
  }

  fn variable_declaration(&mut self, declaration: &VariableDeclaration<'a>, slot: Slot) -> NodeId {
    let id = self.open(Kind::VariableDeclaration, slot, declaration.span);
    self.flag_if(
      id,
      declaration.kind == VariableDeclarationKind::Const,
      ir::CONST,
    );

    for declarator in &declaration.declarations {
      let declarator_id = self.open(Kind::VariableDeclarator, Slot::Declaration, declarator.span);
      let definition = DefinitionSite {
        kind: DefinitionKind::Variable,
        node: declarator_id,
        parent: id,
      };

      self.binding_pattern(&declarator.id, Slot::Id, definition);
      if let Some(init) = &declarator.init {
        self.expression(init, Slot::Init);
      }

      self.close(declarator_id);
    }

    self.close(id);

    id
  }

  fn ts_enum(&mut self, node: &TSEnumDeclaration<'a>, slot: Slot) {
    let id = self.open(Kind::TSEnumDeclaration, slot, node.span);
    let name = self.binding_identifier(&node.id, Slot::Id);
    self.define(
      node.id.symbol_id.get(),
      Definition {
        kind: DefinitionKind::Other,
        node: id,
        name,
        parent: NONE,
      },
    );

    let body = self.open(Kind::TSEnumBody, Slot::Body, node.body.span);
    for member in &node.body.members {
      let member_id = self.open(Kind::TSEnumMember, Slot::Member, member.span);

      match &member.id {
        TSEnumMemberName::Identifier(ident) => {
          self.identifier_name(ident, Slot::Id);
        }
        TSEnumMemberName::String(literal) | TSEnumMemberName::ComputedString(literal) => {
          self.string_literal(literal, Slot::Id);
        }
        TSEnumMemberName::ComputedTemplateString(template) => {
          self.template_literal(template, Slot::Id);
        }
      }
      if let Some(initializer) = &member.initializer {
        self.expression(initializer, Slot::Init);
      }

      self.close(member_id);
    }
    self.close(body);

    self.close(id);
  }

  /// `namespace a.b.c {}` is one declaration of the innermost block.
  fn ts_namespace(&mut self, node: &TSNamespaceDeclaration<'a>, slot: Slot) {
    let id = self.open(Kind::TSModuleDeclaration, slot, node.span);

    let mut body = &node.body;
    loop {
      match body {
        TSNamespaceDeclarationBody::TSNamespaceDeclaration(inner) => body = &inner.body,
        TSNamespaceDeclarationBody::TSModuleBlock(block) => {
          self.module_block(block);
          break;
        }
      }
    }

    self.close(id);
  }

  fn module_block(&mut self, block: &TSModuleBlock<'a>) {
    let id = self.open(Kind::TSModuleBlock, Slot::Body, block.span);

    for directive in &block.directives {
      self.directive(directive);
    }
    self.statements(&block.body, Slot::Body);

    self.close(id);
  }

  fn ts_import_equals(&mut self, node: &TSImportEqualsDeclaration<'a>, slot: Slot) {
    let id = self.open(Kind::TSImportEqualsDeclaration, slot, node.span);
    self.flag_if(id, node.import_kind.is_type(), ir::TYPE_ONLY);

    let name = self.binding_identifier(&node.id, Slot::Id);
    self.define(
      node.id.symbol_id.get(),
      Definition {
        kind: DefinitionKind::ImportBinding,
        node: id,
        name,
        parent: NONE,
      },
    );

    match &node.module_reference {
      TSModuleReference::ExternalModuleReference(reference) => {
        let reference_id = self.open(
          Kind::TSExternalModuleReference,
          Slot::Reference,
          reference.span,
        );
        self.string_literal(&reference.expression, Slot::Expression);
        self.close(reference_id);
      }
      reference => {
        self.leaf(Kind::TSType, Slot::Reference, reference.span());
      }
    }

    self.close(id);
  }

  // ---------------------------------------------------------------- imports and exports

  fn import_declaration(&mut self, node: &ImportDeclaration<'a>, slot: Slot) {
    let id = self.open(Kind::ImportDeclaration, slot, node.span);
    self.flag_if(id, node.import_kind.is_type(), ir::TYPE_ONLY);

    for specifier in node.specifiers.iter().flatten() {
      let (specifier_id, local) = match specifier {
        ImportDeclarationSpecifier::ImportSpecifier(specifier) => {
          let specifier_id = self.open(Kind::ImportSpecifier, Slot::Specifier, specifier.span);
          self.flag_if(specifier_id, specifier.import_kind.is_type(), ir::TYPE_ONLY);
          self.module_export_name(&specifier.imported, Slot::Imported);
          (specifier_id, &specifier.local)
        }
        ImportDeclarationSpecifier::ImportDefaultSpecifier(specifier) => (
          self.open(
            Kind::ImportDefaultSpecifier,
            Slot::Specifier,
            specifier.span,
          ),
          &specifier.local,
        ),
        ImportDeclarationSpecifier::ImportNamespaceSpecifier(specifier) => (
          self.open(
            Kind::ImportNamespaceSpecifier,
            Slot::Specifier,
            specifier.span,
          ),
          &specifier.local,
        ),
      };

      let name = self.binding_identifier(local, Slot::Local);
      self.define(
        local.symbol_id.get(),
        Definition {
          kind: DefinitionKind::ImportBinding,
          node: specifier_id,
          name,
          parent: id,
        },
      );
      self.close(specifier_id);
    }

    self.string_literal(&node.source, Slot::Source);
    self.close(id);
  }

  fn export_specifiers(&mut self, specifiers: &[ExportSpecifier<'a>]) {
    for specifier in specifiers {
      let id = self.open(Kind::ExportSpecifier, Slot::Specifier, specifier.span);
      self.flag_if(id, specifier.export_kind.is_type(), ir::TYPE_ONLY);
      self.module_export_name(&specifier.local, Slot::Local);
      self.module_export_name(&specifier.exported, Slot::Exported);
      self.close(id);
    }
  }

  /// `a` or `"a"`: the names of import and export specifiers are not references.
  fn module_export_name(&mut self, name: &ModuleExportName<'a>, slot: Slot) {
    match name {
      ModuleExportName::IdentifierName(ident) => {
        self.identifier_name(ident, slot);
      }
      ModuleExportName::IdentifierReference(ident) => {
        self.name_node(Kind::Identifier, slot, ident.span, ident.name.as_str());
      }
      ModuleExportName::StringLiteral(literal) => {
        self.string_literal(literal, slot);
      }
    }
  }

  // ---------------------------------------------------------------- functions and classes

  fn function(&mut self, function: &Function<'a>, slot: Slot) -> NodeId {
    let kind = match function.r#type {
      FunctionType::FunctionDeclaration => Kind::FunctionDeclaration,
      FunctionType::FunctionExpression => Kind::FunctionExpression,
      FunctionType::TSDeclareFunction => Kind::TSDeclareFunction,
      FunctionType::TSEmptyBodyFunctionExpression => Kind::TSEmptyBodyFunctionExpression,
    };
    let id = self.open(kind, slot, function.span);

    if let Some(ident) = &function.id {
      let name = self.binding_identifier(ident, Slot::Id);
      self.define(
        ident.symbol_id.get(),
        Definition {
          kind: DefinitionKind::FunctionName,
          node: id,
          name,
          parent: NONE,
        },
      );
    }

    if let Some(this_param) = &function.this_param {
      self.name_node(Kind::Identifier, Slot::This, this_param.span, "this");
    }
    self.function_depth += 1;
    self.formal_parameters(&function.params, id);

    if let Some(body) = &function.body {
      self.function_body(body, Slot::Body);
    }
    self.function_depth -= 1;

    self.close(id);

    id
  }

  fn arrow_function(&mut self, arrow: &ArrowFunctionExpression<'a>, slot: Slot) -> NodeId {
    let id = self.open(Kind::ArrowFunctionExpression, slot, arrow.span);
    self.formal_parameters(&arrow.params, id);

    match &arrow.body {
      ArrowFunctionBody::FunctionBody(body) => {
        self.function_body(body, Slot::Body);
      }
      body => {
        if let Some(expression) = body.as_expression() {
          self.flag(id, ir::EXPRESSION_BODY);
          self.expression(expression, Slot::Body);
        }
      }
    }

    self.close(id);

    id
  }

  fn formal_parameters(&mut self, params: &FormalParameters<'a>, function: NodeId) {
    let definition = DefinitionSite {
      kind: DefinitionKind::Parameter,
      node: function,
      parent: NONE,
    };

    for param in &params.items {
      self.formal_parameter(param, definition);
    }

    if let Some(rest) = &params.rest {
      let id = self.open(Kind::RestElement, Slot::Param, rest.span);
      self.decorators(&rest.decorators);
      self.binding_pattern(&rest.rest.argument, Slot::Argument, definition);
      self.close(id);
    }
  }

  /// `a`, `a = m` (an `AssignmentPattern`), or `private a` (a `TSParameterProperty`).
  fn formal_parameter(&mut self, param: &FormalParameter<'a>, definition: DefinitionSite) {
    let has_modifier = param.accessibility.is_some() || param.readonly || param.r#override;

    if has_modifier {
      let id = self.open(Kind::TSParameterProperty, Slot::Param, param.span);
      self.decorators(&param.decorators);

      match &param.initializer {
        Some(initializer) => {
          let span = Span::new(param.pattern.span().start, initializer.span().end);
          let assignment = self.open(Kind::AssignmentPattern, Slot::Parameter, span);
          self.binding_pattern(&param.pattern, Slot::Left, definition);
          self.expression(initializer, Slot::Right);
          self.close(assignment);
        }
        None => {
          self.binding_pattern(&param.pattern, Slot::Parameter, definition);
        }
      }

      self.close(id);
      return;
    }

    if let Some(initializer) = &param.initializer {
      let id = self.open(Kind::AssignmentPattern, Slot::Param, param.span);
      self.decorators(&param.decorators);
      self.binding_pattern(&param.pattern, Slot::Left, definition);
      self.expression(initializer, Slot::Right);
      self.close(id);
      return;
    }

    // ESTree holds a parameter's decorators on its pattern.
    self.decorated_pattern(&param.pattern, Slot::Param, definition, &param.decorators);
  }

  fn decorators(&mut self, decorators: &[Decorator<'a>]) {
    for decorator in decorators {
      let id = self.open(Kind::Decorator, Slot::Decorator, decorator.span);
      self.expression(&decorator.expression, Slot::Expression);
      self.close(id);
    }
  }

  fn class(&mut self, class: &Class<'a>, slot: Slot) -> NodeId {
    let kind = match class.r#type {
      ClassType::ClassDeclaration => Kind::ClassDeclaration,
      ClassType::ClassExpression => Kind::ClassExpression,
    };
    let id = self.open(kind, slot, class.span);
    self.decorators(&class.decorators);

    if let Some(ident) = &class.id {
      let name = self.binding_identifier(ident, Slot::Id);
      self.define(
        ident.symbol_id.get(),
        Definition {
          kind: DefinitionKind::Other,
          node: id,
          name,
          parent: NONE,
        },
      );
    }
    if let Some(heritage) = &class.heritage {
      self.expression(&heritage.expression, Slot::SuperClass);
    }

    let body = self.open(Kind::ClassBody, Slot::Body, class.body.span);
    for element in &class.body.body {
      self.class_element(element);
    }
    self.close(body);

    self.close(id);

    id
  }

  fn class_element(&mut self, element: &ClassElement<'a>) {
    match element {
      ClassElement::StaticBlock(block) => {
        let id = self.open(Kind::StaticBlock, Slot::Body, block.span);
        self.statements(&block.body, Slot::Body);
        self.close(id);
      }
      ClassElement::MethodDefinition(method) => {
        let is_abstract = method.r#type == MethodDefinitionType::TSAbstractMethodDefinition;
        let kind = if is_abstract {
          Kind::TSAbstractMethodDefinition
        } else {
          Kind::MethodDefinition
        };
        let id = self.open(kind, Slot::Body, method.span);

        self.flag_if(id, method.computed, ir::COMPUTED);
        self.flag_if(id, method.r#static, ir::STATIC);
        self.flag(
          id,
          match method.kind {
            MethodDefinitionKind::Constructor => ir::CONSTRUCTOR,
            MethodDefinitionKind::Get => ir::GETTER,
            MethodDefinitionKind::Set => ir::SETTER,
            MethodDefinitionKind::Method => 0,
          },
        );

        // An abstract method's visitor keys have no decorators.
        if !is_abstract {
          self.decorators(&method.decorators);
        }
        self.property_key(&method.key, Slot::Key);
        self.function(&method.value, Slot::Value);

        self.close(id);
      }
      ClassElement::PropertyDefinition(property) => {
        let is_abstract = property.r#type == PropertyDefinitionType::TSAbstractPropertyDefinition;
        let kind = if is_abstract {
          Kind::TSAbstractPropertyDefinition
        } else {
          Kind::PropertyDefinition
        };
        let id = self.open(kind, Slot::Body, property.span);

        self.flag_if(id, property.computed, ir::COMPUTED);
        self.flag_if(id, property.r#static, ir::STATIC);
        self.decorators(&property.decorators);
        self.property_key(&property.key, Slot::Key);

        // An abstract property's visitor keys have no value.
        if let (false, Some(value)) = (is_abstract, &property.value) {
          self.expression(value, Slot::Value);
        }

        self.close(id);
      }
      ClassElement::AccessorProperty(property) => {
        let is_abstract = property.r#type == AccessorPropertyType::TSAbstractAccessorProperty;
        let kind = if is_abstract {
          Kind::TSAbstractAccessorProperty
        } else {
          Kind::AccessorProperty
        };
        let id = self.open(kind, Slot::Body, property.span);

        self.flag_if(id, property.computed, ir::COMPUTED);
        self.flag_if(id, property.r#static, ir::STATIC);
        self.decorators(&property.decorators);
        self.property_key(&property.key, Slot::Key);

        if let (false, Some(value)) = (is_abstract, &property.value) {
          self.expression(value, Slot::Value);
        }

        self.close(id);
      }
      ClassElement::TSIndexSignature(signature) => {
        self.leaf(Kind::TSIndexSignature, Slot::Body, signature.span);
      }
    }
  }

  fn property_key(&mut self, key: &PropertyKey<'a>, slot: Slot) {
    match key {
      PropertyKey::StaticIdentifier(ident) => {
        self.identifier_name(ident, slot);
      }
      PropertyKey::PrivateIdentifier(ident) => {
        self.private_identifier(ident, slot);
      }
      key => {
        if let Some(expression) = key.as_expression() {
          self.expression(expression, slot);
        }
      }
    }
  }

  // ---------------------------------------------------------------- patterns

  fn binding_pattern(
    &mut self,
    pattern: &BindingPattern<'a>,
    slot: Slot,
    definition: DefinitionSite,
  ) -> NodeId {
    self.decorated_pattern(pattern, slot, definition, &[])
  }

  /// Decorators are the pattern's first children.
  fn decorated_pattern(
    &mut self,
    pattern: &BindingPattern<'a>,
    slot: Slot,
    definition: DefinitionSite,
    decorators: &[Decorator<'a>],
  ) -> NodeId {
    match pattern {
      BindingPattern::BindingIdentifier(ident) => {
        let id = self.binding_identifier(ident, slot);
        self.define(
          ident.symbol_id.get(),
          Definition {
            kind: definition.kind,
            node: definition.node,
            name: id,
            parent: definition.parent,
          },
        );

        if !decorators.is_empty() {
          self.decorators(decorators);
          self.close(id);
        }

        id
      }
      BindingPattern::ObjectPattern(object) => {
        let id = self.open(Kind::ObjectPattern, slot, object.span);
        self.decorators(decorators);

        for property in &object.properties {
          let property_id = self.open(Kind::Property, Slot::Property, property.span);
          self.flag_if(property_id, property.computed, ir::COMPUTED);
          self.flag_if(property_id, property.shorthand, ir::SHORTHAND);
          self.property_key(&property.key, Slot::Key);
          self.binding_pattern(&property.value, Slot::Value, definition);
          self.close(property_id);
        }
        if let Some(rest) = &object.rest {
          self.binding_rest(rest, Slot::Property, definition);
        }

        self.close(id);

        id
      }
      BindingPattern::ArrayPattern(array) => {
        let id = self.open(Kind::ArrayPattern, slot, array.span);
        self.decorators(decorators);

        for element in array.elements.iter().flatten() {
          self.binding_pattern(element, Slot::Element, definition);
        }
        if let Some(rest) = &array.rest {
          self.binding_rest(rest, Slot::Element, definition);
        }

        self.close(id);

        id
      }
      BindingPattern::AssignmentPattern(assignment) => {
        let id = self.open(Kind::AssignmentPattern, slot, assignment.span);
        self.decorators(decorators);
        self.binding_pattern(&assignment.left, Slot::Left, definition);
        self.expression(&assignment.right, Slot::Right);
        self.close(id);

        id
      }
    }
  }

  fn binding_rest(
    &mut self,
    rest: &BindingRestElement<'a>,
    slot: Slot,
    definition: DefinitionSite,
  ) {
    let id = self.open(Kind::RestElement, slot, rest.span);
    self.binding_pattern(&rest.argument, Slot::Argument, definition);
    self.close(id);
  }

  fn assignment_target(&mut self, target: &AssignmentTarget<'a>, slot: Slot) {
    match target {
      AssignmentTarget::AssignmentTargetIdentifier(ident) => {
        self.identifier_reference(ident, slot);
      }
      AssignmentTarget::TSAsExpression(node) => {
        self.wrapper(Kind::TSAsExpression, node.span, &node.expression, slot);
      }
      AssignmentTarget::TSSatisfiesExpression(node) => {
        self.wrapper(
          Kind::TSSatisfiesExpression,
          node.span,
          &node.expression,
          slot,
        );
      }
      AssignmentTarget::TSNonNullExpression(node) => {
        self.wrapper(Kind::TSNonNullExpression, node.span, &node.expression, slot);
      }
      AssignmentTarget::TSTypeAssertion(node) => {
        self.wrapper(Kind::TSTypeAssertion, node.span, &node.expression, slot);
      }
      AssignmentTarget::ComputedMemberExpression(member) => {
        self.computed_member(member, slot);
      }
      AssignmentTarget::StaticMemberExpression(member) => {
        self.static_member(member, slot);
      }
      AssignmentTarget::PrivateFieldExpression(member) => {
        self.private_member(member, slot);
      }
      AssignmentTarget::ArrayAssignmentTarget(array) => {
        let id = self.open(Kind::ArrayPattern, slot, array.span);

        for element in array.elements.iter().flatten() {
          self.assignment_target_maybe_default(element, Slot::Element);
        }
        if let Some(rest) = &array.rest {
          self.assignment_rest(rest, Slot::Element);
        }

        self.close(id);
      }
      AssignmentTarget::ObjectAssignmentTarget(object) => {
        let id = self.open(Kind::ObjectPattern, slot, object.span);

        for property in &object.properties {
          self.assignment_target_property(property);
        }
        if let Some(rest) = &object.rest {
          self.assignment_rest(rest, Slot::Property);
        }

        self.close(id);
      }
    }
  }

  fn assignment_rest(&mut self, rest: &AssignmentTargetRest<'a>, slot: Slot) {
    let id = self.open(Kind::RestElement, slot, rest.span);
    self.assignment_target(&rest.target, Slot::Argument);
    self.close(id);
  }

  fn assignment_target_maybe_default(
    &mut self,
    target: &AssignmentTargetMaybeDefault<'a>,
    slot: Slot,
  ) {
    match target {
      AssignmentTargetMaybeDefault::AssignmentTargetWithDefault(with_default) => {
        let id = self.open(Kind::AssignmentPattern, slot, with_default.span);
        self.assignment_target(&with_default.binding, Slot::Left);
        self.expression(&with_default.init, Slot::Right);
        self.close(id);
      }
      target => {
        if let Some(target) = target.as_assignment_target() {
          self.assignment_target(target, slot);
        }
      }
    }
  }

  fn assignment_target_property(&mut self, property: &AssignmentTargetProperty<'a>) {
    match property {
      // `{ a }` and `{ a = 1 }`: the name is the key and the target.
      AssignmentTargetProperty::AssignmentTargetPropertyIdentifier(property) => {
        let id = self.open(Kind::Property, Slot::Property, property.span);
        self.flag(id, ir::SHORTHAND);

        let ident = &property.binding;
        self.name_node(Kind::Identifier, Slot::Key, ident.span, ident.name.as_str());

        match &property.init {
          Some(init) => {
            let assignment = self.open(Kind::AssignmentPattern, Slot::Value, property.span);
            self.identifier_reference(ident, Slot::Left);
            self.expression(init, Slot::Right);
            self.close(assignment);
          }
          None => {
            self.identifier_reference(ident, Slot::Value);
          }
        }

        self.close(id);
      }
      AssignmentTargetProperty::AssignmentTargetPropertyProperty(property) => {
        let id = self.open(Kind::Property, Slot::Property, property.span);
        self.flag_if(id, property.computed, ir::COMPUTED);
        self.property_key(&property.name, Slot::Key);
        self.assignment_target_maybe_default(&property.binding, Slot::Value);
        self.close(id);
      }
    }
  }

  fn simple_assignment_target(&mut self, target: &SimpleAssignmentTarget<'a>, slot: Slot) {
    match target {
      SimpleAssignmentTarget::AssignmentTargetIdentifier(ident) => {
        self.identifier_reference(ident, slot);
      }
      SimpleAssignmentTarget::TSAsExpression(node) => {
        self.wrapper(Kind::TSAsExpression, node.span, &node.expression, slot);
      }
      SimpleAssignmentTarget::TSSatisfiesExpression(node) => {
        self.wrapper(
          Kind::TSSatisfiesExpression,
          node.span,
          &node.expression,
          slot,
        );
      }
      SimpleAssignmentTarget::TSNonNullExpression(node) => {
        self.wrapper(Kind::TSNonNullExpression, node.span, &node.expression, slot);
      }
      SimpleAssignmentTarget::TSTypeAssertion(node) => {
        self.wrapper(Kind::TSTypeAssertion, node.span, &node.expression, slot);
      }
      SimpleAssignmentTarget::ComputedMemberExpression(member) => {
        self.computed_member(member, slot);
      }
      SimpleAssignmentTarget::StaticMemberExpression(member) => {
        self.static_member(member, slot);
      }
      SimpleAssignmentTarget::PrivateFieldExpression(member) => {
        self.private_member(member, slot);
      }
    }
  }

  // ---------------------------------------------------------------- expressions

  fn wrapper(&mut self, kind: Kind, span: Span, expression: &Expression<'a>, slot: Slot) {
    let id = self.open(kind, slot, span);
    self.expression(expression, Slot::Expression);
    self.close(id);
  }

  fn computed_member(&mut self, member: &ComputedMemberExpression<'a>, slot: Slot) {
    let id = self.open(Kind::MemberExpression, slot, member.span);
    self.flag(id, ir::COMPUTED);
    self.expression(&member.object, Slot::Object);
    self.expression(&member.expression, Slot::Property);
    self.close(id);
  }

  fn static_member(&mut self, member: &StaticMemberExpression<'a>, slot: Slot) {
    let id = self.open(Kind::MemberExpression, slot, member.span);
    self.expression(&member.object, Slot::Object);
    self.identifier_name(&member.property, Slot::Property);
    self.close(id);
  }

  fn private_member(&mut self, member: &PrivateFieldExpression<'a>, slot: Slot) {
    let id = self.open(Kind::MemberExpression, slot, member.span);
    self.expression(&member.object, Slot::Object);
    self.private_identifier(&member.field, Slot::Property);
    self.close(id);
  }

  fn arguments(&mut self, arguments: &[Argument<'a>]) {
    for argument in arguments {
      match argument {
        Argument::SpreadElement(spread) => {
          self.spread(spread, Slot::Arg);
        }
        argument => {
          if let Some(expression) = argument.as_expression() {
            self.expression(expression, Slot::Arg);
          }
        }
      }
    }
  }

  fn spread(&mut self, spread: &SpreadElement<'a>, slot: Slot) {
    let id = self.open(Kind::SpreadElement, slot, spread.span);
    self.expression(&spread.argument, Slot::Argument);
    self.close(id);
  }

  fn call(&mut self, call: &CallExpression<'a>, slot: Slot) {
    let id = self.open(Kind::CallExpression, slot, call.span);
    self.expression(&call.callee, Slot::Callee);
    self.arguments(&call.arguments);
    self.close(id);
  }

  fn expression(&mut self, expression: &Expression<'a>, slot: Slot) {
    match expression {
      Expression::BooleanLiteral(literal) => {
        self.other_literal(literal.span, slot);
      }
      Expression::NullLiteral(literal) => {
        self.other_literal(literal.span, slot);
      }
      Expression::BigIntLiteral(literal) => {
        self.other_literal(literal.span, slot);
      }
      Expression::RegExpLiteral(literal) => {
        self.other_literal(literal.span, slot);
      }
      Expression::NumericLiteral(literal) => {
        self.numeric_literal(literal, slot);
      }
      Expression::StringLiteral(literal) => {
        self.string_literal(literal, slot);
      }
      Expression::TemplateLiteral(template) => {
        self.template_literal(template, slot);
      }
      Expression::Identifier(ident) => {
        self.identifier_reference(ident, slot);
      }
      Expression::Super(node) => {
        self.leaf(Kind::Super, slot, node.span);
      }
      Expression::ThisExpression(node) => {
        self.leaf(Kind::ThisExpression, slot, node.span);
      }
      Expression::ImportMeta(node) => {
        self.leaf(Kind::MetaProperty, slot, node.span);
      }
      Expression::NewTarget(node) => {
        self.leaf(Kind::MetaProperty, slot, node.span);
      }
      Expression::ArrayExpression(array) => {
        let id = self.open(Kind::ArrayExpression, slot, array.span);

        for element in &array.elements {
          match element {
            ArrayExpressionElement::SpreadElement(spread) => self.spread(spread, Slot::Element),
            ArrayExpressionElement::Elision(_) => {}
            element => {
              if let Some(expression) = element.as_expression() {
                self.expression(expression, Slot::Element);
              }
            }
          }
        }

        self.close(id);
      }
      Expression::ArrowFunctionExpression(arrow) => {
        self.arrow_function(arrow, slot);
      }
      Expression::AssignmentExpression(assignment) => {
        let id = self.open(Kind::AssignmentExpression, slot, assignment.span);
        let is_plain = assignment.operator == AssignmentOperator::Assign;
        self.nodes[id as usize].data = if is_plain { ir::OP_PLAIN } else { ir::OP_OTHER };
        self.assignment_target(&assignment.left, Slot::Left);
        self.expression(&assignment.right, Slot::Right);
        self.close(id);
      }
      Expression::AwaitExpression(node) => {
        let id = self.open(Kind::AwaitExpression, slot, node.span);
        self.expression(&node.argument, Slot::Argument);
        self.close(id);
      }
      Expression::BinaryExpression(binary) => {
        let id = self.open(Kind::BinaryExpression, slot, binary.span);
        let is_addition = binary.operator == BinaryOperator::Addition;
        self.nodes[id as usize].data = if is_addition {
          ir::OP_PLAIN
        } else {
          ir::OP_OTHER
        };
        self.expression(&binary.left, Slot::Left);
        self.expression(&binary.right, Slot::Right);
        self.close(id);
      }
      Expression::PrivateInExpression(node) => {
        let id = self.open(Kind::BinaryExpression, slot, node.span);
        self.nodes[id as usize].data = ir::OP_OTHER;
        self.private_identifier(&node.left, Slot::Left);
        self.expression(&node.right, Slot::Right);
        self.close(id);
      }
      Expression::CallExpression(call) => self.call(call, slot),
      Expression::ChainExpression(chain) => {
        let id = self.open(Kind::ChainExpression, slot, chain.span);

        match &chain.expression {
          ChainElement::CallExpression(call) => self.call(call, Slot::Expression),
          ChainElement::TSNonNullExpression(node) => {
            self.wrapper(
              Kind::TSNonNullExpression,
              node.span,
              &node.expression,
              Slot::Expression,
            );
          }
          ChainElement::ComputedMemberExpression(member) => {
            self.computed_member(member, Slot::Expression);
          }
          ChainElement::StaticMemberExpression(member) => {
            self.static_member(member, Slot::Expression);
          }
          ChainElement::PrivateFieldExpression(member) => {
            self.private_member(member, Slot::Expression);
          }
        }

        self.close(id);
      }
      Expression::ClassExpression(class) => {
        self.class(class, slot);
      }
      Expression::ConditionalExpression(node) => {
        let id = self.open(Kind::ConditionalExpression, slot, node.span);
        self.expression(&node.test, Slot::Test);
        self.expression(&node.consequent, Slot::Consequent);
        self.expression(&node.alternate, Slot::Alternate);
        self.close(id);
      }
      Expression::FunctionExpression(function) => {
        self.function(function, slot);
      }
      Expression::ImportExpression(node) => {
        let id = self.open(Kind::ImportExpression, slot, node.span);
        self.expression(&node.source, Slot::Source);
        if let Some(options) = &node.options {
          self.expression(options, Slot::Options);
        }
        self.close(id);
      }
      Expression::LogicalExpression(node) => {
        let id = self.open(Kind::LogicalExpression, slot, node.span);
        self.expression(&node.left, Slot::Left);
        self.expression(&node.right, Slot::Right);
        self.close(id);
      }
      Expression::NewExpression(node) => {
        let id = self.open(Kind::NewExpression, slot, node.span);
        self.expression(&node.callee, Slot::Callee);
        self.arguments(&node.arguments);
        self.close(id);
      }
      Expression::ObjectExpression(object) => {
        let id = self.open(Kind::ObjectExpression, slot, object.span);

        for property in &object.properties {
          match property {
            ObjectPropertyKind::ObjectProperty(property) => {
              let property_id = self.open(Kind::Property, Slot::Property, property.span);
              self.flag_if(property_id, property.computed, ir::COMPUTED);
              self.flag_if(property_id, property.method, ir::METHOD);
              self.flag_if(property_id, property.shorthand, ir::SHORTHAND);
              self.flag(
                property_id,
                match property.kind {
                  PropertyKind::Init => 0,
                  PropertyKind::Get => ir::GETTER,
                  PropertyKind::Set => ir::SETTER,
                },
              );
              self.property_key(&property.key, Slot::Key);
              self.expression(&property.value, Slot::Value);
              self.close(property_id);
            }
            ObjectPropertyKind::SpreadProperty(spread) => self.spread(spread, Slot::Property),
          }
        }

        self.close(id);
      }
      Expression::ParenthesizedExpression(node) => {
        self.wrapper(
          Kind::ParenthesizedExpression,
          node.span,
          &node.expression,
          slot,
        );
      }
      Expression::SequenceExpression(sequence) => {
        let id = self.open(Kind::SequenceExpression, slot, sequence.span);
        for expression in &sequence.expressions {
          self.expression(expression, Slot::Expression);
        }
        self.close(id);
      }
      Expression::TaggedTemplateExpression(tagged) => {
        let id = self.open(Kind::TaggedTemplateExpression, slot, tagged.span);
        self.expression(&tagged.tag, Slot::Tag);
        self.template_literal(&tagged.quasi, Slot::Quasi);
        self.close(id);
      }
      Expression::UnaryExpression(unary) => {
        let id = self.open(Kind::UnaryExpression, slot, unary.span);
        let is_void = unary.operator == UnaryOperator::Void;
        self.nodes[id as usize].data = if is_void { ir::OP_PLAIN } else { ir::OP_OTHER };
        self.expression(&unary.argument, Slot::Argument);
        self.close(id);
      }
      Expression::UpdateExpression(update) => {
        let id = self.open(Kind::UpdateExpression, slot, update.span);
        self.simple_assignment_target(&update.argument, Slot::Argument);
        self.close(id);
      }
      Expression::YieldExpression(node) => {
        let id = self.open(Kind::YieldExpression, slot, node.span);
        if let Some(argument) = &node.argument {
          self.expression(argument, Slot::Argument);
        }
        self.close(id);
      }
      Expression::JSXElement(element) => self.jsx_element(element, slot),
      Expression::JSXFragment(fragment) => self.jsx_fragment(fragment, slot),
      Expression::TSAsExpression(node) => {
        self.wrapper(Kind::TSAsExpression, node.span, &node.expression, slot);
      }
      Expression::TSSatisfiesExpression(node) => {
        self.wrapper(
          Kind::TSSatisfiesExpression,
          node.span,
          &node.expression,
          slot,
        );
      }
      Expression::TSTypeAssertion(node) => {
        self.wrapper(Kind::TSTypeAssertion, node.span, &node.expression, slot);
      }
      Expression::TSNonNullExpression(node) => {
        self.wrapper(Kind::TSNonNullExpression, node.span, &node.expression, slot);
      }
      Expression::TSInstantiationExpression(node) => {
        self.wrapper(
          Kind::TSInstantiationExpression,
          node.span,
          &node.expression,
          slot,
        );
      }
      Expression::V8IntrinsicExpression(node) => {
        let id = self.open(Kind::V8IntrinsicExpression, slot, node.span);
        self.identifier_name(&node.name, Slot::Name);
        self.arguments(&node.arguments);
        self.close(id);
      }
      Expression::ComputedMemberExpression(member) => self.computed_member(member, slot),
      Expression::StaticMemberExpression(member) => self.static_member(member, slot),
      Expression::PrivateFieldExpression(member) => self.private_member(member, slot),
    }
  }

  // ---------------------------------------------------------------- JSX

  fn jsx_element(&mut self, element: &JSXElement<'a>, slot: Slot) {
    let id = self.open(Kind::JSXElement, slot, element.span);

    let opening = &element.opening_element;
    let opening_id = self.open(Kind::JSXOpeningElement, Slot::Opening, opening.span);
    self.jsx_element_name(&opening.name, Slot::Name);

    for attribute in &opening.attributes {
      match attribute {
        JSXAttributeItem::Attribute(attribute) => {
          let attribute_id = self.open(Kind::JSXAttribute, Slot::Attribute, attribute.span);

          match &attribute.name {
            JSXAttributeName::Identifier(ident) => {
              self.jsx_identifier(ident, Slot::Name);
            }
            JSXAttributeName::NamespacedName(name) => self.jsx_namespaced_name(name, Slot::Name),
          }
          match &attribute.value {
            Some(JSXAttributeValue::StringLiteral(literal)) => {
              self.string_literal(literal, Slot::Value);
            }
            Some(JSXAttributeValue::ExpressionContainer(container)) => {
              self.jsx_expression_container(container, Slot::Value);
            }
            Some(JSXAttributeValue::Element(element)) => self.jsx_element(element, Slot::Value),
            Some(JSXAttributeValue::Fragment(fragment)) => self.jsx_fragment(fragment, Slot::Value),
            None => {}
          }

          self.close(attribute_id);
        }
        JSXAttributeItem::SpreadAttribute(spread) => {
          let spread_id = self.open(Kind::JSXSpreadAttribute, Slot::Attribute, spread.span);
          self.expression(&spread.argument, Slot::Argument);
          self.close(spread_id);
        }
      }
    }
    self.close(opening_id);

    self.jsx_children(&element.children);

    // A closing tag's name is not a reference: only the opening tag is a usage.
    if let Some(closing) = &element.closing_element {
      self.leaf(Kind::JSXClosingElement, Slot::Closing, closing.span);
    }

    self.close(id);
  }

  fn jsx_fragment(&mut self, fragment: &JSXFragment<'a>, slot: Slot) {
    let id = self.open(Kind::JSXFragment, slot, fragment.span);
    self.leaf(
      Kind::JSXOpeningFragment,
      Slot::Opening,
      fragment.opening_fragment.span,
    );
    self.jsx_children(&fragment.children);
    self.leaf(
      Kind::JSXClosingFragment,
      Slot::Closing,
      fragment.closing_fragment.span,
    );
    self.close(id);
  }

  fn jsx_children(&mut self, children: &[JSXChild<'a>]) {
    for child in children {
      match child {
        JSXChild::Text(text) => {
          self.leaf(Kind::JSXText, Slot::Child, text.span);
        }
        JSXChild::Element(element) => self.jsx_element(element, Slot::Child),
        JSXChild::Fragment(fragment) => self.jsx_fragment(fragment, Slot::Child),
        JSXChild::ExpressionContainer(container) => {
          self.jsx_expression_container(container, Slot::Child);
        }
        JSXChild::Spread(spread) => {
          let id = self.open(Kind::JSXSpreadChild, Slot::Child, spread.span);
          self.expression(&spread.expression, Slot::Expression);
          self.close(id);
        }
      }
    }
  }

  fn jsx_expression_container(&mut self, container: &JSXExpressionContainer<'a>, slot: Slot) {
    let id = self.open(Kind::JSXExpressionContainer, slot, container.span);

    match &container.expression {
      JSXExpression::EmptyExpression(empty) => {
        self.leaf(Kind::JSXEmptyExpression, Slot::Expression, empty.span);
      }
      expression => {
        if let Some(expression) = expression.as_expression() {
          self.expression(expression, Slot::Expression);
        }
      }
    }

    self.close(id);
  }

  fn jsx_identifier(&mut self, ident: &JSXIdentifier<'a>, slot: Slot) -> NodeId {
    self.name_node(Kind::JSXIdentifier, slot, ident.span, ident.name.as_str())
  }

  fn jsx_namespaced_name(&mut self, name: &JSXNamespacedName<'a>, slot: Slot) {
    let id = self.open(Kind::JSXNamespacedName, slot, name.span);
    self.jsx_identifier(&name.namespace, Slot::Namespace);
    self.jsx_identifier(&name.name, Slot::Name);
    self.close(id);
  }

  /// `this` in a tag name is a reference to nothing.
  fn jsx_this(&mut self, span: Span, slot: Slot, is_reference: bool) {
    let id = self.name_node(Kind::JSXIdentifier, slot, span, "this");
    self.flag_if(id, is_reference, ir::REFERENCE | ir::READ);
  }

  fn jsx_element_name(&mut self, name: &JSXElementName<'a>, slot: Slot) {
    match name {
      JSXElementName::Identifier(ident) => {
        self.jsx_identifier(ident, slot);
      }
      JSXElementName::IdentifierReference(ident) => {
        self.reference(ident, Kind::JSXIdentifier, slot);
      }
      JSXElementName::NamespacedName(name) => self.jsx_namespaced_name(name, slot),
      JSXElementName::MemberExpression(member) => self.jsx_member_expression(member, slot),
      JSXElementName::ThisExpression(this) => self.jsx_this(this.span, slot, true),
    }
  }

  fn jsx_member_expression(&mut self, member: &JSXMemberExpression<'a>, slot: Slot) {
    let id = self.open(Kind::JSXMemberExpression, slot, member.span);

    match &member.object {
      JSXMemberExpressionObject::IdentifierReference(ident) => {
        self.reference(ident, Kind::JSXIdentifier, Slot::Object);
      }
      JSXMemberExpressionObject::MemberExpression(object) => {
        self.jsx_member_expression(object, Slot::Object);
      }
      JSXMemberExpressionObject::ThisExpression(this) => {
        self.jsx_this(this.span, Slot::Object, false);
      }
    }
    self.jsx_identifier(&member.property, Slot::Property);

    self.close(id);
  }
}

#[derive(Clone, Copy)]
struct DefinitionSite {
  kind: DefinitionKind,
  node: NodeId,
  parent: NodeId,
}

impl DefinitionSite {
  fn other() -> Self {
    Self {
      kind: DefinitionKind::Other,
      node: NONE,
      parent: NONE,
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  /// Each node's parent and ancestors from one walk in tree order, for comparison.
  fn walked_parents(ast: &Ast) -> Vec<Option<NodeId>> {
    let mut open: Vec<NodeId> = Vec::new();
    (0..ast.nodes.len() as NodeId)
      .map(|id| {
        while open.last().is_some_and(|&last| ast.next(last) <= id) {
          open.pop();
        }
        let parent = open.last().copied();
        open.push(id);
        parent
      })
      .collect()
  }

  fn assert_found_parents(ast: &Ast, file: &str) {
    let parents = walked_parents(ast);
    for id in 0..ast.nodes.len() as NodeId {
      assert_eq!(ast.parent(id), parents[id as usize], "{file} node {id}");
      let mut walked = Vec::new();
      let mut current = parents[id as usize];
      while let Some(ancestor) = current {
        walked.push(ancestor);
        current = parents[ancestor as usize];
      }
      assert_eq!(ast.ancestors(id).collect::<Vec<_>>(), walked, "{file} node {id}");
    }
  }

  #[test]
  fn parents_are_found_from_the_root() {
    let code = "@d class A { m(@p x) { if (a) { return [b, { c: () => d?.e }]; } } }\nconst f = 1;\n";
    let ast = lower(code, Lang::Ts).unwrap();
    assert_found_parents(&ast, "a.ts");
    assert_eq!(ast.parent(0), None);
  }

  /// Set `PARAGLIDE_PARENTS_DIR` to a project's sources to check every node of every script.
  #[test]
  #[ignore]
  fn parents_are_found_in_a_project() {
    let directory = std::env::var("PARAGLIDE_PARENTS_DIR").expect("PARAGLIDE_PARENTS_DIR");
    let mut stack = vec![std::path::PathBuf::from(directory)];
    let mut files = 0;

    while let Some(path) = stack.pop() {
      if path.is_dir() {
        stack.extend(std::fs::read_dir(&path).unwrap().map(|entry| entry.unwrap().path()));
        continue;
      }
      let file = path.to_string_lossy();
      if !crate::languages::is_script(&file) {
        continue;
      }
      let code = std::fs::read_to_string(&path).unwrap();
      if let Ok(ast) = lower(&code, Lang::of_script(&file)) {
        files += 1;
        assert_found_parents(&ast, &file);
      }
    }
    assert!(files > 0);
  }

  #[test]
  fn a_decorated_parameter_keeps_its_variable_and_its_children() {
    let code = "class A { m(@dec x, y) { return x + y; } }";
    let ast = lower(code, Lang::Ts).unwrap_or_default();
    let named = |name: &str| -> Vec<NodeId> {
      (0..ast.nodes.len() as NodeId)
        .filter(|&id| ast.kind(id) == Kind::Identifier && ast.text(id) == name)
        .collect()
    };

    let [declared_x, read_x] = named("x")[..] else {
      panic!("two x");
    };
    let [declared_y, read_y] = named("y")[..] else {
      panic!("two y");
    };

    assert_eq!(ast.children(declared_x).count(), 1);
    assert_eq!(ast.next(declared_y), declared_y + 1);
    assert_ne!(ast.symbol(declared_x), NONE);
    assert_eq!(ast.symbol(read_x), ast.symbol(declared_x));
    assert_eq!(ast.symbol(read_y), ast.symbol(declared_y));
    assert_ne!(ast.symbol(declared_x), ast.symbol(declared_y));
  }
}
