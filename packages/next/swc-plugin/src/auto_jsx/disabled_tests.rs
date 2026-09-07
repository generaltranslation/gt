//! Compare disabled insertion with the pipeline/configuration at 36d34236db344.
//! The existing visitor, collector, hash, and logging implementations are
//! unchanged by this feature; retain the old entry here as an independent gate
//! regression reference. Compare complete printed output and panic diagnostics.
#![allow(clippy::unwrap_used)]

use std::panic::{catch_unwind, AssertUnwindSafe};

use serde::Deserialize;
use serde_json::json;
use swc_core::{
  common::{
    comments::SingleThreadedComments, sync::Lrc, FileName, Globals, Mark, SourceMap, GLOBALS,
  },
  ecma::{
    ast::{Pass, Program},
    codegen::to_code_default,
    parser::{parse_file_as_program, Syntax, TsSyntax},
    transforms::base::{fixer::fixer, hygiene::hygiene, resolver},
    visit::{FoldWith, VisitMutWith},
  },
};

use crate::{
  ast::StringCollector, config::PluginConfig, logging::LogLevel, transform_program_with_comments,
  visitor::TransformVisitor,
};

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct LegacyConfig {
  #[serde(default)]
  log_level: LogLevel,
  #[serde(default)]
  compile_time_hash: bool,
  #[serde(default)]
  filename: Option<String>,
  #[serde(default)]
  disable_build_checks: bool,
  #[serde(default)]
  autoderive_jsx: bool,
  #[serde(default)]
  autoderive_strings: bool,
}

fn legacy_transform(mut program: Program, input: &str, filename: Option<String>) -> Program {
  let config: LegacyConfig = serde_json::from_str(input).unwrap_or_default();
  let string_collector = StringCollector::new();
  if !config.compile_time_hash {
    return program;
  }
  let mut visitor = TransformVisitor::new(
    config.log_level.clone(),
    config.compile_time_hash,
    filename.clone(),
    config.disable_build_checks,
    config.autoderive_jsx,
    config.autoderive_strings,
    string_collector,
  );
  program.visit_mut_with(&mut visitor);
  if !config.disable_build_checks && visitor.statistics.dynamic_content_violations > 0 {
    panic!(
      "gt-next: Error: {} dynamic content violations found",
      visitor.statistics.dynamic_content_violations
    );
  }
  let mut visitor = TransformVisitor::new(
    config.log_level,
    config.compile_time_hash,
    filename,
    config.disable_build_checks,
    config.autoderive_jsx,
    config.autoderive_strings,
    visitor.string_collector,
  );
  program.fold_with(&mut visitor)
}

fn transform(
  source: &str,
  config: &str,
  filename: Option<&str>,
  legacy: bool,
  direct_loader_context: bool,
) -> Result<String, String> {
  catch_unwind(AssertUnwindSafe(|| {
    GLOBALS.set(&Globals::new(), || {
      let cm: Lrc<SourceMap> = Default::default();
      let file = cm.new_source_file(
        FileName::Custom("input.tsx".into()).into(),
        source.to_owned(),
      );
      let comments = SingleThreadedComments::default();
      let mut errors = Vec::new();
      let mut program = parse_file_as_program(
        &file,
        Syntax::Typescript(TsSyntax {
          tsx: true,
          decorators: true,
          ..Default::default()
        }),
        Default::default(),
        Some(&comments),
        &mut errors,
      )
      .unwrap();
      assert!(errors.is_empty(), "{errors:?}");
      resolver(Mark::new(), Mark::new(), true).process(&mut program);
      let filename = filename.map(str::to_owned);
      let mut program = if legacy {
        legacy_transform(program, config, filename)
      } else {
        let mut config = PluginConfig::parse(config);
        // Also exercise callers with an already-constructed configuration:
        // the pass gate must hold independently of JSON deserialization.
        if direct_loader_context {
          config.jsx_import_source_from_loader = true;
          config.missing_jsx_runtime_context_diagnostic = Some("AUTO CONTEXT MUST NOT RUN".into());
        }
        transform_program_with_comments(program, config, filename, Some(&comments))
      };
      hygiene().process(&mut program);
      fixer(Some(&comments)).process(&mut program);
      to_code_default(cm, Some(&comments), &program)
    })
  }))
  .map_err(|error| {
    error
      .downcast_ref::<String>()
      .cloned()
      .or_else(|| {
        error
          .downcast_ref::<&str>()
          .map(|value| (*value).to_owned())
      })
      .unwrap_or_else(|| "non-string panic".into())
  })
}

const SOURCES: &[&str] = &[
  "'use client'; export const Page = () => <p>Hello {name}</p>;",
  "import { T } from 'gt-next'; export const Page = () => <T>Manual</T>;",
  "import { T, Var } from 'gt-next'; export const Page = () => <T>Hello <Var>{name}</Var></T>;",
  "import { T } from 'gt-next'; export const Page = () => <T>Dynamic {name}</T>;",
  "import { T } from 'gt-next'; export const Page = () => <T>{first}{second()}</T>;",
  "import { useGT } from 'gt-next'; export function Page() { const gt = useGT(); return gt('Hello'); }",
  "import { useGT } from 'gt-next'; export function Page() { const gt = useGT(); return gt(`Hello ${name}`); }",
  "import { getGT } from 'gt-next/server'; export async function Page() { const gt = await getGT(); return gt('Hello ' + name); }",
  "import { T, Var } from 'gt-next'; export const Page = () => <T id='manual' context='place'>Hi <b><Var>{name}</Var></b></T>;",
  "import { T } from 'gt-next'; export function Page(T) { return <T>Shadow {name}</T>; }",
  "import { jsx as make } from 'react/jsx-runtime'; export const Page = () => make('p', {children: ['Hello ', name]});",
  "/** @jsxImportSource @emotion/react */ import { T } from 'gt-next'; export const Page = () => <><T>Manual</T><p>Auto {name}</p></>;",
  "/** @jsxRuntime classic @jsx React.createElement */ import React from 'react'; export const Page = () => <p>Hello {name}</p>;",
  "export const Page = () => <main>Hello <style jsx>{`main{color:red}`}</style><textarea>Editor {name}</textarea></main>;",
  "// Retain source markers and comments\nexport const Page = () => <p>Hello</p>;\n;\n'__GT_AUTO_JSX_IMPORT_SOURCE__:react'; // EOF",
  "import { T } from 'gt-next'; export const Page = () => <T>Manual</T>;\n;\n'__GT_AUTO_JSX_IMPORT_SOURCE__:@emotion/react';",
];

#[test]
fn disabled_all_existing_transform_combinations_match_the_pre_feature_pipeline() {
  for bits in 0..16 {
    for explicit_false in [false, true] {
      let mut config = json!({
        "logLevel": "silent",
        "compileTimeHash": bits & 1 != 0,
        "disableBuildChecks": bits & 2 != 0,
        "autoderiveJsx": bits & 4 != 0,
        "autoderiveStrings": bits & 8 != 0,
        "filename": "/ignored/config-filename.tsx",
      });
      if explicit_false {
        config["enableAutoJsxInjection"] = json!(false);
      }
      let config = config.to_string();
      for filename in [
        None,
        Some("/app/page.tsx"),
        Some("C:\\project\\page.tsx?loader=1"),
      ] {
        for source in SOURCES {
          assert_eq!(
            transform(source, &config, filename, false, false),
            transform(source, &config, filename, true, false),
            "source: {source}\nconfig: {config}\nfilename: {filename:?}"
          );
        }
      }
    }
  }
}

#[test]
fn disabled_auto_metadata_never_changes_code_or_existing_diagnostics() {
  let overrides = [
    json!({"jsxImportSourceFromLoader": true}),
    json!({"jsxImportSourceFromLoader": true, "missingJsxRuntimeContextDiagnostic": "AUTO CONTEXT MUST NOT RUN"}),
    json!({"autoJsxRuntimePackageRoots": ["/app", "C:\\project", "[project]"]}),
    json!({"jsxRuntime": "classic", "jsxImportSource": "@emotion/react"}),
    json!({"jsxRuntime": "invalid"}),
    json!({"jsxRuntime": {"unexpected": true}}),
    json!({"jsxImportSource": ["react"]}),
    json!({"autoJsxRuntimePackageRoots": 42}),
    json!({"autoJsxRuntimePackageRoots": ["/app", false]}),
    json!({"jsxImportSourceFromLoader": "true"}),
    json!({"missingJsxRuntimeContextDiagnostic": {"message": "invalid"}}),
    json!({"enableAutoJsxInjection": "true"}),
    json!({"enableAutoJsxInjection": null}),
  ];
  for explicit_false in [false, true] {
    for compile_time_hash in [false, true] {
      for extra in &overrides {
        let mut config = json!({"logLevel": "silent", "compileTimeHash": compile_time_hash});
        if explicit_false {
          config["enableAutoJsxInjection"] = json!(false);
        }
        config
          .as_object_mut()
          .unwrap()
          .extend(extra.as_object().unwrap().clone());
        let config = config.to_string();
        for source in SOURCES {
          assert_eq!(
            transform(source, &config, Some("/app/page.tsx"), false, false),
            transform(source, &config, Some("/app/page.tsx"), true, false),
            "source: {source}\nconfig: {config}"
          );
        }
      }
    }
  }
}

#[test]
fn disabled_pass_gate_also_protects_preconstructed_configurations() {
  for source in SOURCES {
    for config in [r#"{}"#, r#"{"compileTimeHash":true,"logLevel":"silent"}"#] {
      assert_eq!(
        transform(source, config, None, false, true),
        transform(source, config, None, true, false),
        "source: {source}\nconfig: {config}"
      );
    }
  }
}

#[test]
fn disabled_configuration_retains_legacy_validation_and_defaults() {
  for input in [
    "{}",
    r#"{"compileTimeHash":true,"logLevel":"debug","disableBuildChecks":true,"autoderiveJsx":true,"autoderiveStrings":true,"filename":"configured.tsx","jsxRuntime":false}"#,
    r#"{"compileTimeHash":true,"compileTimeHash":false}"#,
    r#"{"compileTimeHash":true,"logLevel":null}"#,
    r#"{"compileTimeHash":true,"disableBuildChecks":"false"}"#,
    r#"{"compileTimeHash":true,"filename":42}"#,
    r#"{"compileTimeHash":true,"autoderiveJsx":null}"#,
    r#"{"compileTimeHash":true,"autoderiveStrings":[]}"#,
    "null",
    "[]",
    r#"["silent",true,"configured.tsx",true,true,true]"#,
    "invalid JSON",
  ] {
    let legacy: LegacyConfig = serde_json::from_str(input).unwrap_or_default();
    let current = PluginConfig::parse(input);
    assert_eq!(
      current.log_level.as_str(),
      legacy.log_level.as_str(),
      "{input}"
    );
    assert_eq!(
      current.compile_time_hash, legacy.compile_time_hash,
      "{input}"
    );
    assert_eq!(current.filename, legacy.filename, "{input}");
    assert_eq!(
      current.disable_build_checks, legacy.disable_build_checks,
      "{input}"
    );
    assert_eq!(current.autoderive_jsx, legacy.autoderive_jsx, "{input}");
    assert_eq!(
      current.autoderive_strings, legacy.autoderive_strings,
      "{input}"
    );
    assert!(!current.enable_auto_jsx_injection, "{input}");
    assert!(!current.jsx_import_source_from_loader, "{input}");
  }
}

#[test]
fn enabled_configuration_still_uses_the_existing_typed_validation() {
  for value in [
    json!({"enableAutoJsxInjection": true, "compileTimeHash": true, "jsxRuntime": "automatic"}),
    json!({"enableAutoJsxInjection": true, "compileTimeHash": true, "jsxRuntime": "invalid"}),
    json!({"enableAutoJsxInjection": true, "compileTimeHash": true, "autoJsxRuntimePackageRoots": 42}),
  ] {
    let input = value.to_string();
    let previous: PluginConfig = serde_json::from_str(&input).unwrap_or_default();
    let current = PluginConfig::parse(&input);
    assert_eq!(format!("{current:?}"), format!("{previous:?}"));
  }
  let enabled = PluginConfig::parse(r#"{"enableAutoJsxInjection":true}"#);
  assert!(enabled.enable_auto_jsx_injection);
}
