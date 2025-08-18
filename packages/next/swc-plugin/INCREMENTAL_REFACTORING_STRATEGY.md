# Incremental Refactoring Strategy

## Core Principle: **Working Code First, Clean Code Second**

Every change must:
1. **Maintain functionality** - Tests pass at each step
2. **Be reversible** - Clear rollback plan for each change  
3. **Be atomic** - Each step is a complete, working improvement
4. **Be testable** - Can validate functionality hasn't changed

## Strategy: **Extract-Don't-Rewrite**

Instead of designing the perfect architecture upfront, we'll extract working pieces one at a time, gradually building toward the ideal structure.

---

## Phase 1: Extract Pure Functions (Low Risk, High Value)

**Goal**: Remove duplicated logic without changing interfaces

### Step 1.1: Extract Scope Management Helper (2-3 days)

**Current State**: 15+ methods with identical scope enter/exit pattern
**Target**: Single reusable function

#### Extract the Pattern:
```rust
// Add to visitor/transform.rs (no new files yet)
impl TransformVisitor {
    // Single helper method - handles scope enter/exit only
    fn with_scope<T, F>(&mut self, operation: F) -> T 
    where F: FnOnce(&mut Self) -> T 
    {
        self.import_tracker.scope_tracker.enter_scope();
        let result = operation(self);
        self.import_tracker.scope_tracker.exit_scope();
        result
    }
}
```

#### Replace Usage Incrementally:

**Pattern 1: Functions with Regular Parameters (2 methods)**
```rust
// Before (5 lines):
fn visit_mut_function(&mut self, function: &mut Function) {
    self.import_tracker.scope_tracker.enter_scope();
    self.track_parameter_overrides(&function.params);
    function.visit_mut_children_with(self);
    self.import_tracker.scope_tracker.exit_scope();
}

// After (4 lines) - parameter tracking stays explicit:
fn visit_mut_function(&mut self, function: &mut Function) {
    self.with_scope(|visitor| {
        visitor.track_parameter_overrides(&function.params);
        function.visit_mut_children_with(visitor);
    });
}
```

**Pattern 2: Arrow Functions with Different Parameters (2 methods)**
```rust
// Before (5 lines):
fn visit_mut_arrow_expr(&mut self, arrow: &mut ArrowExpr) {
    self.import_tracker.scope_tracker.enter_scope();
    self.track_arrow_parameter_overrides(&arrow.params);  // Different method & type
    arrow.visit_mut_children_with(self);
    self.import_tracker.scope_tracker.exit_scope();
}

// After (4 lines) - different parameter handling stays clear:
fn visit_mut_arrow_expr(&mut self, arrow: &mut ArrowExpr) {
    self.with_scope(|visitor| {
        visitor.track_arrow_parameter_overrides(&arrow.params);  
        arrow.visit_mut_children_with(visitor);
    });
}
```

**Pattern 3: Simple Scope Management (11+ methods)**
```rust
// Before (4 lines):
fn visit_mut_block_stmt(&mut self, block: &mut BlockStmt) {
    self.import_tracker.scope_tracker.enter_scope();
    block.visit_mut_children_with(self);
    self.import_tracker.scope_tracker.exit_scope();
}

// After (3 lines) - clean and simple:
fn visit_mut_block_stmt(&mut self, block: &mut BlockStmt) {
    self.with_scope(|visitor| {
        block.visit_mut_children_with(visitor);
    });
}
```

Apply this same pattern to **all 15 scope management methods** across both VisitMut and Fold:

- **2 methods** with regular parameters: `visit_mut_function`, `fold_function`
- **2 methods** with arrow parameters: `visit_mut_arrow_expr`, `fold_arrow_expr`  
- **11+ methods** with simple scope management: `visit_mut_fn_expr`, `fold_fn_expr`, `visit_mut_block_stmt`, `fold_block_stmt`, `visit_mut_class`, `fold_class`, etc.

#### Apply to Fold Methods

The Fold methods follow the exact same patterns:

**Before**:
```rust
fn fold_function(&mut self, function: Function) -> Function {
    self.import_tracker.scope_tracker.enter_scope();
    self.track_parameter_overrides(&function.params);
    let function = function.fold_children_with(self);
    self.import_tracker.scope_tracker.exit_scope();
    function
}
```

**After**:
```rust
fn fold_function(&mut self, function: Function) -> Function {
    self.with_scope(|visitor| {
        visitor.track_parameter_overrides(&function.params);
        function.fold_children_with(visitor)
    })
}
```

**Validation**: 
- [ ] All tests pass
- [ ] Plugin behavior unchanged
- [ ] ~90 lines of duplication eliminated (150 total lines → ~60 lines)

**Rollback Plan**: Git revert - no interfaces changed, no new dependencies

---

### Step 1.2: Extract JSX Context Management (2-3 days)

**Current State**: JSX element processing duplicated between VisitMut and Fold
**Target**: Shared context management function

#### Extract the Pattern:
```rust
// Add to visitor/transform.rs
impl TransformVisitor {
    fn with_jsx_element_context<T, F>(&mut self, element: &JSXElement, operation: F) -> T
    where F: FnOnce(&mut Self, bool, bool, bool) -> T 
    {
        self.statistics.jsx_element_count += 1;
        
        // Save state
        let was_in_translation = self.traversal_state.in_translation_component;
        let was_in_variable = self.traversal_state.in_variable_component;

        // Determine context
        let (is_translation, is_variable, is_branch) = self.determine_component_type(element);
        self.traversal_state.in_translation_component = is_translation;
        self.traversal_state.in_variable_component = is_variable;
        
        // Execute operation
        let result = operation(self, is_translation, is_variable, is_branch);
        
        // Restore state
        self.traversal_state.in_translation_component = was_in_translation;
        self.traversal_state.in_variable_component = was_in_variable;
        
        result
    }
}
```

**Validation**:
- [ ] All tests pass  
- [ ] JSX processing behavior identical
- [ ] ~40 lines of duplication eliminated

---

### Step 1.3: Extract Call Expression Analysis (2-3 days)

**Current State**: Complex call expression logic duplicated
**Target**: Shared analysis with pass-specific hooks

#### Extract Common Analysis:
```rust
// Add to visitor/transform.rs
impl TransformVisitor {
    fn analyze_call_expression(&mut self, call_expr: &CallExpr) -> Option<(String, u32)> {
        if let Callee::Expr(callee_expr) = &call_expr.callee {
            if let Expr::Ident(Ident { sym: function_name, .. }) = callee_expr.as_ref() {
                if let Some(translation_variable) = self
                    .import_tracker
                    .scope_tracker
                    .get_translation_variable(function_name) {
                    
                    let original_name = translation_variable.assigned_value.clone();
                    let counter_id = self.import_tracker.string_collector.increment_counter();
                    
                    return Some((original_name, counter_id));
                }
            }
        }
        None
    }
}
```

#### Update Both Passes to Use Shared Analysis:
```rust
// VisitMut - only the collection-specific parts remain
fn visit_mut_call_expr(&mut self, call_expr: &mut CallExpr) {
    if let Some((original_name, counter_id)) = self.analyze_call_expression(call_expr) {
        if is_translation_function_callback(&original_name) {
            // Collection logic here
            self.collect_translation_content(call_expr, counter_id);
        }
    }
    call_expr.visit_mut_children_with(self);
}

// Fold - only the transformation-specific parts remain  
fn fold_call_expr(&mut self, call_expr: CallExpr) -> CallExpr {
    if let Some((original_name, counter_id)) = self.analyze_call_expression(&call_expr) {
        if is_translation_function_name(&original_name) {
            // Injection logic here
            return self.inject_translation_content(call_expr, counter_id);
        }
    }
    call_expr.fold_children_with(self)
}
```

**Validation**:
- [ ] All translation detection works identically
- [ ] Both passes handle calls correctly
- [ ] ~80 lines of duplication eliminated

---

## Phase 2: Extract Utility Modules (Medium Risk, High Organization Value)

**Goal**: Move pure logic to focused modules without changing core visitor structure

### Step 2.1: Extract Component Detection (1-2 days)

**Target**: `src/analysis/component_detection.rs`

#### Move Pure Functions:
```rust
// NEW FILE: src/analysis/component_detection.rs
pub fn is_translation_component_name(name: &str) -> bool {
    matches!(name, "T")
}

pub fn is_variable_component_name(name: &str) -> bool {
    matches!(name, "Var" | "Num" | "Currency" | "DateTime")
}

pub fn is_branch_name(name: &str) -> bool {
    matches!(name, "Branch" | "Plural")
}

// Move determine_component_type logic here as a pure function
pub fn analyze_jsx_element(
    element: &JSXElement,
    translation_aliases: &HashMap<Atom, Atom>,
    variable_aliases: &HashMap<Atom, Atom>,
    branch_aliases: &HashMap<Atom, Atom>,
    namespace_imports: &HashSet<Atom>,
) -> (bool, bool, bool) {
    // Move existing logic from determine_component_type
}
```

#### Update Existing Code Gradually:
```rust
// In visitor/transform.rs - change one method at a time
use crate::analysis::component_detection;

impl TransformVisitor {
    pub fn determine_component_type(&mut self, element: &JSXElement) -> (bool, bool, bool) {
        // Replace implementation with call to pure function
        component_detection::analyze_jsx_element(
            element,
            &self.import_tracker.translation_import_aliases,
            &self.import_tracker.variable_import_aliases,
            &self.import_tracker.branch_import_aliases,
            &self.import_tracker.namespace_imports,
        )
    }
}
```

**Validation**:
- [ ] Component detection behavior unchanged
- [ ] All JSX processing works identically
- [ ] New module is testable in isolation

---

### Step 2.2: Extract Hash Calculation (1-2 days)

**Target**: `src/operations/hash_operations.rs`

#### Move Hash Logic:
```rust
// NEW FILE: src/operations/hash_operations.rs
pub fn calculate_call_expr_hash(
    string: &ExprOrSpread, 
    options: Option<&ExprOrSpread>
) -> (Option<String>, Option<String>) {
    // Move calculate_hash_for_call_expr logic here
}

pub fn calculate_jsx_element_hash(element: &JSXElement) -> (String, String) {
    // Move calculate_element_hash logic here  
}
```

#### Update Existing Code:
```rust
// In visitor/transform.rs
use crate::operations::hash_operations;

impl TransformVisitor {
    pub fn calculate_hash_for_call_expr(&mut self, string: &ExprOrSpread, options: Option<&ExprOrSpread>) -> (Option<String>, Option<String>) {
        hash_operations::calculate_call_expr_hash(string, options)
    }
}
```

**Validation**:
- [ ] Hash calculation identical
- [ ] Hash operations are now easily testable
- [ ] No behavior changes in plugin

---

## Phase 3: Gradual Interface Evolution (Higher Risk, Structural Value)

**Goal**: Slowly evolve interfaces toward the target architecture

### Step 3.1: Introduce Pass-Specific Operations (3-4 days)

#### Add New Methods Alongside Existing:
```rust
// In visitor/transform.rs - ADD these, don't replace existing yet
impl TransformVisitor {
    // New collection-focused methods
    fn collect_translation_content(&mut self, call_expr: &CallExpr, counter_id: u32) {
        // Extract collection logic from visit_mut_call_expr
        // But keep the original method working
    }
    
    // New injection-focused methods  
    fn inject_translation_content(&mut self, call_expr: CallExpr, counter_id: u32) -> CallExpr {
        // Extract injection logic from fold_call_expr
        // But keep the original method working
    }
}
```

#### Gradually Switch Over:
```rust
// Update visit_mut_call_expr to use new method
fn visit_mut_call_expr(&mut self, call_expr: &mut CallExpr) {
    if let Some((original_name, counter_id)) = self.analyze_call_expression(call_expr) {
        if is_translation_function_callback(&original_name) {
            self.collect_translation_content(call_expr, counter_id); // New method
        }
    }
    call_expr.visit_mut_children_with(self);
}
```

**Validation**:
- [ ] Both old and new code paths work
- [ ] Can switch back and forth during development
- [ ] Functionality completely preserved

---

### Step 3.2: Extract to Separate Pass Files (4-5 days)

**Only after Steps 1-3 are complete and stable**

#### Create New Files with Existing Interfaces:
```rust
// NEW FILE: src/passes/observation_visitor.rs  
use crate::visitor::TransformVisitor; // Import existing type

pub struct ObservationVisitor(TransformVisitor); // Wrapper around existing

impl Deref for ObservationVisitor {
    type Target = TransformVisitor;
    fn deref(&self) -> &Self::Target { &self.0 }
}

impl DerefMut for ObservationVisitor {
    fn deref_mut(&mut self) -> &mut Self::Target { &mut self.0 }
}

impl VisitMut for ObservationVisitor {
    // Move VisitMut methods here, but they still work on TransformVisitor
}
```

#### Gradually Switch Plugin Entry Point:
```rust
// In lib.rs - can switch between old and new easily
#[plugin_transform]
pub fn process_transform(program: Program, metadata: TransformPluginProgramMetadata) -> Program {
    let config = parse_config(metadata);
    let string_collector = StringCollector::new();
    
    // Feature flag for gradual migration
    if should_use_new_structure() {
        // Use new pass structure
        let mut observation_visitor = ObservationVisitor::new(config.clone(), string_collector);
        program.visit_mut_with(&mut observation_visitor);
        
        let mut transform_visitor = TransformationVisitor::new(config, observation_visitor.into_string_collector());
        program.fold_with(&mut transform_visitor)
    } else {
        // Use existing structure (fallback)
        let mut visitor = TransformVisitor::new(config.log_level, config.compile_time_hash, None, string_collector);
        program.visit_mut_with(&mut visitor);
        
        let collected_data = visitor.import_tracker.string_collector;
        let mut visitor = TransformVisitor::new(config.log_level, config.compile_time_hash, None, collected_data);
        program.fold_with(&mut visitor)
    }
}
```

---

## Risk Mitigation Strategy

### 1. **Feature Flags for Gradual Migration**
```rust
// Environment variable or config flag
const USE_NEW_STRUCTURE: bool = option_env!("GT_USE_NEW_STRUCTURE").is_some();

if USE_NEW_STRUCTURE {
    // New code path
} else {
    // Existing code path
}
```

### 2. **Comprehensive Testing at Each Step**
```bash
# After each change
cargo test
npm test  # Integration tests
# Manual verification on real projects
```

### 3. **Git Strategy**
- Each phase is a separate branch
- Each step is a separate commit
- Easy to cherry-pick successful changes
- Easy to revert problematic changes

### 4. **Rollback Plans**
- **Step 1-2**: Simple git revert (no interface changes)
- **Step 3**: Feature flag to old behavior  
- **Step 4**: Switch back to old entry point

## Timeline with Safety Checks

### Week 1: Pure Extraction (Low Risk)
- **Day 1-2**: Step 1.1 - Scope management helper
- **Day 3-4**: Step 1.2 - JSX context management
- **Day 5**: Step 1.3 - Call expression analysis
- **End of week**: Full testing, performance validation

### Week 2: Module Organization (Medium Risk)  
- **Day 1-2**: Step 2.1 - Component detection module
- **Day 3**: Step 2.2 - Hash operations module
- **Day 4-5**: Testing and validation
- **End of week**: Ensure all extractions work correctly

### Week 3: Interface Evolution (Higher Risk)
- **Day 1-3**: Step 3.1 - Pass-specific operations
- **Day 4-5**: Validation and rollback testing
- **End of week**: Ready for structural changes

### Week 4: Structural Changes (Highest Risk)
- **Day 1-3**: Step 3.2 - Extract to separate files  
- **Day 4**: Feature flag implementation
- **Day 5**: Full integration testing

---

## Success Metrics

- [ ] **Plugin functionality identical** at each step
- [ ] **All tests pass** at each step  
- [ ] **Performance unchanged** at each step
- [ ] **Easy rollback** available at each step
- [ ] **Code gradually becomes cleaner** without breaking

This strategy lets us "rebuild the barn while the cattle are still in it" - maintaining a working system while incrementally improving its architecture.