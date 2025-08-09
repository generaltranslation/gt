import { T, Plural, Branch, Var, Num, Currency, DateTime } from "gt-next";

export default function ComprehensiveEdgeCases() {
  const variable = "test";
  const count = 5;
  const amount = 100.50;
  const date = new Date();

  return (
    <>
      {/* ========== BASIC WHITESPACE EDGE CASES ========== */}
      
      {/* Leading/trailing spaces with different sibling positions */}
      <T>
        <div>before</div> space after div
      </T>

      <T>
        space before div <div>after</div>
      </T>

      <T>
        <div>first</div> middle space <div>last</div>
      </T>

      {/* Multiple consecutive spaces */}
      <T>
        word1     word2        word3
      </T>

      {/* Tab and newline combinations */}
      <T>
        line1
        	tabbed line
        
        empty line above
      </T>

      {/* Zero-width and unusual whitespace */}
      <T>
        word1 word2 word3
      </T>

      {/* ========== FRAGMENT EDGE CASES ========== */}

      {/* Empty fragments */}
      <T>
        <Plural n={1} singular={<></>} plural="files" />
      </T>

      {/* Nested fragments */}
      <T>
        <Plural 
          n={1} 
          singular={
            <>
              <>nested</> fragment
            </>
          } 
          plural="files" 
        />
      </T>

      {/* Fragments with only whitespace */}
      <T>
        <Plural 
          n={1} 
          singular={<>   </>} 
          plural={<>
          
          </>} 
        />
      </T>

      {/* Fragments mixed with elements */}
      <T>
        <>text before</>
        <div>element</div>
        <>text after</>
      </T>

      {/* ========== ATTRIBUTE VALUE EDGE CASES ========== */}

      {/* All plural forms */}
      <T>
        <Plural 
          n={count}
          zero="zero items"
          one="one item" 
          two="two items"
          few="few items"
          many="many items"
          other="other items"
          singular="singular form"
          plural="plural form"
        />
      </T>

      {/* Mixed attribute types in same component */}
      <T>
        <Plural 
          n={1}
          zero=""
          one={null}
          two={42}
          few={true}
          many={false}
          other={`template`}
          singular={<>fragment</>}
          plural={<span>element</span>}
        />
      </T>

      {/* Extremely long attribute values */}
      <T>
        <Plural 
          n={1}
          singular="This is an extremely long string value that tests how the plugin handles very long attribute content that might span multiple lines and contain various characters including unicode ñáéíóú and emoji 📁📂🎉"
          plural={`This is an extremely long template literal that tests how the plugin handles very long template content with potential whitespace normalization issues and various characters`}
        />
      </T>

      {/* ========== BRANCH COMPONENT EDGE CASES ========== */}

      {/* All empty branch attributes */}
      <T>
        <Branch 
          branch="type"
          option1=""
          option2={null}
          option3={<></>}
          option4={false}
        />
      </T>

      {/* Dynamic branch names (should be static) */}
      <T>
        <Branch 
          branch="file"
          file="valid"
          directory="valid"
          unknown_option="should be included"
          another_option={<>fragment content</>}
        />
      </T>

      {/* ========== VARIABLE COMPONENT EDGE CASES ========== */}

      {/* All variable types with different content patterns */}
      <T>
        <Var name="custom_name">static content</Var>
        <Var>{variable}</Var>
        <Var>   padded content   </Var>
        <Var></Var>
      </T>

      <T>
        <Num name="count_1">{count}</Num>
        <Num>42</Num>
        <Num>3.14159</Num>
        <Num></Num>
      </T>

      <T>
        <Currency currency="USD" name="price_1">{amount}</Currency>
        <Currency currency="EUR">99.99</Currency>
        <Currency currency="JPY">1000</Currency>
      </T>

      <T>
        <DateTime name="timestamp_1">{date}</DateTime>
        <DateTime format="short">2024-01-01</DateTime>
        <DateTime></DateTime>
      </T>

      {/* ========== EXTREME NESTING SCENARIOS ========== */}

      {/* 5-level deep nesting */}
      <T>
        <Branch branch="level1" option1={
          <Plural n={1} singular={
            <Branch branch="level2" option1={
              <Plural n={1} singular={
                <Branch branch="level3" option1={
                  <Plural n={1} singular={
                    <Var name="deep_var">deeply nested variable</Var>
                  } plural="deep files" />
                } option2="level3 option2" />
              } plural="level2 plurals" />
            } option2="level2 option2" />
          } plural="level1 plurals" />
        } option2="level1 option2" />
      </T>

      {/* Mixed component types in complex structure */}
      <T>
        <div className="container">
          <Plural n={count} singular={
            <div>
              You have <Num>{count}</Num> item costing <Currency currency="USD">{amount}</Currency> 
              on <DateTime>{date}</DateTime> in the 
              <Branch branch="location" home="home folder" work={<>work directory</>} />
            </div>
          } plural={
            <div>
              You have <Num>{count}</Num> items costing <Currency currency="USD">{amount * count}</Currency>
              <>fragments mixed</> with elements
            </div>
          } />
        </div>
      </T>

      {/* ========== COUNTER CONSISTENCY TESTS ========== */}

      {/* Multiple variables that should have same keys across branches */}
      <T>
        <Branch 
          branch="type"
          option1={
            <div>
              First: <Var>{variable}</Var>
              Second: <Num>{count}</Num>
              Third: <Currency currency="USD">{amount}</Currency>
            </div>
          }
          option2={
            <div>
              First: <Var>{variable}</Var>
              Second: <Num>{count}</Num> 
              Third: <Currency currency="USD">{amount}</Currency>
            </div>
          }
        />
      </T>

      {/* Parallel branches with fragments vs elements */}
      <T>
        <Plural 
          n={1}
          singular={
            <>
              <Var>var1</Var> and <Num>num1</Num>
            </>
          }
          plural={
            <div>
              <Var>var1</Var> and <Num>num1</Num>
            </div>
          }
        />
      </T>

      {/* ========== LITERAL VALUE EDGE CASES ========== */}

      {/* Different number formats */}
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

      {/* Boolean combinations */}
      <T>
        <Branch
          branch="status"
          active={true}
          inactive={false}
          unknown={null}
          pending=""
        />
      </T>

      {/* Mixed quotes and escaping */}
      <T>
        <Plural 
          n={1}
          singular="Single 'quotes' inside"
          plural={'Double "quotes" inside'}
          other={`Template with 'both' "types"`}
        />
      </T>

      {/* ========== UNICODE AND SPECIAL CHARACTERS ========== */}

      {/* Various unicode categories */}
      <T>
        <Branch
          branch="language"
          english="Hello World"
          spanish="Hola Mundo ñáéíóú"
          chinese="你好世界"
          emoji="🌍🌎🌏 Hello 👋"
          arabic="مرحبا بالعالم"
          russian="Привет мир"
        />
      </T>

      {/* Special/control characters */}
      <T>
        <Plural
          n={1}
          singular="Line1\nLine2\tTabbed"
          plural="Special: !@#$%^&*()_+-=[]{}|;:,.<>?"
          other={`Template with \${variable} and \`backticks\``}
        />
      </T>

      {/* ========== TEMPLATE LITERAL EDGE CASES ========== */}

      {/* Simple templates (should work) */}
      <T>
        <Plural 
          n={1}
          singular={`simple template`}
          plural={`another simple template`}
        />
      </T>

      {/* Multiline templates */}
      <T>
        <Branch
          branch="format"
          single={`single line`}
          multi={`
            line 1
            line 2
            line 3
          `}
        />
      </T>

      {/* ========== BOUNDARY CONDITIONS ========== */}

      {/* Component with no attributes */}
      <T>
        <Plural n={1} />
      </T>

      {/* Component with only invalid attributes */}
      <T>
        <Plural n={1} invalid_attr="should be ignored" />
      </T>

      {/* Empty component */}
      <T>
        <Var></Var>
      </T>

      {/* Component with only whitespace children */}
      <T>
        <Var>   
        
        </Var>
      </T>

      {/* ========== STRESS TEST: MANY COMPONENTS ========== */}
      
      <T>
        {Array.from({length: 10}, (_, i) => (
          <div key={i}>
            Item {i}: <Var name={`var_${i}`}>value_{i}</Var> - 
            <Num name={`num_${i}`}>{i}</Num> - 
            <Currency currency="USD" name={`price_${i}`}>{i * 10}</Currency>
          </div>
        ))}
      </T>

      {/* ========== REGRESSION TEST CASES ========== */}

      {/* Known problematic patterns from previous issues */}
      <T>
        Normal text <div>nested content</div> more text
      </T>

      <T>
        <Plural
          n={count}
          zero="No files"
          one="One file" 
          two="Two files"
          few="Few files"
          many="Many files"
          other="Other files"
          singular={<>Single file</>}
        />
      </T>

      <T>
        <Branch
          branch="context"
          option1=""
          option2="   padded   "
          option3={<Var>{variable}</Var>}
          option4={<>fragment content</>}
          option5={<div>element content</div>}
        />
      </T>

    </>
  );
}

/*
EDGE CASES COVERED:

1. **Whitespace Normalization:**
   - Leading/trailing spaces in different sibling contexts
   - Multiple consecutive spaces
   - Mixed whitespace types (spaces, tabs, newlines)
   - Zero-width and unusual whitespace characters

2. **Fragment Handling:**
   - Empty fragments
   - Nested fragments
   - Fragments with only whitespace
   - Fragments mixed with regular elements

3. **Attribute Values:**
   - All CLDR plural forms (zero, one, two, few, many, other, singular, plural)
   - Mixed data types (strings, numbers, booleans, null, fragments, elements)
   - Extremely long strings
   - Unicode and special characters

4. **Variable Components:**
   - All variable types (Var, Num, Currency, DateTime)
   - Custom name attributes
   - Empty components
   - Padded content

5. **Counter Consistency:**
   - Parallel branches with same variable sequences
   - Fragment vs element containers with same content
   - Deep nesting scenarios

6. **Literal Values:**
   - Different number formats (integers, floats, scientific notation, hex)
   - Boolean combinations
   - Various string quote types

7. **Boundary Conditions:**
   - Empty components
   - Components with no valid attributes
   - Components with only whitespace

8. **Stress Testing:**
   - Deep nesting (5+ levels)
   - Many components in sequence
   - Complex mixed structures

9. **Regression Cases:**
   - Known problematic patterns from previous fixes
   - Hash mismatch scenarios
   - Counter increment edge cases

This should expose any remaining issues with:
- Whitespace preservation logic
- Fragment vs element handling consistency
- Counter increment/restore mechanisms
- Attribute value processing
- Unicode handling
- Template literal processing
- Hash generation consistency
*/