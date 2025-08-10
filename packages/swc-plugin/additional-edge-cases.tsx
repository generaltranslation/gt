import { T, Branch, Plural, Var, Num, Currency, DateTime } from 'gt-next';

// Edge cases designed to test the SWC plugin hash calculation

export default function AdditionalEdgeCases() {
  const count = 5;
  const amount = 99.99;
  const date = new Date();
  const location = "home";

  return (
    <>
      {/* Edge Case 1: Deeply nested Branch components */}
      <T id="nested-branches">
        <Branch
          branch={location}
          home={
            <Branch
              branch="time"
              morning="Good morning at home"
              evening={
                <>
                  Good evening at <Var>home</Var> with{" "}
                  <Branch
                    branch="weather"
                    sunny="sunny skies"
                    rainy="rainy weather"
                  />
                </>
              }
            />
          }
          work="At the office"
        />
      </T>

      {/* Edge Case 2: Complex numeric edge cases */}
      <T id="numeric-extremes">
        <Plural
          n={count}
          zero={0}
          one={-0}
          two={Number.MAX_SAFE_INTEGER}
          few={Number.MIN_SAFE_INTEGER}
          many={1.7976931348623157e+308}
          other={-1.7976931348623157e+308}
        />
      </T>

      {/* Edge Case 3: Special JavaScript values in branches */}
      <T id="special-values">
        <Branch
          branch="type"
          number={42}
          bigNumber={9007199254740991}
          scientific={1e-20}
          negativeScientific={-1e20}
          hex={0xdeadbeef}
          octal={0o755}
          binary={0b11111111}
        />
      </T>

      {/* Edge Case 4: Whitespace preservation in complex structures */}
      <T id="whitespace-complex">
        <Branch
          branch="format"
          compact={<>No spaces<Var>here</Var>at all</>}
          spaced={<> Lots   of    spaces   <Var> here </Var>   everywhere </>}
          mixed={
            <>
              Text<span>  embedded  spaces  </span>more text  
              <Var>   padded var   </Var>
                final text   
            </>
          }
        />
      </T>

      {/* Edge Case 5: Multiple variable types in single branch */}
      <T id="mixed-variables">
        <Plural
          n={count}
          singular={
            <>
              Transaction: <Currency currency="USD">{amount}</Currency> on{" "}
              <DateTime format="short">{date}</DateTime> for{" "}
              <Num format="percent">{0.15}</Num> tax with{" "}
              <Var name="reference">REF-123</Var>
            </>
          }
          plural={
            <div>
              <Currency currency="EUR">{amount * count}</Currency> total from{" "}
              <Num>{count}</Num> transactions on{" "}
              <DateTime format="long">{date}</DateTime>
            </div>
          }
        />
      </T>

      {/* Edge Case 6: Empty and minimal content variations */}
      <T id="minimal-content">
        <Branch
          branch="content"
          empty=""
          space=" "
          newline={"\n"}
          tab={"\t"}
          minimal={<span></span>}
          singleChar="x"
        />
      </T>

      {/* Edge Case 7: Complex fragment nesting */}
      <T id="fragment-nesting">
        <Plural
          n={count}
          singular={
            <>
              Outer fragment
              <>
                Nested fragment with <Var>variable</Var>
                <>
                  Deep nested with <Num>{count}</Num>
                  <></>
                  <>More nesting</>
                </>
              </>
              Back to outer
            </>
          }
          plural={
            <div>
              <>Fragment in div</>
              <span>
                <>Fragment in span with <Currency currency="USD">{amount}</Currency></>
              </span>
            </div>
          }
        />
      </T>

      {/* Edge Case 8: Unicode and special characters */}
      <T id="unicode-chars">
        <Branch
          branch="language"
          english="Hello 👋 World"
          chinese="你好世界"
          arabic="مرحبا بالعالم"
          emoji="🚀 🌟 ✨ 💫 ⭐"
          symbols="© ® ™ € £ ¥ § ¶ † ‡"
          math="∞ ≠ ≤ ≥ ± ∓ × ÷ √"
        />
      </T>

      {/* Edge Case 9: Very long content strings */}
      <T id="long-content">
        <Branch
          branch="size"
          short="Brief"
          long={`Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`}
          mixed={
            <>
              Very long text with <Var>embedded variables</Var> that continues for a very long time and includes multiple <Num>{9999999}</Num> numeric values and <Currency currency="USD">{1234567.89}</Currency> monetary amounts spread throughout the content to test how the algorithm handles very large content blocks with mixed variable types.
            </>
          }
        />
      </T>

      {/* Edge Case 10: Boundary numeric values */}
      <T id="numeric-boundaries">
        <Plural
          n={count}
          zero={0.0}
          one={1e-323}  // Smallest positive number
          two={5e-324}  // Smallest subnormal
          few={1.7976931348623157e+308}  // Largest finite
          many={-1.7976931348623157e+308} // Largest negative finite
          other={2.2250738585072014e-308} // Smallest normal positive
        />
      </T>

      {/* Edge Case 11: Attribute edge cases with HTML props */}
      <T id="html-attributes" placeholder="Enter text" title="Tooltip text" alt="Alt text">
        <Branch
          branch="element"
          input={<input placeholder="Branch placeholder" title="Branch title" />}
          image={<img src="test.jpg" alt="Branch image" title="Branch image title" />}
          link={<a href="#" aria-label="Branch link" aria-describedby="desc">Link</a>}
        />
      </T>

      {/* Edge Case 12: Mixed element types in branches */}
      <T id="mixed-elements">
        <Plural
          n={count}
          singular={
            <article>
              <h1>Single Item</h1>
              <p>Description with <Var>details</Var></p>
              <footer>
                <>
                  Footer with <Currency currency="USD">{amount}</Currency>
                  <span>and <DateTime>{date}</DateTime></span>
                </>
              </footer>
            </article>
          }
          plural={
            <section>
              <header>
                <h2><Num>{count}</Num> Items</h2>
              </header>
              <main>
                <>
                  <p>Multiple items totaling <Currency currency="USD">{amount * count}</Currency></p>
                  <ul>
                    <li>Item with <Var>variable</Var></li>
                  </ul>
                </>
              </main>
            </section>
          }
        />
      </T>

      {/* Edge Case 13: Self-closing and void elements */}
      <T id="void-elements">
        <Branch
          branch="type"
          line={<><hr />Line break<br />New line</>}
          image={<><img src="test.jpg" alt="Test" />Image with <Var>caption</Var></>}
          input={<><input type="text" placeholder="Input" />Field with <Num>{count}</Num></>}
        />
      </T>

      {/* Edge Case 14: Duplicate content in different branches (should have same hash) */}
      <T id="duplicate-content">
        <Branch
          branch="copy"
          version1={
            <>
              Identical content with <Var>same variable</Var> and <Num>{count}</Num>
            </>
          }
          version2={
            <>
              Identical content with <Var>same variable</Var> and <Num>{count}</Num>
            </>
          }
          different={
            <>
              Different content with <Var>other variable</Var> and <Num>{count + 1}</Num>
            </>
          }
        />
      </T>

      {/* Edge Case 15: Component nesting edge cases */}
      <T id="component-nesting">
        <Branch
          branch="structure"
          nested={
            <div>
              <Plural
                n={count}
                singular={<span>Nested plural: <Var>single</Var></span>}
                plural={
                  <Branch
                    branch="inner"
                    option1="Double nested!"
                    option2={<>With <Currency currency="USD">{amount}</Currency></>}
                  />
                }
              />
            </div>
          }
          flat="Simple flat content"
        />
      </T>
    </>
  );
}