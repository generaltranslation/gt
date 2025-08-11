import { T, Branch, Plural, Var, Num, Currency, DateTime } from 'gt-next';

// Test cases specifically designed to expose div vs span whitespace behavior differences
export default function DivVsSpanWhitespaceTests() {
  const count = 3;
  const amount = 99.99;
  const variable = "test";

  return (
    <>
      {/* ========== BASIC DIV VS SPAN WHITESPACE ========== */}
      
      {/* Same content in div vs span - whitespace should be handled identically */}
      <T id="div-vs-span-basic">
        <Branch
          branch="element"
          div_version={<div>Content with spaces</div>}
          span_version={<span>Content with spaces</span>}
        />
      </T>

      {/* Leading/trailing spaces with div vs span */}
      <T id="leading-trailing-spaces">
        <Branch
          branch="element"
          div_version={<div> Leading and trailing spaces </div>}
          span_version={<span> Leading and trailing spaces </span>}
        />
      </T>

      {/* ========== WHITESPACE BETWEEN ELEMENTS ========== */}
      
      {/* Text before div vs span */}
      <T id="text-before-element">
        <Branch
          branch="element"
          div_version={<>Text before <div>div content</div></>}
          span_version={<>Text before <span>span content</span></>}
        />
      </T>

      {/* Text after div vs span */}
      <T id="text-after-element">
        <Branch
          branch="element"
          div_version={<><div>div content</div> text after</>}
          span_version={<><span>span content</span> text after</>}
        />
      </T>

      {/* Text both sides of div vs span */}
      <T id="text-both-sides">
        <Branch
          branch="element"
          div_version={<>Before <div>div content</div> after</>}
          span_version={<>Before <span>span content</span> after</>}
        />
      </T>

      {/* Multiple spaces around elements */}
      <T id="multiple-spaces">
        <Branch
          branch="element"
          div_version={<>Text   <div>div content</div>   more text</>}
          span_version={<>Text   <span>span content</span>   more text</>}
        />
      </T>

      {/* ========== NEWLINES AND INDENTATION ========== */}
      
      {/* Newlines before/after div vs span */}
      <T id="newlines">
        <Branch
          branch="element"
          div_version={<>
            Text before
            <div>div content</div>
            text after
          </>}
          span_version={<>
            Text before
            <span>span content</span>
            text after
          </>}
        />
      </T>

      {/* Mixed whitespace types */}
      <T id="mixed-whitespace">
        <Branch
          branch="element"
          div_version={<>Text	<div>div with tab</div> text</>}
          span_version={<>Text	<span>span with tab</span> text</>}
        />
      </T>

      {/* ========== NESTED ELEMENT SCENARIOS ========== */}
      
      {/* Div vs span containing other elements */}
      <T id="nested-elements">
        <Branch
          branch="container"
          div_version={
            <div>
              Start <strong>bold</strong> middle <em>italic</em> end
            </div>
          }
          span_version={
            <span>
              Start <strong>bold</strong> middle <em>italic</em> end
            </span>
          }
        />
      </T>

      {/* Variable components inside div vs span */}
      <T id="variables-in-container">
        <Branch
          branch="container"
          div_version={
            <div>
              Count: <Num>{count}</Num> Amount: <Currency currency="USD">{amount}</Currency>
            </div>
          }
          span_version={
            <span>
              Count: <Num>{count}</Num> Amount: <Currency currency="USD">{amount}</Currency>
            </span>
          }
        />
      </T>

      {/* ========== COMPLEX WHITESPACE PATTERNS ========== */}
      
      {/* Multiple consecutive elements */}
      <T id="consecutive-elements">
        <Branch
          branch="pattern"
          div_version={
            <>
              <div>First</div> <div>Second</div> <div>Third</div>
            </>
          }
          span_version={
            <>
              <span>First</span> <span>Second</span> <span>Third</span>
            </>
          }
        />
      </T>

      {/* No spaces between elements */}
      <T id="no-spaces">
        <Branch
          branch="pattern"
          div_version={
            <>
              <div>First</div><div>Second</div><div>Third</div>
            </>
          }
          span_version={
            <>
              <span>First</span><span>Second</span><span>Third</span>
            </>
          }
        />
      </T>

      {/* Mixed spacing patterns */}
      <T id="mixed-spacing">
        <Branch
          branch="pattern"
          div_version={
            <>
              <div>First</div><div>No space</div> <div>With space</div>  <div>Two spaces</div>
            </>
          }
          span_version={
            <>
              <span>First</span><span>No space</span> <span>With space</span>  <span>Two spaces</span>
            </>
          }
        />
      </T>

      {/* ========== EMPTY ELEMENT SCENARIOS ========== */}
      
      {/* Empty div vs span */}
      <T id="empty-elements">
        <Branch
          branch="empty"
          div_version={<>Text <div></div> more text</>}
          span_version={<>Text <span></span> more text</>}
        />
      </T>

      {/* Empty elements with only whitespace */}
      <T id="whitespace-only">
        <Branch
          branch="empty"
          div_version={<>Text <div> </div> more text</>}
          span_version={<>Text <span> </span> more text</>}
        />
      </T>

      {/* ========== FRAGMENT VS ELEMENT CONTAINER ========== */}
      
      {/* Same content in fragment vs div vs span */}
      <T id="fragment-vs-elements">
        <Branch
          branch="container"
          fragment={<>Content with <Var>{variable}</Var> variable</>}
          div_version={<div>Content with <Var>{variable}</Var> variable</div>}
          span_version={<span>Content with <Var>{variable}</Var> variable</span>}
        />
      </T>

      {/* Nested fragments vs elements */}
      <T id="nested-containers">
        <Branch
          branch="nesting"
          fragment_nested={
            <>
              Outer text
              <>Inner fragment with <Var>{variable}</Var></>
              More outer text
            </>
          }
          div_nested={
            <div>
              Outer text
              <div>Inner div with <Var>{variable}</Var></div>
              More outer text
            </div>
          }
          span_nested={
            <span>
              Outer text
              <span>Inner span with <Var>{variable}</Var></span>
              More outer text
            </span>
          }
        />
      </T>

      {/* ========== PLURAL CONTEXT DIFFERENCES ========== */}
      
      {/* Plural branches with div vs span containers */}
      <T id="plural-containers">
        <Plural
          n={count}
          singular={<div>One item in div</div>}
          plural={<span>Multiple items in span</span>}
        />
      </T>

      {/* Complex plural with mixed containers */}
      <T id="plural-mixed-containers">
        <Plural
          n={count}
          singular={
            <div>
              You have <Num>{count}</Num> item
            </div>
          }
          plural={
            <span>
              You have <Num>{count}</Num> items
            </span>
          }
        />
      </T>

      {/* ========== SIBLING CONTEXT DIFFERENCES ========== */}
      
      {/* First sibling behavior */}
      <T id="first-sibling">
        <Branch
          branch="position"
          div_first={<><div>First div</div> followed by text</>}
          span_first={<><span>First span</span> followed by text</>}
        />
      </T>

      {/* Last sibling behavior */}
      <T id="last-sibling">
        <Branch
          branch="position"
          div_last={<>Text before <div>Last div</div></>}
          span_last={<>Text before <span>Last span</span></>}
        />
      </T>

      {/* Middle sibling behavior */}
      <T id="middle-sibling">
        <Branch
          branch="position"
          div_middle={<>Before <div>Middle div</div> after</>}
          span_middle={<>Before <span>Middle span</span> after</>}
        />
      </T>

      {/* Only child behavior */}
      <T id="only-child">
        <Branch
          branch="position"
          div_only={<><div>Only div child</div></>}
          span_only={<><span>Only span child</span></>}
        />
      </T>

      {/* ========== WHITESPACE NORMALIZATION EDGE CASES ========== */}
      
      {/* Multiple whitespace types */}
      <T id="whitespace-types">
        <Branch
          branch="type"
          div_version={<>Text \t<div>div with tab before</div>\n text with newline</>}
          span_version={<>Text \t<span>span with tab before</span>\n text with newline</>}
        />
      </T>

      {/* Boundary whitespace with variables */}
      <T id="boundary-with-variables">
        <Branch
          branch="boundary"
          div_version={
            <div>
              Start <Var>{variable}</Var> middle <Num>{count}</Num> end
            </div>
          }
          span_version={
            <span>
              Start <Var>{variable}</Var> middle <Num>{count}</Num> end
            </span>
          }
        />
      </T>

      {/* ========== REGRESSION TESTS FOR KNOWN ISSUES ========== */}
      
      {/* Pattern that might cause hash mismatches */}
      <T id="regression-whitespace">
        <Branch
          branch="regression"
          div_pattern={
            <>
              Normal text <div>and some nesting</div> with trailing space
            </>
          }
          span_pattern={
            <>
              Normal text <span>and some nesting</span> with trailing space
            </>
          }
        />
      </T>

      {/* Complex mixed element types */}
      <T id="mixed-element-types">
        <Branch
          branch="mixed"
          div_heavy={
            <div>
              <div>Nested div</div> text <div>Another div</div>
            </div>
          }
          span_heavy={
            <span>
              <span>Nested span</span> text <span>Another span</span>
            </span>
          }
          mixed={
            <div>
              <span>Span in div</span> text <span>Another span</span>
            </div>
          }
        />
      </T>

      {/* ========== STRESS TEST SCENARIOS ========== */}
      
      {/* Maximum whitespace complexity */}
      <T id="whitespace-stress">
        <Branch
          branch="stress"
          div_complex={
            <div>
              	Text with tab
              <div>  Padded div  </div>
              
              Text after newlines
              <div>
                Multi
                line
                content
              </div>
              Final text	
            </div>
          }
          span_complex={
            <span>
              	Text with tab
              <span>  Padded span  </span>
              
              Text after newlines
              <span>
                Multi
                line
                content
              </span>
              Final text	
            </span>
          }
        />
      </T>
    </>
  );
}

/*
DIV VS SPAN WHITESPACE TEST COVERAGE:

1. **Basic Element Differences:**
   - Same content in div vs span containers
   - Leading/trailing space handling
   - Content whitespace preservation

2. **Inter-element Whitespace:**
   - Text before/after elements
   - Multiple spaces around elements
   - Mixed whitespace types (tabs, newlines)

3. **Sibling Context Effects:**
   - First/middle/last/only sibling behavior
   - How element type affects adjacent whitespace

4. **Container Type Impact:**
   - Fragment vs div vs span containers
   - Nested container combinations
   - Variable components in different containers

5. **Normalization Patterns:**
   - Multiple consecutive spaces
   - Mixed whitespace character types
   - Boundary condition differences

6. **Edge Cases:**
   - Empty elements
   - Elements with only whitespace
   - Complex nesting patterns

7. **Regression Prevention:**
   - Known problematic whitespace patterns
   - Hash mismatch scenarios
   - Mixed element type combinations

EXPECTED BEHAVIORS TO TEST:

- Block elements (div) should handle leading/trailing whitespace differently from inline elements (span)
- Whitespace adjacent to block elements might be collapsed differently
- Sibling position (first/last/middle/only) should affect whitespace preservation consistently
- Fragment containers should behave differently from element containers
- Variable components should maintain consistent spacing regardless of container type

These tests will expose any inconsistencies in how your plugin handles whitespace normalization between different element types that browsers treat differently.
*/