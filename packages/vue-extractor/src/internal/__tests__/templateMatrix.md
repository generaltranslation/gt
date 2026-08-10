# Vue template extraction matrix

The adversarial template suite ports the stable source-shaping behavior from
the React JSX extractor and renderer where Vue has an equivalent construct.
It covers rich native nesting, every supported variable component, static HTML
content props, context, Branch and Plural fallbacks/branches, independent
branch variable numbering, comments, whitespace, aliases, and component-name
normalization.

The React CLI parity audit additionally covers nested Branch/Plural trees,
legacy and CLDR plural forms, numeric boundaries and alternate literal forms,
Unicode and control characters, empty translations and branches, HTML
entities, Vue built-ins, custom and void elements, and formatter components
using dynamic `value` props. `Num`, `Currency`, and `DateTime` values are opaque
runtime variables; `Var` continues to require its value in the default slot.

Vue-specific cases cover `v-if`/`v-for` precedence, `v-for` and `v-slot`
destructuring defaults, executable directive arguments, slot scope, explicit
default slots, static `<component :is>` resolution, and compiler-valid
TypeScript expressions. Branch and Plural named slots are the Vue equivalent
of React branch props containing rich JSX.

Static default-slot content authored on ordinary components and Vue built-ins
participates in the surrounding T just like React component children. Their
named slots stay opaque to that outer translation and may contain independent
T components. Component implementation content is never inspected. Scoped
default slots and dynamic slot names are rejected because their content cannot
be known deterministically at extraction time.

The following behavior is intentionally unsupported and must produce a
diagnostic instead of a partial catalog entry:

- dynamic content outside Var, Num, DateTime, or Currency;
- nested T components unless the inner T is inside an opaque Var;
- source-shaping directives inside T, including `v-if`, `v-for`, `v-html`, and
  `v-text`;
- dynamic translatable HTML props, unknown dynamic components, runtime slot
  outlets, scoped default slots, and dynamic slot names;
- React-only Derive/autoderive behavior; and
- `$maxChars`, `$format`, ICU formatting, and interpolation. gt-vue currently
  extracts context-only plain strings.

The real-runtime parity probe compiles the same Branch and Plural templates
with Vue and renders them through gt-vue SSR. Catalog keys computed only from
extractor output must produce the translated SSR output, which protects the
hash boundary that ordinary unit snapshots cannot validate alone.

Malformed SFC structure, malformed script blocks, external script/template
blocks, and unsupported block languages are file-fatal. The extractor emits a
clear diagnostic and no partial results, preventing Vue's recovery AST from
shrinking a catalog. A semantic error in one translation remains entry-local:
other valid entries are returned alongside the diagnostic so the CLI can abort
the catalog operation without losing precise source feedback.
