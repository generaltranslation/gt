import { T, Plural, Branch, Var, Num, Currency, DateTime } from "gt-next";

export default function ExtremeEdgeCases() {
  const variable = "test";
  const count = 42;
  const price = 9.99;
  const timestamp = new Date();

  return (
    <>
      {/* ========== EXTREME WHITESPACE SCENARIOS ========== */}

      {/* Only whitespace variations */}
      <T>
        <Plural n={1} singular={<>  </>} plural={<>    </>} />
      </T>

      <T>
        <Plural n={1} singular={<>\t</>} plural={<>\n</>} />
      </T>

      {/* Mixed whitespace preservation */}
      <T>
        <span>start</span>   <span>middle</span>   <span>end</span>
      </T>

      {/* Whitespace sandwich scenarios */}
      <T>
           <div>surrounded by spaces</div>     
      </T>

      {/* Fragment whitespace edge cases */}
      <T>
        <>  leading spaces</>
        <>trailing spaces  </>
        <>  both sides  </>
      </T>

      {/* ========== FRAGMENT NESTING EXTREMES ========== */}

      {/* Deeply nested fragments */}
      <T>
        <Plural n={1} singular={
          <>
            <>
              <>
                <>deep fragment nesting</>
              </>
            </>
          </>
        } plural="files" />
      </T>

      {/* Fragment with mixed content types */}
      <T>
        <Branch branch="mixed" option1={
          <>
            text
            <span>element</span>
            {42}
            {true}
            {null}
            more text
          </>
        } option2="simple" />
      </T>

      {/* Fragment boundaries with elements */}
      <T>
        <>start</>
        <div>middle</div>
        <>end</>
      </T>

      {/* ========== NUMERIC EDGE CASES ========== */}

      {/* Extreme number values */}
      <T>
        <Plural 
          n={1}
          zero={0.0}
          one={-0}
          two={999999999999}
          few={-999999999999}
          many={0.000000001}
          other={-0.000000001}
        />
      </T>

      {/* Special float values */}
      <T>
        <Branch 
          branch="floats"
          tiny={0.1}
          precise={3.141592653589793}
          scientific={1.23e-10}
          big_scientific={1.23e10}
        />
      </T>

      {/* Hexadecimal variations */}
      <T>
        <Branch
          branch="hex"
          small={0x1}
          medium={0xABC}
          large={0xDEADBEEF}
          mixed={0x123abc}
        />
      </T>

      {/* ========== STRING ESCAPING EXTREMES ========== */}

      {/* All escape sequences */}
      <T>
        <Plural
          n={1}
          singular="Quotes: &quot; and &apos;"
          plural="Backslashes: \\ and \\n and \\t"
          other={`Unicode: \\u0041 and \\x41`}
        />
      </T>

      {/* Raw strings with problematic characters */}
      <T>
        <Branch
          branch="raw"
          json={`{"key": "value", "array": [1,2,3]}`}
          regex={`/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/`}
          path={`C:\\Program Files\\App\\file.exe`}
        />
      </T>

      {/* URLs and complex strings */}
      <T>
        <Branch
          branch="complex"
          url="https://example.com:8080/path?param=value&other=123#section"
          email="user.name+tag@subdomain.example-site.co.uk"
          css="body { margin: 0; padding: 10px; font-family: Arial, sans-serif; }"
        />
      </T>

      {/* ========== BOOLEAN AND NULL COMBINATIONS ========== */}

      {/* All boolean/null variations */}
      <T>
        <Plural
          n={1}
          zero={false}
          one={true}
          two={null}
          few=""
          many={0}
          other="false"
        />
      </T>

      {/* Mixed boolean contexts */}
      <T>
        <Branch
          branch="booleans"
          truthy={true}
          falsy={false}
          nullish={null}
          empty=""
          zero={0}
          string_true="true"
          string_false="false"
        />
      </T>

      {/* ========== TEMPLATE LITERAL STRESS TESTS ========== */}

      {/* Complex template escaping */}
      <T>
        <Plural
          n={1}
          singular={`Template with \\${escaped} and \\`backticks\\``}
          plural={`Multi
            line
            template
            literal`}
          other={`Mixed "quotes" and 'apostrophes' in template`}
        />
      </T>

      {/* Template with special characters */}
      <T>
        <Branch
          branch="templates"
          code="function test() { return `Hello ${name}`; }"
          markdown={`# Title\n\n**Bold** and *italic* text.\n\n\`\`\`js\nconst x = 42;\n\`\`\``}
          xml={`<root><child attr="value">content</child></root>`}
        />
      </T>

      {/* ========== COMPONENT ATTRIBUTE EXTREMES ========== */}

      {/* Attributes with every valid plural form */}
      <T>
        <Plural
          n={count}
          zero=""
          one="1"
          two="2"  
          few="few"
          many="many"
          other="other"
          singular="sing"
          plural="plur"
        />
      </T>

      {/* Branch with many options */}
      <T>
        <Branch
          branch="many_options"
          a="option a"
          b="option b" 
          c="option c"
          d="option d"
          e="option e"
          f={<>fragment f</>}
          g={<span>element g</span>}
          h={42}
          i={true}
          j={null}
        />
      </T>

      {/* ========== VARIABLE COMPONENT STRESS TESTS ========== */}

      {/* Variables with edge case names */}
      <T>
        <Var name="_underscore">content</Var>
        <Var name="camelCase">content</Var>
        <Var name="kebab-case">content</Var>
        <Var name="snake_case">content</Var>
        <Var name="PascalCase">content</Var>
        <Var name="123numeric">content</Var>
        <Var name="special!@#$%">content</Var>
      </T>

      {/* Variable content variations */}
      <T>
        <Num name="n1">42</Num>
        <Num name="n2">{-42}</Num>
        <Num name="n3">3.14159</Num>
        <Num name="n4">{0}</Num>
        <Num name="n5">{0xFF}</Num>
      </T>

      {/* Currency with different formats */}
      <T>
        <Currency currency="USD" name="usd1">{price}</Currency>
        <Currency currency="EUR" name="eur1">1234.56</Currency>
        <Currency currency="JPY" name="jpy1">1000</Currency>
        <Currency currency="BTC" name="btc1">0.00123456</Currency>
      </T>

      {/* DateTime with different values */}
      <T>
        <DateTime name="dt1">{timestamp}</DateTime>
        <DateTime name="dt2">2024-01-01T00:00:00Z</DateTime>
        <DateTime name="dt3">{new Date(0)}</DateTime>
        <DateTime name="dt4">invalid-date-string</DateTime>
      </T>

      {/* ========== MAXIMAL NESTING SCENARIOS ========== */}

      {/* 7-level component nesting */}
      <T>
        <Branch branch="l1" option1={
          <Plural n={1} singular={
            <Branch branch="l2" option1={
              <Plural n={1} singular={
                <Branch branch="l3" option1={
                  <Plural n={1} singular={
                    <Branch branch="l4" option1={
                      <Plural n={1} singular={
                        <Branch branch="l5" option1={
                          <Plural n={1} singular={
                            <Branch branch="l6" option1={
                              <Var name="deep7">maximum depth</Var>
                            } option2="l6 end" />
                          } plural="l5 plural" />
                        } option2="l5 end" />
                      } plural="l4 plural" />
                    } option2="l4 end" />
                  } plural="l3 plural" />
                } option2="l3 end" />
              } plural="l2 plural" />
            } option2="l2 end" />
          } plural="l1 plural" />
        } option2="l1 end" />
      </T>

      {/* Mixed nesting with all component types */}
      <T>
        <div className="wrapper">
          <Branch branch="outer" option1={
            <>
              <span>Before plural</span>
              <Plural n={count} singular={
                <div>
                  Single item: <Num name="single_count">{count}</Num>
                  costing <Currency currency="USD" name="single_price">{price}</Currency>
                  at <DateTime name="single_time">{timestamp}</DateTime>
                  in <Branch branch="location" home={
                    <>home folder with <Var name="home_var">variable</Var></>
                  } work="office" />
                </div>
              } plural={
                <div>
                  Multiple items: <Num name="multi_count">{count}</Num>
                  costing <Currency currency="USD" name="multi_price">{price * count}</Currency>
                  <>with fragments</> and <span>elements</span>
                </div>
              } />
              <span>After plural</span>
            </>
          } option2="simple option" />
        </div>
      </T>

      {/* ========== BOUNDARY VIOLATION TESTS ========== */}

      {/* Empty everything */}
      <T></T>

      <T>
        <Plural n={1} />
      </T>

      <T>
        <Branch branch="test" />
      </T>

      <T>
        <Var />
      </T>

      {/* Only invalid attributes */}
      <T>
        <Plural n={1} invalid="ignored" also_invalid="also ignored" />
      </T>

      <T>
        <Branch branch="test" invalid="ignored" also_invalid="also ignored" />
      </T>

      {/* Missing required attributes */}
      <T>
        <Plural singular="file" plural="files" />
      </T>

      <T>
        <Branch option1="test" option2="test2" />
      </T>

      {/* ========== UNICODE EXTREMES ========== */}

      {/* Every major unicode category */}
      <T>
        <Branch
          branch="unicode"
          latin="àáâãäåæçèéêëìíîï"
          cyrillic="абвгдежзийклмнопрстуфхцчшщъыьэюя"
          greek="αβγδεζηθικλμνξοπρστυφχψω"
          arabic="ابتثجحخدذرزسشصضطظعغفقكلمنهوي"
          hebrew="אבגדהוזחטיכלמנסעפצקרשת"
          chinese="你好世界中文测试"
          japanese="こんにちは世界ひらがなカタカナ漢字"
          korean="안녕하세요세계한글테스트"
          emoji="🌍🌎🌏🚀⚡️🎉💯✨🔥💎🌟⭐️🎯"
          symbols="©®™€£¥¢¤§¶†‡•…‰‱′″‴‵‶‷‸‹›«»¿¡"
          math="∀∂∃∅∇∈∉∋∌∏∑−∕∗∘∙√∝∞∟∠∡∢∣∤∥∦∧∨∩∪∫∬∭∮"
        />
      </T>

      {/* Mixed text directions */}
      <T>
        <Plural
          n={1}
          singular="English left-to-right"
          plural="العربية من اليمين إلى اليسار"
          other="עברית מימין לשמאל"
        />
      </T>

      {/* ========== STRESS TEST: MASSIVE COMPONENTS ========== */}

      {/* Component with 50+ variables for counter testing */}
      <T>
        <div>
          {Array.from({length: 20}, (_, i) => (
            <div key={i}>
              Item {i}: 
              <Var name={`var_${i}`}>value_{i}</Var> - 
              <Num name={`num_${i}`}>{i}</Num> - 
              <Currency currency="USD" name={`price_${i}`}>{i * 1.99}</Currency> - 
              <DateTime name={`time_${i}`}>{new Date(2024, 0, i + 1)}</DateTime>
            </div>
          ))}
        </div>
      </T>

      {/* ========== REGRESSION PREVENTION TESTS ========== */}

      {/* Every known problematic pattern */}
      <T>
        Normal text <div>and some nesting</div> with trailing space  
      </T>

      <T>
        <Plural n={1} singular={<> </>} plural={<></>} />
      </T>

      <T>
        <Plural 
          n={1}
          zero={0}
          one={1}
          two={-1}
          few={3.14159}
          many={1e6}
          other={0xFF}
        />
      </T>

      <T>
        <Branch
          branch="test"
          empty=""
          whitespace="   padded   "
          fragment={<>fragment content</>}
          element={<span>element content</span>}
          number={42}
          boolean={true}
          null_value={null}
        />
      </T>

      {/* Complex whitespace preservation scenario */}
      <T>
        <span>word1</span> <span>word2</span> <span>word3</span>
      </T>

      <T>
        <>Fragment start</> middle text <>Fragment end</>
      </T>

      {/* Variable key consistency across parallel branches */}
      <T>
        <Branch
          branch="consistency"
          path_a={
            <div>
              <Var name="shared1">var1</Var>
              <Num name="shared2">42</Num>
              <Currency currency="USD" name="shared3">9.99</Currency>
            </div>
          }
          path_b={
            <>
              <Var name="shared1">var1</Var>
              <Num name="shared2">42</Num> 
              <Currency currency="USD" name="shared3">9.99</Currency>
            </>
          }
        />
      </T>

    </>
  );
}

/*
ADDITIONAL EXTREME EDGE CASES COVERED:

1. **Whitespace Extremes:**
   - Only whitespace fragments with different whitespace types
   - Whitespace sandwiching elements
   - Mixed whitespace preservation scenarios
   - Fragment whitespace boundaries

2. **Fragment Nesting:**
   - 4+ levels of fragment nesting
   - Fragments with mixed content types (text, elements, literals)
   - Fragment boundaries with elements

3. **Numeric Extremes:**
   - Extreme positive/negative values
   - Special float cases (tiny, huge, scientific notation)
   - All hexadecimal formats
   - Edge cases like -0, 0.0

4. **String Escaping Stress:**
   - All escape sequences in different quote contexts
   - Raw strings with JSON, regex, file paths
   - URLs, emails, CSS in attributes
   - Complex template literal escaping

5. **Boolean/Null Combinations:**
   - All boolean/null variations in different contexts
   - String representations of booleans
   - Mixed truthy/falsy values

6. **Template Literal Stress:**
   - Complex escaping scenarios
   - Multiline templates
   - Templates with code, markdown, XML

7. **Attribute Extremes:**
   - All plural forms filled
   - Branch components with 10+ options
   - Mixed attribute types in single component

8. **Variable Component Stress:**
   - Edge case variable names (numeric, special chars, different cases)
   - All numeric formats in Num components
   - Different currency formats
   - DateTime with various inputs

9. **Maximum Nesting:**
   - 7-level component nesting
   - Mixed component types at every level
   - Complex wrapper structures

10. **Boundary Violations:**
    - Completely empty components
    - Missing required attributes
    - Only invalid attributes

11. **Unicode Extremes:**
    - Every major unicode category
    - Mixed text directions (LTR/RTL)
    - Mathematical symbols, emojis

12. **Stress Testing:**
    - 50+ variables in single component (counter testing)
    - Array-generated repetitive structures

13. **Regression Prevention:**
    - Every known problematic pattern from previous fixes
    - Counter consistency scenarios
    - Whitespace preservation edge cases

This test file should expose any remaining edge cases and ensure your plugin handles every possible valid JSX pattern correctly!
*/