# JSX Auto-Insertion Rules

The JSX insertion pass automatically wraps translatable JSX content in `GtInternalTranslateJsx` (\_T) and dynamic expressions in `GtInternalVar` (\_Var) at build time. It operates on compiled JSX — after Vite/SWC transforms JSX syntax into `jsx()`/`jsxs()`/`jsxDEV()` calls.

## Why this document exists

These rules must be followed by **two independent systems** that need to agree on the same output:

1. **The compiler plugin** (this pass) — runs at build time and physically inserts \_T and \_Var components into the JSX tree.
2. **The CLI registration tool** — runs before the build to extract translatable content, compute hashes, and register translations with the GT API. When `enableAutoJsxInjection` is enabled, the CLI must **simulate** where \_T and \_Var would be inserted so it can compute hashes that match what the compiler will produce. If these two systems disagree — if the CLI thinks \_T wraps at one level but the compiler wraps at another — the hashes will be different and translation resolution will fail at runtime.

This document is the single source of truth for the insertion rules. Both the compiler pass and the CLI registration logic must implement these rules identically. Any change to these rules requires updating both systems.

---

## Rule 1: Insert _T at the highest level that directly contains text

_T wraps the children of the **first ancestor element that has non-whitespace text as a direct child**. It hugs the text as closely as possible while capturing the full translation unit.

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

### Expressions that do NOT need _Var (static/parseable):

```jsx
// String literals
<div>Hello World</div>
<div><_T>Hello World</_T></div>

// Numeric literals
<span>{42}</span>
<span><_T>{42}</_T></span>

// Static template literals (no interpolation)
<div>{`Hello`}</div>
<div><_T>{`Hello`}</_T></div>

// Boolean literals, null — these render nothing in React
<div>Text {true} {null}</div>
<div><_T>Text {true} {null}</_T></div>

// Negative numbers
<div>Temperature: {-5}</div>
<div><_T>Temperature: {-5}</_T></div>

// Special identifiers: undefined, NaN, Infinity
<div>Value: {undefined}</div>
<div><_T>Value: {undefined}</_T></div>

// Nested JSX elements — they are valid translation children, not variables
<div>Hello <b>World</b></div>
<div><_T>Hello <b>World</b></_T></div>
```

## Rule 5: No _T when there is no meaningful text

If an element's children contain no non-whitespace text and no opaque GT components, no _T is inserted.

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

// Only nested elements, no direct text
<div><span><img /></span></div>
<div><span><img /></span></div>  // unchanged
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

## Rule 7: User-written Var, Num, Currency, DateTime — hands off

User-imported variable components are left untouched. They are valid children of _T but their internals are not modified.

```jsx
// User Var inside auto-translated content
<div>Hello <Var>{name}</Var></div>
<div><_T>Hello <Var>{name}</Var></_T></div>
// Note: no _Var wrapping — user Var handles it

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

## Rule 9: Derive and Static — fully opaque, \_T wraps from parent

Same as Branch/Plural. Derive and Static are fully opaque — the pass does not enter their children or props. \_T wraps them from the parent level.

```jsx
// Derive as only child
<div><Derive>{getName()}</Derive></div>
<div><_T><Derive>{getName()}</Derive></_T></div>

// Static as only child
<div><Static>{getLabel()}</Static></div>
<div><_T><Static>{getLabel()}</Static></_T></div>
```

## Rule 10: Non-children props are independent (except Branch/Plural/Derive/Static)

For **regular components**, JSX in non-`children` props (e.g. `header`, `icon`, `footer`) is an independent subtree. The pass processes it separately — the parent's \_T state does not carry over. This is the default behavior for any component that is not a GT opaque component.

**Exception:** Branch, Plural, Derive, and Static are fully opaque (see Rules 8-9). Their prop arguments are NOT processed independently — they are skipped entirely.

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

---

## Import injection

When the pass inserts at least one _T, it automatically adds:

```javascript
import { GtInternalTranslateJsx, GtInternalVar } from 'gt-react/browser';
```

If `GtInternalTranslateJsx` is already imported from a GT source, no duplicate import is added.

---

## Summary table

| Scenario | _T inserted? | _Var inserted? | Where? |
|----------|-------------|----------------|--------|
| `<div>Hello</div>` | Yes | No | Inside div |
| `<div>{name}</div>` | No | No | — |
| `<div>Hello {name}</div>` | Yes | Yes (name) | Inside div |
| `<div><span>Hi</span></div>` | Yes | No | Inside span |
| `<div>Hi <b>W</b></div>` | Yes | No | Inside div |
| `<div>{a} {b}</div>` | No | No | — |
| `<T>Hello</T>` | No | No | — (hands off) |
| `<div><Var>{x}</Var></div>` | No | No | — (no text) |
| `<div>Hi <Var>{x}</Var></div>` | Yes | No | Inside div (user Var untouched) |
| `<div><Branch ...>F</Branch></div>` | Yes | No | Inside div (wraps Branch) |
| `<div><Derive>{x}</Derive></div>` | Yes | No | Inside div (wraps Derive) |
