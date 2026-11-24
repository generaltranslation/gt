use serde::Deserialize;
use swc_core::common::{SyntaxContext, DUMMY_SP};
use swc_core::ecma::{ast::*, atoms::Atom};

/// The `pageSegments` plugin option: wrap each server page of the App Router
/// in gt-next's `GtSegment`.
#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PageSegmentsConfig {
  /// The App Router directory from the project directory: `app` or `src/app`.
  pub app_dir: String,
  /// The `pageExtensions` of the Next.js config.
  pub page_extensions: Vec<String>,
  /// Starts the `id` of every `GtSegment`, so the build step finds the pages
  /// that were wrapped in their compiled output.
  pub id_prefix: String,
}

pub const SEGMENT_SOURCE: &str = "gt-next/internal/_segment";
const SEGMENT_IMPORTED: &str = "GtSegment";
const SEGMENT_LOCAL: &str = "GtNext_Segment";
const PAGE_LOCAL: &str = "GtNext_Page";
const WRAPPER_NAME: &str = "GtNext_SegmentPage";
const PROPS_NAME: &str = "props";
const SERVER_REFERENCE_SOURCE: &str = "private-next-rsc-server-reference";
const SERVER_REFERENCE_IMPORTED: &str = "registerServerReference";

/// The paths `filename` can have from the project directory `cwd`, with `/`
/// separators: Turbopack names files from its root, any ancestor of `cwd`.
fn project_relative_paths(filename: &str, cwd: &str) -> Vec<String> {
  let filename = filename.replace('\\', "/");
  let cwd = cwd.replace('\\', "/");
  let cwd = cwd.trim_end_matches('/');
  let is_absolute = filename.starts_with('/') || filename.as_bytes().get(1) == Some(&b':');
  if is_absolute {
    return filename
      .strip_prefix(cwd)
      .and_then(|path| path.strip_prefix('/'))
      .map(str::to_string)
      .into_iter()
      .collect();
  }
  let parts: Vec<&str> = cwd.split('/').filter(|part| !part.is_empty()).collect();
  (0..=parts.len())
    .filter_map(|start| {
      let cwd_from_root = parts[start..].join("/");
      if cwd_from_root.is_empty() {
        return Some(filename.clone());
      }
      filename
        .strip_prefix(&cwd_from_root)?
        .strip_prefix('/')
        .map(str::to_string)
    })
    .collect()
}

fn page_id_from_project(relative: &str, config: &PageSegmentsConfig) -> Option<String> {
  let in_app = relative
    .strip_prefix(config.app_dir.trim_matches('/'))?
    .strip_prefix('/')?;
  let (directory, basename) = in_app.rsplit_once('/').unwrap_or(("", in_app));
  let extension = basename.strip_prefix("page.")?;
  if !config
    .page_extensions
    .iter()
    .any(|page_extension| page_extension == extension)
  {
    return None;
  }
  Some(if directory.is_empty() {
    "app/page".to_string()
  } else {
    format!("app/{directory}/page")
  })
}

/// The id of a page file of the App Router, as Turbopack names its entry:
/// `app/` and its path in the app directory, without the extension. None when
/// the paths the file can have name different pages.
pub fn page_id(filename: &str, cwd: &str, config: &PageSegmentsConfig) -> Option<String> {
  let mut ids = project_relative_paths(filename, cwd)
    .into_iter()
    .filter_map(|relative| page_id_from_project(&relative, config));
  let id = ids.next()?;
  ids.all(|other| other == id).then_some(id)
}

/// The file name as the plugin receives it, with `/` separators and without
/// the extension: the build step matches it to the key of the page's entry,
/// whatever the id guessed.
fn page_file(filename: &str) -> String {
  let filename = filename.replace('\\', "/");
  match filename.rsplit_once('/') {
    Some((directory, _)) => format!("{directory}/page"),
    None => "page".to_string(),
  }
}

/// Percent-encodes every byte but `A-Z a-z 0-9 / _ . -`, so the id is valid
/// in a string literal of any quote style.
pub fn encode_page_id(id: &str) -> String {
  id.bytes()
    .map(|byte| {
      if byte.is_ascii_alphanumeric() || matches!(byte, b'/' | b'_' | b'.' | b'-') {
        (byte as char).to_string()
      } else {
        format!("%{byte:02X}")
      }
    })
    .collect()
}

fn has_directive(module: &Module) -> bool {
  module
    .body
    .iter()
    .map_while(|item| match item {
      ModuleItem::Stmt(Stmt::Expr(ExprStmt { expr, .. })) => match &**expr {
        Expr::Lit(Lit::Str(directive)) => Some(directive.value.to_string_lossy().into_owned()),
        _ => None,
      },
      _ => None,
    })
    .any(|directive| directive != "use strict")
}

/// Whether the default export is a server reference, as Next.js compiles a
/// `'use cache'` page before this plugin runs: Next.js passes it props that a
/// wrapper would not pass on.
fn exports_server_reference_as_default(module: &Module) -> bool {
  let register = module.body.iter().find_map(|item| match item {
    ModuleItem::ModuleDecl(ModuleDecl::Import(import))
      if import.src.value == SERVER_REFERENCE_SOURCE =>
    {
      import
        .specifiers
        .iter()
        .find_map(|specifier| match specifier {
          ImportSpecifier::Named(named) => {
            let imported = match &named.imported {
              Some(ModuleExportName::Ident(imported)) => &imported.sym,
              Some(ModuleExportName::Str(_)) => return None,
              None => &named.local.sym,
            };
            (imported == SERVER_REFERENCE_IMPORTED).then(|| named.local.sym.clone())
          }
          _ => None,
        })
    }
    _ => None,
  });
  let default_export = module.body.iter().find_map(|item| match item {
    ModuleItem::ModuleDecl(ModuleDecl::ExportDefaultExpr(ExportDefaultExpr { expr, .. })) => {
      match &**expr {
        Expr::Ident(name) => Some(name.sym.clone()),
        _ => None,
      }
    }
    ModuleItem::ModuleDecl(ModuleDecl::ExportDefaultDecl(ExportDefaultDecl {
      decl: DefaultDecl::Fn(FnExpr {
        ident: Some(name), ..
      }),
      ..
    })) => Some(name.sym.clone()),
    _ => None,
  });
  let (Some(register), Some(default_export)) = (register, default_export) else {
    return false;
  };
  module.body.iter().any(|item| {
    let ModuleItem::Stmt(Stmt::Expr(ExprStmt { expr, .. })) = item else {
      return false;
    };
    let Expr::Call(CallExpr {
      callee: Callee::Expr(callee),
      args,
      ..
    }) = &**expr
    else {
      return false;
    };
    matches!(&**callee, Expr::Ident(callee) if callee.sym == register)
      && matches!(
        args.first(),
        Some(ExprOrSpread { spread: None, expr }) if matches!(&**expr, Expr::Ident(name) if name.sym == default_export)
      )
  })
}

const DYNAMIC: &str = "dynamic";

fn is_dynamic(name: &ModuleExportName) -> bool {
  match name {
    ModuleExportName::Ident(name) => &*name.sym == DYNAMIC,
    ModuleExportName::Str(name) => name.value == DYNAMIC,
  }
}

/// Whether the page can export a `dynamic` that makes it static: it would be
/// prerendered once, with a locale that need not be the request's, while the
/// root layout above it renders for each request. Only a `const` set to the
/// string literal `'auto'` or `'force-dynamic'` is known not to.
fn may_be_static(module: &Module) -> bool {
  module.body.iter().any(|item| match item {
    ModuleItem::ModuleDecl(ModuleDecl::ExportDecl(ExportDecl { decl, .. })) => match decl {
      Decl::Var(var) => var.decls.iter().any(|declarator| match &declarator.name {
        Pat::Ident(name) => {
          &*name.id.sym == DYNAMIC
            && !(var.kind == VarDeclKind::Const
              && matches!(
                declarator.init.as_deref(),
                Some(Expr::Lit(Lit::Str(value))) if value.value == "auto" || value.value == "force-dynamic"
              ))
        }
        _ => true,
      }),
      Decl::Fn(FnDecl { ident, .. }) | Decl::Class(ClassDecl { ident, .. }) => {
        &*ident.sym == DYNAMIC
      }
      Decl::TsEnum(enum_decl) => &*enum_decl.id.sym == DYNAMIC,
      _ => false,
    },
    ModuleItem::ModuleDecl(ModuleDecl::ExportNamed(NamedExport { specifiers, .. })) => {
      specifiers.iter().any(|specifier| match specifier {
        ExportSpecifier::Named(ExportNamedSpecifier { orig, exported, .. }) => {
          is_dynamic(exported.as_ref().unwrap_or(orig))
        }
        ExportSpecifier::Namespace(ExportNamespaceSpecifier { name, .. }) => is_dynamic(name),
        ExportSpecifier::Default(_) => false,
      })
    }
    ModuleItem::ModuleDecl(ModuleDecl::ExportAll(_)) => true,
    _ => false,
  })
}

/// Whether `name` is a function declared in this module, or a `const` or
/// `let` set to an arrow or function expression.
fn declares_function(module: &Module, name: &Atom) -> bool {
  module.body.iter().any(|item| {
    let decl = match item {
      ModuleItem::Stmt(Stmt::Decl(decl)) => decl,
      ModuleItem::ModuleDecl(ModuleDecl::ExportDecl(ExportDecl { decl, .. })) => decl,
      _ => return false,
    };
    match decl {
      Decl::Fn(function) => !function.declare && function.ident.sym == *name,
      Decl::Var(var) => {
        !var.declare
          && matches!(var.kind, VarDeclKind::Const | VarDeclKind::Let)
          && var.decls.iter().any(|declarator| {
            matches!(&declarator.name, Pat::Ident(binding) if binding.id.sym == *name)
              && matches!(
                declarator.init.as_deref(),
                Some(Expr::Arrow(_) | Expr::Fn(_))
              )
          })
      }
      _ => false,
    }
  })
}

fn ident(name: &str) -> Ident {
  Ident::new(Atom::new(name), DUMMY_SP, SyntaxContext::empty())
}

fn jsx_name(name: &str) -> JSXElementName {
  JSXElementName::Ident(ident(name))
}

fn page_binding(page: Box<Expr>) -> ModuleItem {
  ModuleItem::Stmt(Stmt::Decl(Decl::Var(Box::new(VarDecl {
    span: DUMMY_SP,
    ctxt: SyntaxContext::empty(),
    kind: VarDeclKind::Const,
    declare: false,
    decls: vec![VarDeclarator {
      span: DUMMY_SP,
      name: Pat::Ident(ident(PAGE_LOCAL).into()),
      init: Some(page),
      definite: false,
    }],
  }))))
}

fn segment_import() -> ModuleItem {
  ModuleItem::ModuleDecl(ModuleDecl::Import(ImportDecl {
    span: DUMMY_SP,
    specifiers: vec![ImportSpecifier::Named(ImportNamedSpecifier {
      span: DUMMY_SP,
      local: ident(SEGMENT_LOCAL),
      imported: Some(ModuleExportName::Ident(ident(SEGMENT_IMPORTED))),
      is_type_only: false,
    })],
    src: Box::new(SEGMENT_SOURCE.into()),
    type_only: false,
    with: None,
    phase: Default::default(),
  }))
}

fn segment_attr(name: &str, value: &str) -> JSXAttrOrSpread {
  JSXAttrOrSpread::JSXAttr(JSXAttr {
    span: DUMMY_SP,
    name: JSXAttrName::Ident(IdentName::new(name.into(), DUMMY_SP)),
    value: Some(JSXAttrValue::Str(value.into())),
  })
}

fn segment_page(id: &str, file: &str) -> ModuleItem {
  let page = JSXElement {
    span: DUMMY_SP,
    opening: JSXOpeningElement {
      span: DUMMY_SP,
      name: jsx_name(PAGE_LOCAL),
      attrs: vec![JSXAttrOrSpread::SpreadElement(SpreadElement {
        dot3_token: DUMMY_SP,
        expr: Box::new(Expr::Ident(ident(PROPS_NAME))),
      })],
      self_closing: true,
      type_args: None,
    },
    children: vec![],
    closing: None,
  };
  let segment = JSXElement {
    span: DUMMY_SP,
    opening: JSXOpeningElement {
      span: DUMMY_SP,
      name: jsx_name(SEGMENT_LOCAL),
      attrs: vec![segment_attr("id", id), segment_attr("file", file)],
      self_closing: false,
      type_args: None,
    },
    children: vec![JSXElementChild::JSXElement(Box::new(page))],
    closing: Some(JSXClosingElement {
      span: DUMMY_SP,
      name: jsx_name(SEGMENT_LOCAL),
    }),
  };
  let function = Function {
    params: vec![Param {
      span: DUMMY_SP,
      decorators: vec![],
      pat: Pat::Ident(ident(PROPS_NAME).into()),
    }],
    decorators: vec![],
    span: DUMMY_SP,
    ctxt: SyntaxContext::empty(),
    body: Some(BlockStmt {
      span: DUMMY_SP,
      ctxt: SyntaxContext::empty(),
      stmts: vec![Stmt::Return(ReturnStmt {
        span: DUMMY_SP,
        arg: Some(Box::new(Expr::JSXElement(Box::new(segment)))),
      })],
    }),
    is_generator: false,
    is_async: false,
    type_params: None,
    return_type: None,
  };
  ModuleItem::ModuleDecl(ModuleDecl::ExportDefaultDecl(ExportDefaultDecl {
    span: DUMMY_SP,
    decl: DefaultDecl::Fn(FnExpr {
      ident: Some(ident(WRAPPER_NAME)),
      function: Box::new(function),
    }),
  }))
}

/// None for a default export that is not a function this module writes: an
/// imported or computed page can be a `'use cache'` function, which Next.js
/// handles differently only as the default export itself.
fn unexport_page(item: &ModuleItem, module: &Module) -> Option<Vec<ModuleItem>> {
  match item {
    ModuleItem::ModuleDecl(ModuleDecl::ExportDefaultDecl(ExportDefaultDecl {
      decl: DefaultDecl::Fn(FnExpr {
        ident: Some(name),
        function,
      }),
      ..
    })) => Some(vec![
      ModuleItem::Stmt(Stmt::Decl(Decl::Fn(FnDecl {
        ident: name.clone(),
        declare: false,
        function: function.clone(),
      }))),
      page_binding(Box::new(Expr::Ident(name.clone()))),
    ]),
    ModuleItem::ModuleDecl(ModuleDecl::ExportDefaultDecl(ExportDefaultDecl {
      decl: DefaultDecl::Fn(function @ FnExpr { ident: None, .. }),
      ..
    })) => Some(vec![page_binding(Box::new(Expr::Fn(function.clone())))]),
    ModuleItem::ModuleDecl(ModuleDecl::ExportDefaultExpr(ExportDefaultExpr { expr, .. })) => {
      match &**expr {
        Expr::Arrow(_) | Expr::Fn(_) => Some(vec![page_binding(expr.clone())]),
        Expr::Ident(name) if declares_function(module, &name.sym) => {
          Some(vec![page_binding(expr.clone())])
        }
        _ => None,
      }
    }
    _ => None,
  }
}

pub fn transform(
  program: &mut Program,
  config: Option<&PageSegmentsConfig>,
  filename: Option<&str>,
  cwd: Option<&str>,
) {
  if let (Some(config), Some(filename), Some(cwd), Program::Module(module)) =
    (config, filename, cwd, program)
  {
    wrap_page(module, filename, cwd, config);
  }
}

fn wrap_page(module: &mut Module, filename: &str, cwd: &str, config: &PageSegmentsConfig) {
  let Some(id) = page_id(filename, cwd, config) else {
    return;
  };
  if has_directive(module) || exports_server_reference_as_default(module) || may_be_static(module) {
    return;
  }
  let Some((index, replacement)) =
    module.body.iter().enumerate().find_map(|(index, item)| {
      unexport_page(item, module).map(|replacement| (index, replacement))
    })
  else {
    return;
  };
  module.body.splice(index..=index, replacement);
  module.body.push(segment_page(
    &format!("{}{}", config.id_prefix, encode_page_id(&id)),
    &encode_page_id(&page_file(filename)),
  ));
  module.body.insert(0, segment_import());
}

#[cfg(test)]
mod tests {
  use super::*;
  use swc_core::common::{sync::Lrc, FileName, SourceMap};
  use swc_core::ecma::codegen::{to_code_default, Node};
  use swc_core::ecma::parser::{Parser, StringInput, Syntax, TsSyntax};

  const CWD: &str = "/repo/apps/web";
  const PAGE: &str = "/repo/apps/web/app/orders/page.tsx";
  const ID_PREFIX: &str = "test-page:";

  fn config(app_dir: &str, page_extensions: &[&str]) -> PageSegmentsConfig {
    PageSegmentsConfig {
      app_dir: app_dir.to_string(),
      page_extensions: page_extensions
        .iter()
        .map(|extension| extension.to_string())
        .collect(),
      id_prefix: ID_PREFIX.to_string(),
    }
  }

  fn app() -> PageSegmentsConfig {
    config("app", &["tsx", "ts", "jsx", "js"])
  }

  fn parse(code: &str) -> Module {
    let cm: Lrc<SourceMap> = Default::default();
    let file = cm.new_source_file(FileName::Anon.into(), code.to_string());
    let syntax = Syntax::Typescript(TsSyntax {
      tsx: true,
      ..Default::default()
    });
    Parser::new(syntax, StringInput::from(&*file), None)
      .parse_module()
      .map_err(|error| format!("{error:?}"))
      .unwrap_or_else(|error| panic!("{error}"))
  }

  fn code(node: &impl Node) -> String {
    to_code_default(Default::default(), None, node)
  }

  fn transformed(code: &str, filename: &str, config: Option<&PageSegmentsConfig>) -> Module {
    let mut program = Program::Module(parse(code));
    transform(&mut program, config, Some(filename), Some(CWD));
    match program {
      Program::Module(module) => module,
      Program::Script(_) => panic!("not a module"),
    }
  }

  /// What a wrapped page renders, read from its structure rather than from
  /// the names the plugin gives its bindings.
  #[derive(Debug, PartialEq)]
  struct WrappedPage {
    id: String,
    file: String,
    page: String,
    rest: String,
  }

  fn read_wrapped_page(module: &Module) -> Option<WrappedPage> {
    let (import_index, segment) = module.body.iter().enumerate().find_map(|(index, item)| {
      let ModuleItem::ModuleDecl(ModuleDecl::Import(import)) = item else {
        return None;
      };
      if import.src.value != SEGMENT_SOURCE {
        return None;
      }
      match import.specifiers.as_slice() {
        [ImportSpecifier::Named(ImportNamedSpecifier {
          local,
          imported: Some(ModuleExportName::Ident(imported)),
          ..
        })]
          if imported.sym == SEGMENT_IMPORTED =>
        {
          Some((index, local.sym.clone()))
        }
        _ => None,
      }
    })?;
    let (wrapper_index, id, file, page_name) =
      module.body.iter().enumerate().find_map(|(index, item)| {
        let ModuleItem::ModuleDecl(ModuleDecl::ExportDefaultDecl(ExportDefaultDecl {
          decl: DefaultDecl::Fn(FnExpr { function, .. }),
          ..
        })) = item
        else {
          return None;
        };
        let [Param {
          pat: Pat::Ident(props),
          ..
        }] = function.params.as_slice()
        else {
          return None;
        };
        let [Stmt::Return(ReturnStmt {
          arg: Some(rendered),
          ..
        })] = function.body.as_ref()?.stmts.as_slice()
        else {
          return None;
        };
        let Expr::JSXElement(outer) = &**rendered else {
          return None;
        };
        let JSXElementName::Ident(outer_name) = &outer.opening.name else {
          return None;
        };
        let [JSXAttrOrSpread::JSXAttr(JSXAttr {
          name: JSXAttrName::Ident(id_attribute),
          value: Some(JSXAttrValue::Str(id)),
          ..
        }), JSXAttrOrSpread::JSXAttr(JSXAttr {
          name: JSXAttrName::Ident(file_attribute),
          value: Some(JSXAttrValue::Str(file)),
          ..
        })] = outer.opening.attrs.as_slice()
        else {
          return None;
        };
        let [JSXElementChild::JSXElement(inner)] = outer.children.as_slice() else {
          return None;
        };
        let JSXElementName::Ident(inner_name) = &inner.opening.name else {
          return None;
        };
        let [JSXAttrOrSpread::SpreadElement(SpreadElement { expr: spread, .. })] =
          inner.opening.attrs.as_slice()
        else {
          return None;
        };
        let forwards_props = matches!(&**spread, Expr::Ident(spread) if spread.sym == props.sym);
        (outer_name.sym == segment
          && &*id_attribute.sym == "id"
          && &*file_attribute.sym == "file"
          && forwards_props
          && inner.children.is_empty())
        .then(|| {
          (
            index,
            id.value.to_string_lossy().into_owned(),
            file.value.to_string_lossy().into_owned(),
            inner_name.sym.clone(),
          )
        })
      })?;
    let (binding_index, page) = module.body.iter().enumerate().find_map(|(index, item)| {
      let ModuleItem::Stmt(Stmt::Decl(Decl::Var(var))) = item else {
        return None;
      };
      match var.decls.as_slice() {
        [VarDeclarator {
          name: Pat::Ident(name),
          init: Some(init),
          ..
        }] if name.sym == page_name => Some((index, code(&**init))),
        _ => None,
      }
    })?;
    let rest = Module {
      body: module
        .body
        .iter()
        .enumerate()
        .filter(|(index, _)| ![import_index, wrapper_index, binding_index].contains(index))
        .map(|(_, item)| item.clone())
        .collect(),
      ..module.clone()
    };
    Some(WrappedPage {
      id,
      file,
      page,
      rest: code(&rest),
    })
  }

  fn expression(source: &str) -> String {
    let module = parse(&format!("const page = {source};"));
    match module.body.as_slice() {
      [ModuleItem::Stmt(Stmt::Decl(Decl::Var(var)))] => {
        code(&**var.decls[0].init.as_ref().expect("an initializer"))
      }
      _ => panic!("not an expression: {source}"),
    }
  }

  #[test]
  fn wraps_each_supported_default_export() {
    let named_exports = "export const dynamic = 'force-dynamic';\nexport async function generateMetadata() { return {}; }";
    for (page, page_expression, declarations) in [
      (
        "export default function Orders(props) { return <p />; }",
        "Orders",
        "function Orders(props) { return <p />; }",
      ),
      (
        "export default async function Orders() { return <p />; }",
        "Orders",
        "async function Orders() { return <p />; }",
      ),
      (
        "export default function () { return <p />; }",
        "function () { return <p />; }",
        "",
      ),
      (
        "const Orders = () => <p />;\nexport default Orders;",
        "Orders",
        "const Orders = () => <p />;",
      ),
      (
        "let Orders = async function () { return <p />; };\nexport default Orders;",
        "Orders",
        "let Orders = async function () { return <p />; };",
      ),
      (
        "export default Orders;\nexport function Orders() { return <p />; }",
        "Orders",
        "export function Orders() { return <p />; }",
      ),
      (
        "export default async ({ params }) => <p>{(await params).id}</p>;",
        "async ({ params }) => <p>{(await params).id}</p>",
        "",
      ),
    ] {
      assert_eq!(
        read_wrapped_page(&transformed(
          &format!("{named_exports}\n{page}"),
          PAGE,
          Some(&app())
        )),
        Some(WrappedPage {
          id: format!("{ID_PREFIX}app/orders/page"),
          file: "/repo/apps/web/app/orders/page".to_string(),
          page: expression(page_expression),
          rest: code(&parse(&format!("{named_exports}\n{declarations}"))),
        }),
        "{page}"
      );
    }
  }

  #[test]
  fn wraps_only_a_page_whose_dynamic_export_cannot_make_it_static() {
    let page = "export default function Orders() { return <p />; }";
    for (exports, wraps) in [
      ("", true),
      ("export const dynamic = 'auto';", true),
      ("export const dynamic = \"force-dynamic\";", true),
      (
        "export const revalidate = 60, dynamic = 'force-dynamic';",
        true,
      ),
      ("const dynamic = 'force-static';", true),
      ("export const dynamic = 'force-static';", false),
      ("export const dynamic = 'error';", false),
      (
        "export const revalidate = 60, dynamic = 'force-static';",
        false,
      ),
      ("export const dynamic = `force-static`;", false),
      ("export const dynamic = `force-dynamic`;", false),
      ("export const dynamic = mode;", false),
      ("export const dynamic = 'force-dynamic' as const;", false),
      ("export const dynamic = 'unknown';", false),
      ("export let dynamic = 'auto';", false),
      ("export const { dynamic } = config;", false),
      (
        "const dynamic = 'force-dynamic';\nexport { dynamic };",
        false,
      ),
      (
        "const mode = 'force-dynamic';\nexport { mode as dynamic };",
        false,
      ),
      ("export { dynamic } from './config';", false),
      ("export * from './config';", false),
    ] {
      let code_before = format!("{exports}\n{page}");
      let module = transformed(&code_before, PAGE, Some(&app()));
      assert_eq!(read_wrapped_page(&module).is_some(), wraps, "{exports}");
      if !wraps {
        assert_eq!(code(&module), code(&parse(&code_before)), "{exports}");
      }
    }
  }

  #[test]
  fn writes_the_file_name_it_received_beside_the_id() {
    for (filename, file) in [
      (
        "apps/web/app/(shop)/cart/page.tsx",
        "apps/web/app/%28shop%29/cart/page",
      ),
      (
        "/repo/apps/web/app/page.page.tsx",
        "/repo/apps/web/app/page",
      ),
      (
        "apps\\web\\app\\orders\\page.tsx",
        "apps/web/app/orders/page",
      ),
    ] {
      let page = read_wrapped_page(&transformed(
        "export default function Page() { return <p />; }",
        filename,
        Some(&config("app", &["tsx", "page.tsx"])),
      ));
      assert_eq!(
        page.map(|page| page.file).as_deref(),
        Some(file),
        "{filename}"
      );
    }
  }

  #[test]
  fn leaves_files_it_does_not_wrap_unchanged() {
    let page = "export default function Page() { return <p />; }";
    // A 'use cache' page as Next.js compiles it before this plugin runs.
    let cached_page = r#"import { registerServerReference } from "private-next-rsc-server-reference";
import { cache as $$cache__ } from "private-next-rsc-cache-wrapper";
const $$RSC_SERVER_CACHE_0_INNER = async function Page({ params }) { return <p>{(await params).id}</p>; };
export var $$RSC_SERVER_CACHE_0 = function Page() { return $$cache__("default", "c0", 0, $$RSC_SERVER_CACHE_0_INNER, Array.prototype.slice.call(arguments, 0, 1)); };
registerServerReference($$RSC_SERVER_CACHE_0, "c0", null);
export default $$RSC_SERVER_CACHE_0;"#;
    for (code_before, filename, config) in [
      (format!("'use client';\n{page}"), PAGE, app()),
      (format!("\"use server\";\n{page}"), PAGE, app()),
      (cached_page.to_string(), PAGE, app()),
      (
        page.to_string(),
        "/repo/apps/web/app/orders/layout.tsx",
        app(),
      ),
      (
        page.to_string(),
        "/repo/apps/web/app/orders/template.tsx",
        app(),
      ),
      (
        page.to_string(),
        "/repo/apps/web/app/orders/page.test.tsx",
        app(),
      ),
      (
        page.to_string(),
        "/repo/apps/web/app/orders/page.tsx/__nextjs-internal-proxy.mjs",
        app(),
      ),
      (
        page.to_string(),
        "/repo/apps/web/pages/orders/page.tsx",
        app(),
      ),
      (
        page.to_string(),
        "/repo/apps/web/src/app/orders/page.tsx",
        app(),
      ),
      (
        page.to_string(),
        "/repo/apps/other/app/orders/page.tsx",
        app(),
      ),
      (page.to_string(), PAGE, config("app", &["js"])),
      (
        "export class Page {}\nexport { Page as default };".to_string(),
        PAGE,
        app(),
      ),
      ("export default class Page {}".to_string(), PAGE, app()),
      (
        "import Page from './cached';\nexport default Page;".to_string(),
        PAGE,
        app(),
      ),
      ("export default withAuth(Page);".to_string(), PAGE, app()),
      (
        "const Page = withAuth(function () { return <p />; });\nexport default Page;".to_string(),
        PAGE,
        app(),
      ),
      (
        "var Page = () => <p />;\nexport default Page;".to_string(),
        PAGE,
        app(),
      ),
      ("export default Page;".to_string(), PAGE, app()),
      ("export const metadata = {};".to_string(), PAGE, app()),
    ] {
      assert_eq!(
        code(&transformed(&code_before, filename, Some(&config))),
        code(&parse(&code_before)),
        "{filename}: {code_before}"
      );
    }
  }

  #[test]
  fn leaves_every_file_unchanged_without_the_option() {
    let page = "export default function Page() { return <p />; }";
    assert_eq!(code(&transformed(page, PAGE, None)), code(&parse(page)));
  }

  #[test]
  fn names_pages_as_turbopack_names_their_entries() {
    let src_app = config("src/app", &["tsx", "ts", "jsx", "js"]);
    for (filename, cwd, config, id) in [
      (PAGE, CWD, app(), Some("app/orders/page")),
      ("/repo/apps/web/app/page.js", CWD, app(), Some("app/page")),
      (
        "repo/apps/web/app/(shop)/cart/page.tsx",
        CWD,
        app(),
        Some("app/(shop)/cart/page"),
      ),
      (
        "apps/web/app/item/[id]/page.jsx",
        CWD,
        app(),
        Some("app/item/[id]/page"),
      ),
      (
        "web/app/dash/@panel/page.ts",
        CWD,
        app(),
        Some("app/dash/@panel/page"),
      ),
      ("app/orders/page.tsx", CWD, app(), Some("app/orders/page")),
      ("app/web/page.tsx", "/repo/web", app(), Some("app/web/page")),
      // A project in a directory named app, read from it or from its parent.
      ("app/page.tsx", "/srv/app", app(), Some("app/page")),
      (
        "app/orders/page.tsx",
        "/srv/app",
        app(),
        Some("app/orders/page"),
      ),
      ("app/app/orders/page.tsx", "/srv/app", app(), None),
      ("app/app/page.tsx", "/srv/app", app(), None),
      (
        "src/app/orders/page.tsx",
        "/srv/src",
        src_app.clone(),
        Some("app/orders/page"),
      ),
      (
        "/repo/apps/web/src/app/orders/page.tsx",
        CWD,
        src_app.clone(),
        Some("app/orders/page"),
      ),
      (
        "C:\\repo\\web\\app\\orders\\page.tsx",
        "C:\\repo\\web",
        app(),
        Some("app/orders/page"),
      ),
      (
        "/repo/apps/web/app/orders/page.page.tsx",
        CWD,
        config("app", &["page.tsx"]),
        Some("app/orders/page"),
      ),
      (
        "/repo/apps/web/app/orders/page.tsx",
        CWD,
        config("app", &["page.tsx"]),
        None,
      ),
      ("/repo/apps/web/app/orders/page.mdx", CWD, app(), None),
      (
        "/repo/apps/web/app/orders/page.tsx",
        "/repo/apps/we",
        app(),
        None,
      ),
      ("/repo/apps/web/app/page.tsx", CWD, src_app, None),
    ] {
      assert_eq!(
        page_id(filename, cwd, &config).as_deref(),
        id,
        "{filename} in {cwd}"
      );
    }
  }

  #[test]
  fn encodes_page_ids_as_the_build_step_does() {
    let vectors: Vec<(String, String)> = serde_json::from_str(include_str!(
      "../../src/plugin/__tests__/pageIdEncodings.json"
    ))
    .unwrap_or_else(|error| panic!("{error}"));
    for (id, encoded) in vectors {
      assert_eq!(encode_page_id(&id), encoded, "{id}");
    }
  }

  #[test]
  fn reads_the_option_from_the_plugin_config() {
    let page_segments = |json: &str| {
      serde_json::from_str::<crate::config::PluginConfig>(json)
        .map(|config| {
          config
            .page_segments
            .map(|page_segments| format!("{page_segments:?}"))
        })
        .ok()
    };
    assert_eq!(page_segments("{}"), Some(None));
    assert_eq!(
      page_segments(
        r#"{"pageSegments":{"appDir":"src/app","pageExtensions":["tsx","mdx"],"idPrefix":"gt-next-page:"}}"#
      ),
      Some(Some(format!(
        "{:?}",
        PageSegmentsConfig {
          app_dir: "src/app".to_string(),
          page_extensions: vec!["tsx".to_string(), "mdx".to_string()],
          id_prefix: "gt-next-page:".to_string(),
        }
      )))
    );
  }
}
