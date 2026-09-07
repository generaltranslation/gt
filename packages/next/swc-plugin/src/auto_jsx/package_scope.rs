//! The application may transpile GT dependencies, but insertion must never
//! recursively instrument the implementations of the runtime components.

pub(crate) fn is_runtime_package(filename: Option<&str>, roots: &[String]) -> bool {
  let Some(filename) = filename else {
    return false;
  };
  let filename = filename.replace('\\', "/");
  roots.iter().any(|root| {
    let root = root.replace('\\', "/");
    let root = root.trim_end_matches('/');
    !root.is_empty()
      && (filename == root
        || filename.strip_prefix(root).is_some_and(|suffix| {
          // A nested dependency has its own package identity. Its path is
          // eligible unless independently included in the verified roots.
          let path = suffix.split(['?', '#']).next().unwrap_or(suffix);
          suffix.starts_with('/') && !path.split('/').any(|part| part == "node_modules")
        }))
  })
}

#[cfg(test)]
mod tests {
  use super::is_runtime_package;

  #[test]
  fn only_exact_runtime_directories_are_excluded() {
    let roots = vec!["/app/node_modules/gt-next/".into()];
    for filename in [
      "/app/node_modules/gt-next/dist/Branch.mjs",
      "/app/node_modules/gt-next/dist/Branch.mjs?server=true#module",
      "/app/node_modules/gt-next/dist/Branch.mjs?loader=/node_modules/other",
      "/app/node_modules/gt-next",
    ] {
      assert!(is_runtime_package(Some(filename), &roots));
    }
    for filename in [
      "/app/node_modules/gt-next-ui/index.tsx",
      "/app/node_modules/other/node_modules/gt-next/index.tsx",
      "/app/node_modules/gt-next/node_modules/user-cards/index.tsx",
      "/app/src/Page.tsx",
    ] {
      assert!(!is_runtime_package(Some(filename), &roots));
    }
    assert!(!is_runtime_package(None, &roots));
    assert!(!is_runtime_package(Some("/app/src/Page.tsx"), &["".into()]));
  }

  #[test]
  fn nested_runtime_dependencies_need_their_own_verified_root() {
    let filename = "/app/node_modules/gt-next/node_modules/gt-react/dist/Branch.mjs";
    let roots = vec!["/app/node_modules/gt-next".into()];
    assert!(!is_runtime_package(Some(filename), &roots));
    let roots = vec![
      "/app/node_modules/gt-next".into(),
      "/app/node_modules/gt-next/node_modules/gt-react".into(),
    ];
    assert!(is_runtime_package(Some(filename), &roots));
  }

  #[test]
  fn separators_and_literal_package_root_characters_are_preserved() {
    let roots = vec![r"C:\app\node_modules\gt-next\".into()];
    assert!(is_runtime_package(
      Some("C:/app/node_modules/gt-next/dist/Branch.mjs?raw"),
      &roots
    ));
    assert!(is_runtime_package(
      Some(r"C:\app\node_modules\gt-next\dist\Branch.mjs"),
      &roots
    ));
    assert!(!is_runtime_package(
      Some("C:/app/node_modules/gt-next-other/Branch.mjs"),
      &roots
    ));
    let roots = vec!["/work/#copy?name/node_modules/gt-next".into()];
    assert!(is_runtime_package(
      Some("/work/#copy?name/node_modules/gt-next/dist/Branch.mjs?raw"),
      &roots
    ));
    assert!(!is_runtime_package(Some("/work/user/Page.tsx"), &roots));
  }
}
