//! Preserve node identity across the insertion pass's recursive and ordinary
//! walks. Parsed spans are unique, but an earlier SWC plugin may clone JSX or
//! create nodes with DUMMY_SP. Give only those nodes temporary unique keys and
//! restore their exact spans before returning to the host.

use std::collections::{HashMap, HashSet};

use swc_core::{
  common::{BytePos, Span, DUMMY_SP},
  ecma::{
    ast::*,
    visit::{Visit, VisitMut, VisitMutWith, VisitWith},
  },
};

#[derive(Default)]
struct OriginalSpans(HashSet<Span>);

impl Visit for OriginalSpans {
  fn visit_jsx_element(&mut self, element: &JSXElement) {
    self.0.insert(element.span);
    element.visit_children_with(self);
  }

  fn visit_jsx_fragment(&mut self, fragment: &JSXFragment) {
    self.0.insert(fragment.span);
    fragment.visit_children_with(self);
  }
}

pub(super) struct NodeIdentity {
  occupied: HashSet<Span>,
  seen: HashSet<Span>,
  originals: HashMap<Span, Span>,
  next: u32,
}

impl NodeIdentity {
  pub fn assign(program: &mut Program) -> Self {
    let mut spans = OriginalSpans::default();
    program.visit_with(&mut spans);
    let mut identity = Self {
      occupied: spans.0,
      seen: HashSet::new(),
      originals: HashMap::new(),
      next: 0,
    };
    program.visit_mut_with(&mut identity);
    identity
  }

  fn assign_span(&mut self, span: &mut Span) {
    if *span != DUMMY_SP && self.seen.insert(*span) {
      return;
    }
    loop {
      self.next += 1;
      // This is a temporary identity, never sent to a source-map API. Starting
      // at zero also keeps these keys separate from ordinary parsed spans.
      let key = Span::new(BytePos(0), BytePos(self.next));
      if self.occupied.insert(key) {
        self.originals.insert(key, *span);
        *span = key;
        return;
      }
    }
  }

  pub fn restore(self, program: &mut Program) {
    struct Restore(HashMap<Span, Span>);
    impl VisitMut for Restore {
      fn visit_mut_jsx_element(&mut self, element: &mut JSXElement) {
        if let Some(original) = self.0.get(&element.span) {
          element.span = *original;
        }
        element.visit_mut_children_with(self);
      }
      fn visit_mut_jsx_fragment(&mut self, fragment: &mut JSXFragment) {
        if let Some(original) = self.0.get(&fragment.span) {
          fragment.span = *original;
        }
        fragment.visit_mut_children_with(self);
      }
    }
    if !self.originals.is_empty() {
      program.visit_mut_with(&mut Restore(self.originals));
    }
  }
}

impl VisitMut for NodeIdentity {
  fn visit_mut_jsx_element(&mut self, element: &mut JSXElement) {
    self.assign_span(&mut element.span);
    element.visit_mut_children_with(self);
  }
  fn visit_mut_jsx_fragment(&mut self, fragment: &mut JSXFragment) {
    self.assign_span(&mut fragment.span);
    fragment.visit_mut_children_with(self);
  }
}
