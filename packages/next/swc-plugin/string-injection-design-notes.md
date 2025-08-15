# String Injection Design - Two-Pass Approach

## Core Problem
We want to transform:
```typescript
const t = useGT();
t("Hello world", { context: "greeting" });
t("Goodbye");
```

Into:
```typescript
const t = useGT([
  {message: "Hello world", hash: "abc123", context: "greeting"},
  {message: "Goodbye", hash: "def456"}
]);
// t() calls can be removed or left as-is
```

## High-Level Architecture

### Two-Pass System
1. **Pass 1 (Observation)**: Collect all `useGT()`/`getGT()` calls and their associated `t()` strings
2. **Pass 2 (Action)**: Inject collected strings into the original `useGT()`/`getGT()` calls

### Why Two Passes?
- **Order Issue**: We see `useGT()` before we see all the `t()` calls that belong to it
- **Rust Ownership**: Can't store mutable references to AST nodes
- **Clean Separation**: Observation logic separate from modification logic

## Core Data Structure

```rust
pub struct StringCollector {
    /// THE ONLY THING WE NEED!
    /// Maps unique call IDs to their collected content
    /// Key: "scope_1_call_0", "scope_1_call_1", "scope_2_call_0", etc.
    /// Value: All t() content for that specific useGT/getGT call
    calls_needing_injection: HashMap<String, Vec<TranslationContent>>,
    
    /// Counter per scope to generate unique, stable IDs
    call_counters: HashMap<u32, u32>,  // scope_id → next_counter
}

#[derive(Debug, Clone)]
pub struct TranslationContent {
    pub message: String,
    pub hash: String,
    pub id: Option<String>,
    pub context: Option<String>,
}
```

## Unique ID Generation

### Problem with Spans
```typescript
// Original spans
const t1 = useGT();  // span_1000_1010
const t2 = useGT();  // span_1020_1030

// After injecting into t1, spans shift!
const t1 = useGT([...]);  // NOW span_1000_1050
const t2 = useGT();       // NOW span_1060_1070 (DIFFERENT!)
```

### Solution: Counter-Based IDs
```rust
fn create_unique_call_id(&mut self, scope_id: u32) -> String {
    let counter = self.call_counters.get(&scope_id).unwrap_or(&0);
    self.call_counters.insert(scope_id, counter + 1);
    format!("scope_{}_call_{}", scope_id, counter)
}
```

**Properties:**
- ✅ Deterministic (same order = same IDs)
- ✅ Stable (doesn't change when AST is modified)
- ✅ Unique (no collisions across scopes)
- ✅ Simple to understand

## The Flow

### Pass 1: Observation (VisitMut)

#### When we hit `const t = useGT()`:
```rust
// 1. Generate unique ID for this specific call
let unique_call_id = string_collector.create_unique_call_id(current_scope_id);

// 2. Initialize empty content list
string_collector.calls_needing_injection.insert(unique_call_id.clone(), Vec::new());

// 3. Store mapping in scope tracker: variable "t" → this specific call
scope_tracker.track_translation_variable("t", unique_call_id);
```

#### When we hit `t("Hello world")`:
```rust
// 1. Get unique call ID from scope tracker
let unique_call_id = scope_tracker.get_translation_function("t"); // Returns "scope_1_call_0"

// 2. Create content
let content = TranslationContent {
    message: "Hello world",
    hash: calculate_hash("Hello world", options),
    id: extract_id_from_options(options),
    context: extract_context_from_options(options),
};

// 3. Add to the specific call's content list
string_collector.calls_needing_injection
    .get_mut(&unique_call_id)
    .unwrap()
    .push(content);
```

### Pass 2: Action (VisitMut)

#### When we hit any `useGT()` call:
```rust
// 1. Regenerate the same unique ID (deterministic!)
let unique_call_id = format!("scope_{}_call_{}", current_scope_id, call_counter);

// 2. Look up collected content
if let Some(contents) = string_collector.calls_needing_injection.get(&unique_call_id) {
    // 3. Inject: useGT([{message: "Hello", hash: "abc123"}, ...])
    inject_content_array(call_expr, contents);
}
```

## Key Insights

### 1. Scope Tracker as Bridge
The scope tracker connects variable names (`t`) to specific call locations (`scope_1_call_0`).

### 2. One Data Structure
No complex temporary storage, no finalization step. Just direct writes to `calls_needing_injection`.

### 3. Deterministic Counters
Counter-based IDs solve the span-shifting problem perfectly.

### 4. Clean Separation
- `scope.rs`: Only handles variable scoping
- `string_collector.rs`: Only handles content collection/injection
- Each has single responsibility

## Implementation Steps

1. **Update StringCollector**: Implement the simplified structure
2. **Add VisitMut**: Create observation and action visitors  
3. **Update Scope Tracker**: Store unique call IDs instead of function names
4. **Integration**: Wire up the two-pass system in main plugin
5. **Testing**: Ensure deterministic behavior

## Critical Design Decisions

### Why not store AST references?
Rust ownership rules prevent storing mutable references across function calls.

### Why not use spans as IDs?
Spans change when we modify the AST, breaking the lookup in Pass 2.

### Why counters instead of hash?
Counters are simpler, faster, and guaranteed unique within scope.

### Why not one-pass with deferred processing?
Would require complex AST reconstruction and have order-dependency issues.

## Example Transformation

### Before:
```typescript
function handler() {  // scope_1
    const t = useGT();           // Gets ID: "scope_1_call_0"
    const t2 = useGT();          // Gets ID: "scope_1_call_1"
    
    t("Hello", {id: "greeting"}); // Goes to "scope_1_call_0"
    t2("World");                  // Goes to "scope_1_call_1"
    t("Goodbye");                 // Goes to "scope_1_call_0"
}
```

### After:
```typescript
function handler() {
    const t = useGT([
        {message: "Hello", hash: "abc123", id: "greeting"},
        {message: "Goodbye", hash: "def456"}
    ]);
    const t2 = useGT([
        {message: "World", hash: "ghi789"}
    ]);
    
    // t() calls can be removed or kept for runtime
}
```

## Next Steps Tomorrow
1. Implement the simplified StringCollector
2. Add VisitMut visitors back
3. Update scope tracker to store unique call IDs
4. Test with nested scopes and multiple translators