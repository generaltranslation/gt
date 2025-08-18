# GT-Next SWC Plugin Architectural Refactoring Plan

## Current State Analysis

### File Sizes (Excluding Tests)
- `lib.rs`: 645 lines with ~236 lines of duplication
- `transform.rs`: 575 lines (excluding 730+ test lines)
- **Total Code**: ~1220 lines in monolithic structure

### Core Architecture Issues
1. **Mixed Responsibilities**: Navigation logic, analysis, collection, and transformation all intermingled
2. **Massive Duplication**: Nearly identical VisitMut and Fold implementations
3. **No Clear Boundaries**: Business logic scattered across large files
4. **Testing Difficulties**: Hard to test components in isolation

## Proposed High-Level Architecture

### Mental Model: Shared Base + Specialized Operations

```
Current Structure (Problems):
lib.rs (645 lines)
├── VisitMut impl (observation logic)
├── Fold impl (transformation logic)  
├── Shared methods (mixed throughout)
└── Plugin entry point
// Everything mixed together, no clear boundaries

Proposed Structure (Solution):
BaseVisitor (Shared Navigation & Analysis)
├── Shared scope management
├── Shared JSX context tracking
├── Shared component type detection
├── Abstract hooks for pass-specific behavior
└── Template methods for common patterns

ObservationVisitor (VisitMut)     TransformationVisitor (Fold)
├── Collection operations          ├── Injection operations
├── "Record what you see"          ├── "Modify based on recordings"
├── No AST modifications           └── AST transformations
└── Builds StringCollector data
```

## What's Actually Different Between Passes?

### Shared Logic (~80% of current code)
- **Scope management**: Enter/exit scopes identically
- **State tracking**: JSX context, component type determination  
- **Navigation**: Traversing functions, blocks, JSX elements
- **Import processing**: Tracking gt-next imports
- **Variable tracking**: `const t = useGT()` assignments
- **Validation**: Dynamic content violation checks

### Pass-Specific Logic (~20% of current code)

#### VisitMut (Observation) Only:
```rust
// Collection operations
string_collector.set_translation_content(counter_id, content);
string_collector.set_translation_jsx(counter_id, jsx);
string_collector.initialize_aggregator(counter_id);

// Hash calculation for recording
let (hash_value, _) = self.calculate_element_hash(&element);
```

#### Fold (Transformation) Only:
```rust
// AST modification operations
let content_array = self.create_content_array(&content.content, call_expr.span);
new_args.push(ExprOrSpread { expr: Box::new(Expr::Array(content_array)) });

// Hash attribute injection
let hash_attr = TransformVisitor::create_attr(&element, &hash_value, "_hash");
element.opening.attrs.push(hash_attr);

// Return modified AST nodes
return CallExpr { args: new_args, ..call_expr.clone() };
```

## Proposed File Structure

### Design Principle: "Location = Responsibility"

```
src/
├── lib.rs                     # Plugin entry point only (~50 lines)
│
├── passes/                    # The Two-Pass Strategy
│   ├── mod.rs
│   ├── base_visitor.rs       # Shared navigation & analysis logic
│   ├── observation.rs        # VisitMut - "Record what you see"
│   └── transformation.rs     # Fold - "Modify based on recordings"
│
├── operations/               # What Each Pass Actually Does
│   ├── mod.rs
│   ├── collection.rs         # Recording operations (VisitMut specific)
│   └── injection.rs          # AST modification operations (Fold specific)
│
├── analysis/                 # Decision Logic (Shared)
│   ├── mod.rs
│   ├── component_detection.rs # is_translation_component_name, etc.
│   ├── import_analysis.rs    # process_gt_import_declaration logic
│   └── variable_resolution.rs # track_variable_assignment logic
│
├── tracking/                 # State Management (Shared)
│   ├── mod.rs
│   ├── scope_tracker.rs      # Current scope.rs
│   ├── jsx_context.rs        # JSX state management
│   └── import_tracker.rs     # Import tracking extracted from state.rs
│
├── data/                     # Data Structures (Shared)
│   ├── mod.rs
│   ├── string_collector.rs   # Current string_collector.rs
│   └── translation_types.rs  # TranslationContent, etc.
│
└── utils/                    # Current utility modules
    ├── config.rs
    ├── logging.rs
    ├── hash.rs
    └── whitespace.rs
```

### File Responsibility Matrix

| Directory | Purpose | Usage | Size Target |
|-----------|---------|-------|-------------|
| `passes/` | "How do we traverse the AST?" | Navigation patterns, visitor implementations | ~200 lines each |
| `operations/` | "What do we do when we find something?" | Concrete actions per pass | ~150 lines each |
| `analysis/` | "How do we decide what's important?" | Pure decision logic | ~100 lines each |
| `tracking/` | "How do we remember where we are?" | State management | ~150 lines each |
| `data/` | "How do we store what we've learned?" | Data structures only | ~300 lines each |

## Shared Base Class Design

### Core Abstraction

```rust
// passes/base_visitor.rs
pub trait AstNavigator {
    // State access (implemented by concrete visitors)
    fn import_tracker(&mut self) -> &mut ImportTracker;
    fn jsx_context(&mut self) -> &mut JsxContext;
    fn scope_tracker(&mut self) -> &mut ScopeTracker;
    fn string_collector(&mut self) -> &mut StringCollector;
    
    // Shared analysis (default implementations provided)
    fn determine_component_type(&self, element: &JSXElement) -> (bool, bool, bool) {
        ComponentDetector::analyze(element, self.import_tracker())
    }
    
    fn should_track_variable(&self, name: &Atom) -> bool {
        VariableResolver::should_track(name, self.import_tracker())
    }
    
    // Pass-specific hooks (must be implemented by each visitor)
    fn on_translation_call(&mut self, call_expr: &CallExpr, counter_id: u32);
    fn on_jsx_translation_element(&mut self, element: &JSXElement, counter_id: u32);
    fn on_import_declaration(&mut self, import_decl: &ImportDecl);
}

// Shared behavior implementations
pub trait SharedNavigation: AstNavigator {
    fn with_scope<R, F>(&mut self, operation: F) -> R 
    where F: FnOnce(&mut Self) -> R {
        self.scope_tracker().enter_scope();
        let result = operation(self);
        self.scope_tracker().exit_scope();
        result
    }
    
    fn with_jsx_context<R, F>(&mut self, element: &JSXElement, operation: F) -> R 
    where F: FnOnce(&mut Self, bool, bool, bool) -> R {
        let jsx_ctx = self.jsx_context();
        jsx_ctx.save_state();
        
        let (is_translation, is_variable, is_branch) = self.determine_component_type(element);
        jsx_ctx.set_context(is_translation, is_variable, is_branch);
        
        let result = operation(self, is_translation, is_variable, is_branch);
        
        jsx_ctx.restore_state();
        result
    }
    
    // Template method - defines structure, delegates specifics
    fn process_call_expression(&mut self, call_expr: &CallExpr) {
        if let Some(translation_var) = ImportAnalyzer::analyze_call(call_expr, self.import_tracker()) {
            let counter_id = self.string_collector().increment_counter();
            
            // Pass-specific hook
            self.on_translation_call(call_expr, counter_id);
        }
    }
}

// Blanket implementation
impl<T: AstNavigator> SharedNavigation for T {}
```

### Concrete Pass Implementations

```rust
// passes/observation.rs
pub struct ObservationVisitor {
    import_tracker: ImportTracker,
    jsx_context: JsxContext,
    // ... other state
}

impl AstNavigator for ObservationVisitor {
    fn on_translation_call(&mut self, call_expr: &CallExpr, counter_id: u32) {
        // Collection-specific logic
        CollectionOperations::record_translation(call_expr, counter_id, self.string_collector());
    }
    
    fn on_jsx_translation_element(&mut self, element: &JSXElement, counter_id: u32) {
        // Record JSX content for later injection
        CollectionOperations::record_jsx_element(element, counter_id, self.string_collector());
    }
}

impl VisitMut for ObservationVisitor {
    fn visit_mut_call_expr(&mut self, call_expr: &mut CallExpr) {
        self.process_call_expression(call_expr); // Uses shared template method
        call_expr.visit_mut_children_with(self);
    }
    
    fn visit_mut_function(&mut self, function: &mut Function) {
        self.with_scope(|visitor| { // Uses shared navigation
            function.visit_mut_children_with(visitor);
        });
    }
}

// passes/transformation.rs  
pub struct TransformationVisitor {
    string_collector: StringCollector,
    jsx_context: JsxContext,
    // ... other state
}

impl AstNavigator for TransformationVisitor {
    fn on_translation_call(&mut self, call_expr: &CallExpr, counter_id: u32) {
        // Injection-specific logic
        InjectionOperations::modify_call_expr(call_expr, counter_id, self.string_collector());
    }
    
    fn on_jsx_translation_element(&mut self, element: &JSXElement, counter_id: u32) {
        // Inject hash attributes
        InjectionOperations::inject_hash_attribute(element, counter_id, self.string_collector());
    }
}

impl Fold for TransformationVisitor {
    fn fold_call_expr(&mut self, call_expr: CallExpr) -> CallExpr {
        self.process_call_expression(&call_expr); // Same template method!
        call_expr.fold_children_with(self)
    }
    
    fn fold_function(&mut self, function: Function) -> Function {
        self.with_scope(|visitor| { // Same shared navigation!
            function.fold_children_with(visitor)
        })
    }
}
```

## Deduplication Strategy

### 1. Composition over Inheritance
Instead of duplicating methods, compose behaviors:

```rust
// Before: 30 nearly identical methods across VisitMut and Fold
fn visit_mut_function(&mut self, function: &mut Function) { /* scope logic */ }
fn fold_function(&mut self, function: Function) -> Function { /* scope logic */ }

// After: 1 shared implementation + 2 simple dispatchers  
impl<T: AstNavigator + SharedNavigation> T {
    fn handle_function<F, R>(&mut self, params: &[Param], operation: F) -> R 
    where F: FnOnce(&mut Self) -> R {
        self.with_scope_and_params(params, operation)
    }
}
```

### 2. Template Method Pattern
Define structure once, let passes fill in specifics:

```rust
// Shared structure in base_visitor.rs
fn process_jsx_element<V: AstNavigator>(&mut self, element: &JSXElement) {
    // 1. Update context (shared)
    self.with_jsx_context(element, |visitor, is_translation, _, _| {
        
        // 2. Pass-specific hook
        if is_translation {
            let counter_id = visitor.string_collector().increment_counter();
            visitor.on_jsx_translation_element(element, counter_id);
        }
        
        // 3. Continue traversal (shared)
        visitor.traverse_jsx_children(element);
    });
}
```

### 3. Operation Extraction
Move pass-specific logic to dedicated modules:

```rust
// operations/collection.rs
pub struct CollectionOperations;

impl CollectionOperations {
    pub fn record_translation(call_expr: &CallExpr, counter_id: u32, collector: &mut StringCollector) {
        if let Some(content) = extract_translation_content(call_expr) {
            collector.set_translation_content(counter_id, content);
        }
    }
    
    pub fn record_jsx_element(element: &JSXElement, counter_id: u32, collector: &mut StringCollector) {
        let hash = calculate_jsx_hash(element);
        collector.set_translation_jsx(counter_id, TranslationJsx { hash });
    }
}

// operations/injection.rs
pub struct InjectionOperations;

impl InjectionOperations {
    pub fn modify_call_expr(call_expr: &mut CallExpr, counter_id: u32, collector: &StringCollector) -> bool {
        if let Some(content) = collector.get_translation_data(counter_id) {
            let content_array = create_content_array(&content.content, call_expr.span);
            call_expr.args.push(ExprOrSpread {
                spread: None,
                expr: Box::new(Expr::Array(content_array)),
            });
            return true;
        }
        false
    }
}
```

## Implementation Benefits

### 1. Intuitive Mental Model
- **File location immediately tells you the purpose**
- **Clear separation between "what" (analysis) and "how" (operations)**  
- **Two-pass strategy is explicit in the structure**

### 2. Minimal Duplication
- **Shared navigation logic in base visitor (eliminates ~200 lines)**
- **Pass-specific operations isolated in separate modules**
- **Template methods eliminate repetitive patterns**

### 3. Easy Testing
- **Test analysis logic independently of passes**
- **Test operations independently of navigation**
- **Mock out components for isolated testing**

### 4. Future Extensibility
- **Want a third pass?** Implement `AstNavigator` + specific operations
- **Want to change scope behavior?** Modify `tracking/scope_tracker.rs`
- **Want new component types?** Extend `analysis/component_detection.rs`

## Migration Timeline

### Phase 1: Extract Shared Abstractions (Week 1)
1. **Day 1-2**: Create `passes/base_visitor.rs` with `AstNavigator` trait
2. **Day 3**: Create `tracking/` modules (scope, jsx context, import tracker)
3. **Day 4**: Create `analysis/` modules (component detection, import analysis)
4. **Day 5**: Create `operations/` modules (collection, injection)

### Phase 2: Refactor Passes (Week 2)  
1. **Day 1-2**: Create `ObservationVisitor` using shared abstractions
2. **Day 3-4**: Create `TransformationVisitor` using shared abstractions
3. **Day 5**: Update `lib.rs` to orchestrate new passes

### Phase 3: Validation & Cleanup (Week 3)
1. **Day 1-2**: Comprehensive testing of new structure
2. **Day 3-4**: Performance validation and optimization
3. **Day 5**: Documentation and final cleanup

## Success Metrics

- [ ] **No file over 400 lines** (target: ~200-300 lines each)
- [ ] **No duplicated navigation logic** between passes
- [ ] **Pass-specific operations clearly isolated**
- [ ] **Shared abstractions reusable for future passes**
- [ ] **All tests pass with identical functionality**
- [ ] **Plugin performance unchanged or improved**

## Philosophy: "The File Structure is the Architecture"

**Where you put code should immediately communicate its role and relationships.** No need to read implementation details to understand the system. This transforms the current "everything in one place" structure into a "everything in its logical place" structure, while eliminating duplication through shared abstractions rather than copy-paste.

The result is a codebase where:
- **New developers can find what they need quickly**
- **Changes have clear, isolated impact**  
- **Testing is straightforward and comprehensive**
- **Future extensions follow obvious patterns**

This approach maintains your innovative two-pass architecture while transforming it into an exemplar of clean, maintainable Rust code.