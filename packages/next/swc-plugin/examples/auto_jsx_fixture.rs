//! Native differential-test driver. Production and tests call the same pipeline.
use std::io::{self, Read};

use gt_swc_plugin::{config::PluginConfig, transform_program_with_comments};
use serde::Deserialize;
use swc_core::{
  common::{
    comments::SingleThreadedComments, sync::Lrc, FileName, Globals, Mark, SourceMap, GLOBALS,
  },
  ecma::{
    ast::Pass,
    codegen::to_code_default,
    parser::{parse_file_as_program, Syntax, TsSyntax},
    transforms::base::{fixer::fixer, hygiene::hygiene, resolver},
  },
};

#[derive(Deserialize)]
struct Request {
  input: String,
  #[serde(default)]
  config: Option<PluginConfig>,
}

fn main() {
  let mut input = String::new();
  io::stdin().read_to_string(&mut input).unwrap();
  let requests: Vec<Request> = serde_json::from_str(&input).unwrap();
  let outputs: Vec<String> = requests
    .into_iter()
    .map(|request| {
      GLOBALS.set(&Globals::new(), || {
        let cm: Lrc<SourceMap> = Default::default();
        let file = cm.new_source_file(FileName::Custom("input.tsx".into()).into(), request.input);
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
        let config = request.config.unwrap_or_else(|| {
          serde_json::from_str(r#"{"enableAutoJsxInjection":true,"compileTimeHash":false}"#)
            .unwrap()
        });
        let mut program = transform_program_with_comments(
          program,
          config,
          Some("input.tsx".into()),
          Some(&comments),
        );
        hygiene().process(&mut program);
        fixer(Some(&comments)).process(&mut program);
        to_code_default(cm, Some(&comments), &program)
      })
    })
    .collect();
  println!("{}", serde_json::to_string(&outputs).unwrap());
}
