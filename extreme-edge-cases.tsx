import { T, Branch, Plural, Var, Num, Currency, DateTime } from 'gt-next';

// Extreme edge cases designed to break the SWC plugin hash calculation
export default function ExtremeEdgeCases() {
  const count = 7;
  const amount = 123.45;
  const date = new Date();

  return (
    <>
      {/* ========== EXPRESSION CONTAINER EDGE CASES ========== */}
      
      {/* Empty JSX expressions {} mixed with content */}
      <T id="empty-expressions">
        <Branch
          branch="test"
          option1={<>Start {} middle {} end</>}
          option2={<>Before{}{}<></>After</>}
          option3={<>{}<span>element</span>{}</span>}
          option4="normal"
        />
      </T>

      {/* Mixed empty expressions and fragments */}
      <T id="mixed-empty">
        <Plural
          n={count}
          singular={<>Text{}<></>More text</>}
          plural={<>{}Fragment{}</>content{}</>}
          other={<><>{}{}</>}
        />
      </T>

      {/* ========== BOOLEAN CONTEXT EDGE CASES ========== */}
      
      {/* All boolean permutations in expressions */}
      <T id="boolean-expressions">
        <Branch
          branch="bool"
          true_val={<>{true}</>}
          false_val={<>{false}</>}
          mixed_true={<>Before {true} after</>}
          mixed_false={<>Before {false} after</>}
          multiple={<>{true}{false}{true}</>}
        />
      </T>

      {/* Boolean vs null vs undefined combinations */}
      <T id="falsy-values">
        <Plural
          n={1}
          zero={<>{null}</>}
          one={<>{undefined}</>}
          two={<>{false}</>}
          few={<>{true}{null}{undefined}</>}
          many={<>Mixed {false} and {null}</>}
          other="normal"
        />
      </T>

      {/* ========== NUMERIC PRECISION EDGE CASES ========== */}
      
      {/* Floating point precision boundaries */}
      <T id="float-precision">
        <Branch
          branch="precision"
          tiny={1e-324}          // Smallest possible positive number
          almost_zero={4.9e-324} // Just above smallest subnormal
          epsilon={2.220446049250313e-16} // Machine epsilon
          almost_one={0.9999999999999999}
          not_quite_two={1.9999999999999998}
          close_to_pi={3.141592653589793}
        />
      </T>

      {/* Scientific notation variations */}
      <T id="scientific-variations">
        <Plural
          n={count}
          zero={1.0e0}
          one={1.0e+0}
          two={1.0e-0}
          few={5.0e10}
          many={5.0e+10}
          other={5.0e-10}
        />
      </T>

      {/* ========== WHITESPACE PATHOLOGICAL CASES ========== */}
      
      {/* Zero-width characters and unusual spaces */}
      <T id="unusual-whitespace">
        <Branch
          branch="space"
          zero_width={<>word1​word2</> /* Zero-width space */}
          thin_space={<>word1 word2</> /* Thin space */}
          hair_space={<>word1 word2</> /* Hair space */}
          figure_space={<>word1 word2</> /* Figure space */}
          punctuation_space={<>word1 word2</> /* Punctuation space */}
          normal={<>word1 word2</>}
        />
      </T>

      {/* Mixed line endings and tabs */}
      <T id="line-endings">
        <Plural
          n={1}
          singular={<>Line1\nLine2</>}          /* Unix LF */
          plural={<>Line1\r\nLine2</>}         /* Windows CRLF */
          other={<>Line1\rLine2</>}            /* Old Mac CR */
        />
      </T>

      {/* ========== FRAGMENT PATHOLOGICAL NESTING ========== */}
      
      {/* Maximum fragment nesting with mixed empty/content */}
      <T id="fragment-chaos">
        <Branch
          branch="nested"
          option1={
            <>
              <>
                <>
                  <>
                    <>Text</>
                    <></>
                    <>More</>
                  </>
                  {}
                </>
                <span>Element</span>
              </>
              <>
                Final
              </>
            </>
          }
          option2={<><><><><>Flat</></>></></></>}
        />
      </T>

      {/* Fragments with alternating empty/content patterns */}
      <T id="alternating-fragments">
        <Plural
          n={count}
          singular={<></>Content<></>More<></>End</>}
          plural={<>Start<></>Middle<></>End<></>}
          other={<><></>Text<><></>}
        />
      </T>

      {/* ========== VARIABLE COMPONENT STRESS TESTS ========== */}
      
      {/* Variables with extreme naming edge cases */}
      <T id="variable-names">
        <Branch
          branch="names"
          option1={
            <>
              <Var name=""></Var>
              <Var name=" "></Var>
              <Var name="a"></Var>
              <Var name="123"></Var>
              <Var name="var-with-dashes"></Var>
              <Var name="var_with_underscores"></Var>
              <Var name="var.with.dots"></Var>
            </>
          }
          option2="normal"
        />
      </T>

      {/* Maximum variable density */}
      <T id="variable-density">
        <Plural
          n={1}
          singular={
            <>
              <Var>v1</Var><Num>1</Num><Currency currency="USD">1</Currency><DateTime>2023</DateTime>
              <Var>v2</Var><Num>2</Num><Currency currency="EUR">2</Currency><DateTime>2023</DateTime>
              <Var>v3</Var><Num>3</Num><Currency currency="JPY">3</Currency><DateTime>2023</DateTime>
            </>
          }
          plural={
            <>
              <DateTime>2023</DateTime><Currency currency="JPY">3</Currency><Num>3</Num><Var>v3</Var>
              <DateTime>2023</DateTime><Currency currency="EUR">2</Currency><Num>2</Num><Var>v2</Var>
              <DateTime>2023</DateTime><Currency currency="USD">1</Currency><Num>1</Num><Var>v1</Var>
            </>
          }
        />
      </T>

      {/* ========== SPECIAL IDENTIFIER EDGE CASES ========== */}
      
      {/* JavaScript reserved words and special identifiers */}
      <T id="special-identifiers">
        <Branch
          branch="special"
          nan_val={<>{NaN}</>}
          infinity_val={<>{Infinity}</>}
          neg_infinity={<>{-Infinity}</>}
          undefined_val={<>{undefined}</>}
          mixed={<>{NaN} and {Infinity} and {undefined}</>}
        />
      </T>

      {/* ========== UNICODE PATHOLOGICAL CASES ========== */}
      
      {/* Combining characters and normalization edge cases */}
      <T id="unicode-combining">
        <Plural
          n={1}
          singular="é"          /* Pre-composed */
          plural="é"            /* Decomposed (e + combining acute) */
          other="ñ vs ñ"        /* Different normalizations */
        />
      </T>

      {/* Surrogate pairs and emoji variations */}
      <T id="unicode-surrogates">
        <Branch
          branch="emoji"
          basic="👍"
          skin_tone="👍🏽"
          zwj_sequence="👨‍👩‍👧‍👦"          /* Family emoji */
          flag="🇺🇸"                         /* Flag emoji */
          text_vs_emoji="©️ vs ©"           /* Text vs emoji variation */
        />
      </T>

      {/* ========== MATHEMATICAL EXPRESSIONS IN NUMBERS ========== */}
      
      {/* Edge cases with mathematical operations that resolve to constants */}
      <T id="math-expressions">
        <Plural
          n={count}
          zero={+0}
          one={-0}
          two={0/1}
          few={1/3}
          many={Math.PI}
          other={Math.E}
        />
      </T>

      {/* Bitwise operations */}
      <T id="bitwise">
        <Branch
          branch="bits"
          shift_left={1 << 8}
          shift_right={256 >> 3}
          xor={0xff ^ 0x00}
          and={0xff & 0x0f}
          or={0xf0 | 0x0f}
          not={~0}
        />
      </T>

      {/* ========== TEMPLATE LITERAL EDGE CASES ========== */}
      
      {/* Template literals with unusual escape sequences */}
      <T id="template-escapes">
        <Plural
          n={1}
          singular={`\\x41`}      /* Hex escape */
          plural={`\\u0041`}      /* Unicode escape */
          other={`\\101`}         /* Octal escape */
        />
      </T>

      {/* Raw strings vs processed strings */}
      <T id="raw-vs-processed">
        <Branch
          branch="strings"
          raw={String.raw`Path\to\file.txt`}
          processed={`Path\to\file.txt`}
          mixed={`Raw: ${String.raw`\t`} vs Processed: \t`}
        />
      </T>

      {/* ========== BOUNDARY OVERFLOW CONDITIONS ========== */}
      
      {/* Maximum attribute count */}
      <T id="max-attributes">
        <Branch
          branch="many"
          a1="1" a2="2" a3="3" a4="4" a5="5" a6="6" a7="7" a8="8" a9="9" a10="10"
          b1="1" b2="2" b3="3" b4="4" b5="5" b6="6" b7="7" b8="8" b9="9" b10="10"
          c1="1" c2="2" c3="3" c4="4" c5="5" c6="6" c7="7" c8="8" c9="9" c10="10"
          d1="1" d2="2" d3="3" d4="4" d5="5" d6="6" d7="7" d8="8" d9="9" d10="10"
          e1="1" e2="2" e3="3" e4="4" e5="5" e6="6" e7="7" e8="8" e9="9" e10="10"
        />
      </T>

      {/* ========== COUNTER SYNCHRONIZATION EDGE CASES ========== */}
      
      {/* Nested branches with identical variable patterns */}
      <T id="counter-sync">
        <Branch
          branch="outer"
          path1={
            <Branch
              branch="inner"
              option1={
                <>
                  <Var>shared1</Var>
                  <Num>shared2</Num>
                  <Branch
                    branch="deepest"
                    a={<Var>deep1</Var>}
                    b={<Var>deep2</Var>}
                  />
                </>
              }
              option2={
                <>
                  <Var>shared1</Var>
                  <Num>shared2</Num>
                  <Branch
                    branch="deepest"
                    a={<Var>deep1</Var>}
                    b={<Var>deep2</Var>}
                  />
                </>
              }
            />
          }
          path2={
            <Branch
              branch="inner"
              option1={
                <>
                  <Var>shared1</Var>
                  <Num>shared2</Num>
                  <Branch
                    branch="deepest"
                    a={<Var>deep1</Var>}
                    b={<Var>deep2</Var>}
                  />
                </>
              }
              option2={
                <>
                  <Var>shared1</Var>
                  <Num>shared2</Num>
                  <Branch
                    branch="deepest"
                    a={<Var>deep1</Var>}
                    b={<Var>deep2</Var>}
                  />
                </>
              }
            />
          }
        />
      </T>

      {/* ========== SERIALIZATION EDGE CASES ========== */}
      
      {/* Objects that might cause JSON serialization issues */}
      <T id="json-edge-cases">
        <Plural
          n={count}
          zero={0}
          one={1}
          two={-1}
          few={Infinity}
          many={-Infinity}
          other={NaN}
        />
      </T>

      {/* String values that look like JSON */}
      <T id="json-like-strings">
        <Branch
          branch="json"
          object='{"key": "value"}'
          array='[1, 2, 3]'
          nested='{"a": {"b": [1, {"c": true}]}}'
          escaped='{"quote": "He said \\"hello\\""}'
        />
      </T>

      {/* ========== REGRESSION STRESS TESTS ========== */}
      
      {/* Pattern that previously caused issues */}
      <T id="regression-test">
        <Plural
          n={count}
          singular={
            <>
              Text content
              <>
                Nested fragment with <Var>variable1</Var>
                <>
                  Deeply nested with <Num>{count}</Num>
                  {}
                  <></>
                  {}
                  <span>Element</span>
                  {}
                  <>Final nested</>
                </>
              </>
              Back to top level
            </>
          }
          plural={
            <div>
              <>Fragment in div</> with <Var>variable2</Var>
              <span>
                <>Deep fragment with <Currency currency="USD">{amount}</Currency></>
                {null}
                {undefined}
                {false}
                {}
              </span>
            </div>
          }
        />
      </T>

      {/* Maximum complexity single component */}
      <T id="maximum-complexity">
        <Branch
          branch="complex"
          option1={
            <>
              Start {true} {false} {null} {undefined} {} <></>
              <Plural
                n={count}
                zero={<>Zero with <Var name="v1">var1</Var></>}
                one={<>One with <Num name="n1">{count}</Num> {NaN}</>}
                two={<>Two with <Currency currency="USD" name="c1">{amount}</Currency> {Infinity}</>}
                few={<>Few with <DateTime name="d1">{date}</DateTime> {-Infinity}</>}
                many={
                  <Branch
                    branch="nested"
                    a={<>Option A with {Math.PI}</>}
                    b={<>Option B with {Math.E}</>}
                    c={<>{0xff} and {0o755} and {0b1111}</>}
                  />
                }
                other={<>Other {+0} vs {-0}</>}
              />
              End {} <></>
            </>
          }
          option2="Simple option for comparison"
        />
      </T>
    </>
  );
}

/*
EXTREME EDGE CASES COVERED:

1. **Expression Container Edge Cases:**
   - Empty JSX expressions {} mixed with content
   - Complex patterns of {} and <></>
   - Nested empty expressions

2. **Boolean Context Edge Cases:**
   - All boolean permutations in expressions
   - Boolean vs null vs undefined combinations
   - Mixed falsy values

3. **Numeric Precision Edge Cases:**
   - Floating point precision boundaries
   - Machine epsilon and subnormal numbers
   - Scientific notation variations (+/- exponents)

4. **Whitespace Pathological Cases:**
   - Zero-width characters
   - Unusual unicode spaces (thin, hair, figure, punctuation)
   - Mixed line endings (LF, CRLF, CR)

5. **Fragment Pathological Nesting:**
   - Maximum fragment nesting with mixed empty/content
   - Alternating empty/content patterns
   - Complex fragment hierarchies

6. **Variable Component Stress Tests:**
   - Variables with edge case names (empty, spaces, special chars)
   - Maximum variable density
   - Reverse order variable patterns

7. **Special Identifier Edge Cases:**
   - JavaScript reserved words (NaN, Infinity, undefined)
   - Mixed special identifiers in expressions

8. **Unicode Pathological Cases:**
   - Combining characters and normalization differences
   - Surrogate pairs, emoji variations, ZWJ sequences
   - Text vs emoji selectors

9. **Mathematical Expressions:**
   - Operations that resolve to constants (Math.PI, Math.E)
   - Bitwise operations (<<, >>, ^, &, |, ~)
   - Edge mathematical values

10. **Template Literal Edge Cases:**
    - Unusual escape sequences (hex, unicode, octal)
    - Raw strings vs processed strings
    - Mixed raw/processed content

11. **Boundary Overflow Conditions:**
    - Maximum attribute count (50+ attributes)
    - Stress testing component limits

12. **Counter Synchronization Edge Cases:**
    - Nested branches with identical variable patterns
    - Deep nesting with parallel paths
    - Counter consistency across complex hierarchies

13. **Serialization Edge Cases:**
    - Values that might cause JSON issues (Infinity, NaN)
    - String values that look like JSON
    - Escaped quote handling

14. **Regression Stress Tests:**
    - Known problematic patterns
    - Maximum complexity single component
    - Everything combined in one test

These edge cases should expose any remaining weaknesses in:
- Empty expression handling
- Boolean serialization
- Floating point precision
- Unicode normalization
- Fragment nesting logic
- Counter management
- JSON serialization stability
*/