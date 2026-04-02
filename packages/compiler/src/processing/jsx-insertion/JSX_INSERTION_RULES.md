# JSX Auto-Insertion Rules

The JSX insertion pass automatically wraps translatable JSX content in `GtInternalTranslateJsx` (\_T) and dynamic expressions in `GtInternalVar` (\_Var) at build time. It operates on compiled JSX — after Vite/SWC transforms JSX syntax into `jsx()`/`jsxs()`/`jsxDEV()` calls.

## Why this document exists

These rules must be followed by **two independent systems** that need to agree on the same output:

1. **The compiler plugin** (this pass) — runs at build time and physically inserts \_T and \_Var components into the JSX tree.
2. **The CLI registration tool** — runs before the build to extract translatable content, compute hashes, and register translations with the GT API. When `enableAutoJsxInjection` is enabled, the CLI must **simulate** where \_T and \_Var would be inserted so it can compute hashes that match what the compiler will produce. If these two systems disagree — if the CLI thinks \_T wraps at one level but the compiler wraps at another — the hashes will be different and translation resolution will fail at runtime.

This document is the single source of truth for the insertion rules. Both the compiler pass and the CLI registration logic must implement these rules identically. Any change to these rules requires updating both systems.

---

## Rule 1: Insert \_T at the highest level that directly contains translatable text

\_T wraps the children of the **first ancestor element that has translatable string content as a direct child**. "Translatable text" means `StringLiteral` or static `TemplateLiteral` (no interpolation) with non-whitespace content. Numeric literals (`{42}`), booleans, `null`, `undefined`, etc. are NOT translatable text — they are data, not content a translator would touch. They do not trigger \_T insertion on their own.

```jsx
// Text is a direct child of <div>
<div>Hello</div>
<div><_T>Hello</_T></div>

// Text is inside <span>, not <div> — _T goes inside <span>
<div><span>Click me</span></div>
<div><span><_T>Click me</_T></span></div>

// Text is deeply nested — _T goes at the level with text
<main><section><p>Deep text</p></section></main>
<main><section><p><_T>Deep text</_T></p></section></main>
```

## Rule 2: When a parent has direct text, it claims the entire subtree

If a parent element has text as a direct child, _T wraps at that level. Nested child elements become part of the same translation unit — they do NOT get their own _T.

```jsx
// <div> has "Hello " as direct text — _T at div, <b> is part of the unit
<div>Hello <b>World</b></div>
<div><_T>Hello <b>World</b></_T></div>

// <div> has "Hello " and " today" — _T at div
<div>Hello <b>World</b> today</div>
<div><_T>Hello <b>World</b> today</_T></div>

// <div> has "Welcome, " — _T at div, <span> inside is part of the unit
<div>Welcome, <span><em>friend</em></span>!</div>
<div><_T>Welcome, <span><em>friend</em></span>!</_T></div>
```

## Rule 3: Sibling elements without a common text parent get independent _T

When a parent has no direct text, each child subtree is processed independently.

```jsx
// <div> has no direct text — each child gets its own _T
<div><span>First</span><p><em>Second</em></p></div>
<div><span><_T>First</_T></span><p><em><_T>Second</_T></em></p></div>

// <ul> has no text, each <li> gets _T independently
<ul><li>Item A</li><li>Item B</li></ul>
<ul><li><_T>Item A</_T></li><li><_T>Item B</_T></li></ul>
```

## Rule 4: Dynamic expressions get wrapped in _Var

Any expression that is not statically parseable gets wrapped in `GtInternalVar` (_Var). _Var is ONLY inserted inside a _T region.

### Expressions that need _Var (dynamic):

```jsx
// Identifier (variable reference)
<div>Hello {name}</div>
<div><_T>Hello <_Var>{name}</_Var></_T></div>

// Member expression
<div>Price: {obj.price}</div>
<div><_T>Price: <_Var>{obj.price}</_Var></_T></div>

// Conditional expression
<div>Status: {isActive ? "on" : "off"}</div>
<div><_T>Status: <_Var>{isActive ? "on" : "off"}</_Var></_T></div>

// Binary expression (even if part is static)
<div>Total: {"$" + amount}</div>
<div><_T>Total: <_Var>{"$" + amount}</_Var></_T></div>

// Logical expression
<div>Name: {name && name.toUpperCase()}</div>
<div><_T>Name: <_Var>{name && name.toUpperCase()}</_Var></_T></div>

// Function call (non-jsx)
<div>Result: {getValue()}</div>
<div><_T>Result: <_Var>{getValue()}</_Var></_T></div>

// Template literal with interpolation
<div>Hello {`${name}!`}</div>
<div><_T>Hello <_Var>{`${name}!`}</_Var></_T></div>

// Multiple dynamic expressions → each gets its own _Var
<div>Hello {firstName}, welcome to {city}!</div>
<div><_T>Hello <_Var>{firstName}</_Var>, welcome to <_Var>{city}</_Var>!</_T></div>
```

**Important: each dynamic child expression gets its own individual \_Var.** Dynamic expressions are never combined or grouped. This is a 1-to-1 mapping: each `{expression}` in the JSX source becomes exactly one \_Var wrapper. This matters for hash agreement between the compiler plugin and the CLI extraction tool — both must produce the same structure.

The React JSX transform (Babel/SWC) preserves expressions exactly as written. It does not precompute, constant-fold, or reorder them. Adjacent bare text (not in `{}`) is merged into a single string literal, but expressions inside `{}` are always kept as-is. This means the children array our pass receives is deterministic and maps directly to the source JSX.

```jsx
// Each {expr} → one _Var, bare text → string literals
<div>{a + "hello"}sometext{b}{c} and {d + e}</div>
<div><_T><_Var>{a + "hello"}</_Var>sometext<_Var>{b}</_Var><_Var>{c}</_Var> and <_Var>{d + e}</_Var></_T></div>
// 4 _Vars: (a + "hello"), b, c, (d + e)
// 2 strings: "sometext", " and "
// Note: a + "hello" is NOT precomputed — the BinaryExpression is preserved as-is
```

### Expressions that do NOT need \_Var (static/parseable):

These are valid children inside a \_T region and do not get wrapped in \_Var. However, they do NOT trigger \_T insertion on their own — only string content does (see Rule 5).

```jsx
// String literals — trigger _T AND are valid children
<div>Hello World</div>
<div><_T>Hello World</_T></div>

// Static template literals (no interpolation) — trigger _T AND are valid children
<div>{`Hello`}</div>
<div><_T>{`Hello`}</_T></div>

// Numeric literals — valid children but do NOT trigger _T on their own
<div>Price: {42}</div>          // "Price: " triggers _T, 42 is valid inside it
<div><_T>Price: {42}</_T></div>
<div>{42}</div>                 // No text → no _T → unchanged
<div>{42}</div>

// Boolean literals, null — valid children, do NOT trigger _T
<div>Text {true} {null}</div>
<div><_T>Text {true} {null}</_T></div>

// Negative numbers — valid children, do NOT trigger _T on their own
<div>Temperature: {-5}</div>
<div><_T>Temperature: {-5}</_T></div>

// Special identifiers: undefined, NaN, Infinity — valid children, do NOT trigger _T
<div>Value: {undefined}</div>   // no _T — "Value: " wait, that IS text
<div><_T>Value: {undefined}</_T></div>

// Nested JSX elements — valid translation children, not variables
<div>Hello <b>World</b></div>
<div><_T>Hello <b>World</b></_T></div>
```

## Rule 5: No \_T when there is no translatable string content

If an element's children contain no non-whitespace string content (`StringLiteral` or static `TemplateLiteral`) and no opaque GT components, no \_T is inserted. Numeric literals, booleans, null, and other non-string values do NOT count as translatable content.

```jsx
// No children
<div />
<div />  // unchanged

// Only dynamic content, no text
<div>{userName}</div>
<div>{userName}</div>  // unchanged — nothing to translate

// Only whitespace between dynamic expressions
<div>{firstName} {lastName}</div>
<div>{firstName} {lastName}</div>  // unchanged — whitespace alone is not translatable

// Only numeric content — not translatable
<div>{42}</div>
<div>{42}</div>  // unchanged — numbers are data, not text

// Only nested elements, no direct text
<div><span><img /></span></div>
<div><span><img /></span></div>  // unchanged

// Only boolean/null — not translatable
<div>{true} {null}</div>
<div>{true} {null}</div>  // unchanged
```

## Rule 6: User-written T — completely hands off

If the user has manually written a `<T>` component (imported from a GT library), the pass does **nothing** to it or any of its descendants. No _T, no _Var, nothing.

```jsx
// User T with text
<T>Hello World</T>
<T>Hello World</T>  // unchanged

// User T with user Var
<T>Hello <Var>{name}</Var></T>
<T>Hello <Var>{name}</Var></T>  // unchanged

// User T with deeply nested content — all descendants untouched
<T>Hello <span>{name} <b>World</b></span></T>
<T>Hello <span>{name} <b>World</b></span></T>  // unchanged

// User T next to other content — T is hands-off, other content still processed
<div><T>Translated</T><span>Auto translate me</span></div>
<div><T>Translated</T><span><_T>Auto translate me</_T></span></div>
```

## Rule 7: User-written Var, Num, Currency, DateTime — completely hands off

User-imported variable components are left untouched. They are valid children of \_T but their internals are **never modified** — no \_T or \_Var insertion happens anywhere inside them, regardless of what content they contain.

**Implementation detail:** When the compiler/CLI traversal enters a user Var/Num/Currency/DateTime, it sets an internal flag to suppress ALL transformations. The flag is cleared on exit of that component. This is more robust than trying to mark individual descendant nodes — it correctly handles JSX nested inside arbitrary expressions (ternaries, logical operators, function calls, etc.) within the user component.

This does NOT apply to auto-inserted \_Var. When the pass itself inserts a \_Var, JSX inside it is still fair game for \_T insertion (since the \_Var was our insertion, not the user's).

```jsx
// User Var inside auto-translated content — simple case
<div>Hello <Var>{name}</Var></div>
<div><_T>Hello <Var>{name}</Var></_T></div>
// Note: no _Var wrapping — user Var handles it

// User Var with JSX inside a ternary — everything inside is opaque
<T>Status: <Var>{isActive ? <span>Active</span> : <span>Inactive</span>}</Var></T>
<T>Status: <Var>{isActive ? <span>Active</span> : <span>Inactive</span>}</Var></T>
// "Active" and "Inactive" do NOT get _T — they are inside user Var

// Contrast with auto-inserted Var — JSX inside IS translated
// SOURCE:  <div>Status: {isActive ? <span>Active</span> : <span>Inactive</span>}</div>
// RESULT:  <div><_T>Status: <_Var>{isActive ? <span><_T>Active</_T></span> : <span><_T>Inactive</_T></span>}</_Var></_T></div>
// "Active" and "Inactive" DO get _T because the _Var was auto-inserted

// User Num
<div>Price: <Num>{price}</Num></div>
<div><_T>Price: <Num>{price}</Num></_T></div>

// User Currency
<div>Cost: <Currency>{amount}</Currency></div>
<div><_T>Cost: <Currency>{amount}</Currency></_T></div>

// User DateTime
<div>Date: <DateTime>{date}</DateTime></div>
<div><_T>Date: <DateTime>{date}</DateTime></_T></div>
```

## Rule 8: Branch and Plural — \_T wraps from parent, static props untouched, dynamic props get \_Var

Branch and Plural components trigger \_T insertion at the **parent** level. The `<T>` component already knows how to translate their branches, so static content inside Branch/Plural props and children is left alone.

However, **dynamic expressions** in Branch/Plural props are still wrapped in \_Var — the same as they would be anywhere else. And because \_Var is auto-inserted (not user-written), any JSX inside those dynamic expressions remains eligible for \_T insertion.

**Static prop values** (direct JSX like `summary={<p>Text</p>}`) are left untouched — no \_T inside.

**Dynamic prop values** (ternaries, variables, function calls, etc.) get \_Var wrapped. JSX inside those \_Var wrappers still gets \_T.

```jsx
// Branch as only child — _T wraps at parent
<div><Branch branch="mode" summary={<p>Summary</p>}>Fallback</Branch></div>
<div><_T><Branch branch="mode" summary={<p>Summary</p>}>Fallback</Branch></_T></div>

// Plural as only child — _T wraps at parent
<div><Plural n={count} one="item" other="items" /></div>
<div><_T><Plural n={count} one="item" other="items" /></_T></div>

// Branch with static JSX in prop arguments — NO _T inside the props
<div><Branch branch="mode" summary={<p>Summary text</p>} details={<p>Details text</p>}>Fallback</Branch></div>
<div><_T><Branch branch="mode" summary={<p>Summary text</p>} details={<p>Details text</p>}>Fallback</Branch></_T></div>
// Only 1 _T at div — "Summary text" and "Details text" are static, left alone

// Plural with static JSX in prop arguments — NO _T inside the props
<div><Plural n={count} one={<span>One item</span>} other={<span>Many items</span>} /></div>
<div><_T><Plural n={count} one={<span>One item</span>} other={<span>Many items</span>} /></_T></div>
// Only 1 _T at div — "One item" and "Many items" are static, left alone

// Branch with nested JSX children — NO _T inside children either
<div><Branch branch="test"><p>Fallback text</p></Branch></div>
<div><_T><Branch branch="test"><p>Fallback text</p></Branch></_T></div>
// Only 1 _T at div — "Fallback text" is static, left alone

// Branch alongside text — _T wraps everything at parent
<div>Results: <Branch branch="view" list={<ul>...</ul>}>Default</Branch></div>
<div><_T>Results: <Branch branch="view" list={<ul>...</ul>}>Default</Branch></_T></div>

// Branch with dynamic expression in prop — dynamic value gets _Var
<div><Branch branch="hello" hello={count} /></div>
<div><_T><Branch branch="hello" hello={<_Var>{count}</_Var>} /></_T></div>
// count is dynamic → _Var wraps it (Branch is inside _T region)

// Branch with ternary containing JSX in prop — ternary gets _Var, JSX inside gets _T
<div><Branch branch="mode" summary={condition ? <p>Option A</p> : <p>Option B</p>}>Fallback</Branch></div>
<div><_T><Branch branch="mode" summary={<_Var>{condition ? <p><_T>Option A</_T></p> : <p><_T>Option B</_T></p>}</_Var>}>Fallback</Branch></_T></div>
// The ternary is dynamic → _Var. The <p> elements inside are JSX with text → each gets _T.
// This works because _Var is auto-inserted, so JSX inside it is still fair game.
```

## Rule 9: Derive and Static — same treatment as Branch/Plural

Same as Branch/Plural. \_T wraps from the parent level. Static JSX props are left alone; dynamic props get \_Var wrapped. JSX inside auto-inserted \_Var is still eligible for \_T.

```jsx
// Derive as only child
<div><Derive>{getName()}</Derive></div>
<div><_T><Derive>{getName()}</Derive></_T></div>

// Static as only child
<div><Static>{getLabel()}</Static></div>
<div><_T><Static>{getLabel()}</Static></_T></div>

// Derive with dynamic prop — gets _Var
<div><Derive context={someVar}>{getName()}</Derive></div>
<div><_T><Derive context={<_Var>{someVar}</_Var>}>{getName()}</Derive></_T></div>
```

## Rule 10: Non-children props are independent (except Branch/Plural/Derive/Static)

For **regular components**, JSX in non-`children` props (e.g. `header`, `icon`, `footer`) is an independent subtree. The pass processes it separately — the parent's \_T state does not carry over. This is the default behavior for any component that is not a GT opaque component.

**Exception:** Branch, Plural, Derive, and Static (see Rules 8-9). Their props are not processed independently as separate subtrees. Instead, static JSX props are left alone and dynamic props get \_Var wrapped within the parent's \_T context.

```jsx
// header prop has its own JSX — processed independently
<Card header={<h1>Title</h1>}>Body text</Card>
<Card header={<h1><_T>Title</_T></h1>}><_T>Body text</_T></Card>
// Two independent _T insertions

// icon prop is independent from children
<Button icon={<span>X</span>}>Click me</Button>
<Button icon={<span><_T>X</_T></span>}><_T>Click me</_T></Button>
```

## Rule 11: _Var is only inserted inside _T

Dynamic expressions are only wrapped in _Var when they are inside a _T region (auto-inserted). If there is no _T (e.g., no text to translate), dynamic expressions are left as-is.

```jsx
// Has text → _T inserted → dynamic expressions get _Var
<div>Hello {name}</div>
<div><_T>Hello <_Var>{name}</_Var></_T></div>

// No text → no _T → no _Var either
<div>{name}</div>
<div>{name}</div>  // unchanged

// Whitespace only → no _T → no _Var
<div>{firstName} {lastName}</div>
<div>{firstName} {lastName}</div>  // unchanged
```

## Rule 12: Nested dynamic content inside _T gets _Var at the expression level

When _T claims a subtree and a nested element contains dynamic content, the _Var wraps the expression inside that nested element.

```jsx
// Parent has text → claims _T. Child <span> has dynamic content → _Var inside span
<div>Hello <span>{userName}</span></div>
<div><_T>Hello <span><_Var>{userName}</_Var></span></_T></div>

// Parent has text, child has mix of text and dynamic
<div>Welcome <span>to {city}</span>!</div>
<div><_T>Welcome <span>to <_Var>{city}</_Var></span>!</_T></div>
```

## Rule 13: Fragments are treated like regular elements

React fragments (`<>...</>`) compile to `jsx(Fragment, { children: ... })`. The pass treats them the same as any other element — if their children contain translatable text, \_T is inserted inside the fragment.

```jsx
// Fragment with text — _T inside fragment
<>Hello World</>
<><_T>Hello World</_T></>

// Fragment with no text — unchanged
<><div /><span /></>
<><div /><span /></>  // unchanged

// Fragment with mixed content
<>Welcome {name}!</>
<><_T>Welcome <_Var>{name}</_Var>!</_T></>
```

## Rule 14: Conditional rendering and iterators are dynamic expressions

Ternaries (`? :`), logical expressions (`&&`, `||`), and function calls like `.map()` are dynamic expressions. They get \_Var wrapped if inside a \_T region. JSX inside them (e.g., inside the branches of a ternary or the callback of a map) is still eligible for independent \_T insertion by the Babel visitor since those JSX calls are not marked as processed.

```jsx
// Ternary — the whole expression is dynamic → _Var
// JSX inside each branch gets its own _T independently
<div>Status: {isActive ? <span>Active</span> : <span>Inactive</span>}</div>
<div><_T>Status: <_Var>{isActive ? <span><_T>Active</_T></span> : <span><_T>Inactive</_T></span>}</_Var></_T></div>

// Logical AND — dynamic expression → _Var
<div>Hello {showName && <b>{name}</b>}</div>
<div><_T>Hello <_Var>{showName && <b><_Var>{name}</_Var></b>}</_Var></_T></div>

// .map() — the map call is a single dynamic expression → _Var
<ul>Items: {items.map(i => <li>{i.name}</li>)}</ul>
<ul><_T>Items: <_Var>{items.map(i => <li><_Var>{i.name}</_Var></li>)}</_Var></_T></ul>

// Ternary with no surrounding text — no _T at this level
<div>{show ? <p>Yes</p> : <p>No</p>}</div>
<div>{show ? <p><_T>Yes</_T></p> : <p><_T>No</_T></p>}</div>
// No _T at div (no text), but each branch's <p> gets _T independently
```

## Rule 15: String-only attributes are not touched

The pass only operates on JSX children, not on string-valued props/attributes. Props like `placeholder`, `alt`, `title`, `aria-label`, etc. are left as-is even if they contain translatable text.

```jsx
// String attributes — unchanged
<input placeholder="Search here" />
<input placeholder="Search here" />  // unchanged

<img alt="Company logo" />
<img alt="Company logo" />  // unchanged
```

---

## Import injection

When the pass inserts at least one _T, it automatically adds:

```javascript
import { GtInternalTranslateJsx, GtInternalVar } from 'gt-react/browser';
```

If `GtInternalTranslateJsx` is already imported from a GT source, no duplicate import is added.

---

## Runtime removal of injected components

The compiler cannot always avoid inserting \_T inside another \_T. The primary case is `<Derive>`: the compiler inserts \_T into any element with text, but it cannot know at compile time whether that element will later appear as a child of `<Derive>`. This would require whole-program analysis of every call site — not practical.

### The Derive problem

```jsx
// Before injection:
function getName() {
  return <div>John</div>;
}

<div>
  <Derive>{getName()}</Derive>
</div>

// After injection:
function getName() {
  return <div><_T>John</_T></div>;  // _T injected here — compiler doesn't know this is derived
}

<div>
  <_T>
    <Derive>{getName()}</Derive>
  </_T>
</div>

// Result: nested _T inside Derive — the inner _T needs to be removed at runtime
```

The compiler would have to trace every call site of `getName()` and prove it is never used under `<Derive>` to avoid this. That is not practical.

### Runtime solution: `removeInjectedT()`

Instead of relying on the compiler to never emit nested \_T, the **runtime removes them**. The `_T` component (`GtInternalTranslateJsx`) calls `removeInjectedT()` on its children before processing. This function traverses the React element tree and unwraps any auto-injected \_T components that appear inside a `<Derive>` or `<Static>` context.

**Key invariant that makes this safe:** \_T is always inserted by wrapping the children of an existing element. This means removing \_T is always a simple child replacement — unwrap \_T's children back into the parent. No merging or restructuring needed.

The function uses a `derivationDepth` counter:
- Entering `<Derive>` or `<Static>` increments the depth
- When depth > 0 and an auto-injected \_T is encountered, it is unwrapped (replaced by its children)
- User-written `<T>` components are never removed (distinguished by the `_gtt` transformation tag: `'translate-client'` vs `'translate-client-injected'`)

### Runtime solution: `renderVariable()` removes \_Var

A similar issue exists with \_Var. Auto-injected \_Var wrappers could break user logic if left in the tree (e.g., a component expecting a plain string child gets a \_Var element instead). The `renderVariable()` function handles this by unwrapping auto-injected \_Var components during the render phase, reinserting the original value back to its original place.

### Why this matters for CLI extraction

The CLI extraction tool must be aware that:
1. The compiler **will** produce nested \_T in Derive cases — this is expected, not a bug
2. The runtime removes these nested \_T before hash computation, so the **effective** structure (after removal) is what the hash is computed against
3. The CLI must simulate the same removal when computing hashes from source to maintain agreement

---

## Summary table

| Scenario | \_T inserted? | \_Var inserted? | Where? |
|----------|-------------|----------------|--------|
| `<div>Hello</div>` | Yes | No | Inside div |
| `<div>{name}</div>` | No | No | — (no text) |
| `<div>{42}</div>` | No | No | — (number is not text) |
| `<div>Hello {name}</div>` | Yes | Yes (name) | Inside div |
| `<div><span>Hi</span></div>` | Yes | No | Inside span |
| `<div>Hi <b>W</b></div>` | Yes | No | Inside div |
| `<div>{a} {b}</div>` | No | No | — (whitespace only) |
| `<>Hello</>` | Yes | No | Inside fragment |
| `<T>Hello</T>` | No | No | — (user T, hands off) |
| `<div><Var>{x}</Var></div>` | No | No | — (no text) |
| `<div>Hi <Var>{x}</Var></div>` | Yes | No | Inside div (user Var untouched) |
| `<div><Branch ...>F</Branch></div>` | Yes | No | Inside div (wraps Branch) |
| `<div><Derive>{x}</Derive></div>` | Yes | No | Inside div (wraps Derive) |
| `<div>Hi {x ? <a/> : <b/>}</div>` | Yes | Yes (ternary) | Inside div |
| `<input placeholder="Hi" />` | No | No | — (attributes untouched) |
