import { T, Branch, Plural, Var, Num, Currency, DateTime } from "gt-next";

// Extreme edge cases designed to break the SWC plugin hash calculation
export default function ExtremeEdgeCases() {
  const count = 7;
  const amount = 123.45;
  const date = new Date();

  return (
    <T>
      {/* ========== EXPRESSION CONTAINER EDGE CASES ========== */}

      {/* Empty JSX expressions {} mixed with content */}
      
        <Branch
          branch="test"
          option1={
            <>
              Start {} middle {} end
            </>
          }
          option2={
            <>
              Before{}
              {}
              <></>After
            </>
          }
          option3={
            <>
              {}
              <span>element</span>
              {}
            </>
          }
          option4="normal"
        />
      

      {/* Mixed empty expressions and fragments */}
      
        <Plural
          n={count}
          singular={
            <>
              Text{}
              <></>More text
            </>
          }
          plural={
            <>
              <>
                {}Fragment{}
              </>
              content{}
            </>
          }
          other={
            <>
              <>
                {}
                {}
              </>
            </>
          }
        />
      

      {/* ========== BOOLEAN CONTEXT EDGE CASES ========== */}

      {/* All boolean permutations in expressions */}
      
        <Branch
          branch="bool"
          true_val={<>{true}</>}
          false_val={<>{false}</>}
          mixed_true={<>Before {true} after</>}
          mixed_false={<>Before {false} after</>}
          multiple={
            <>
              {true}
              {false}
              {true}
            </>
          }
        />
      

      {/* Boolean vs null vs undefined combinations */}
      
        <Plural
          n={1}
          zero={<>{null}</>}
          one={<>{undefined}</>}
          two={<>{false}</>}
          few={
            <>
              {true}
              {null}
              {undefined}
            </>
          }
          many={
            <>
              Mixed {false} and {null}
            </>
          }
          other="normal"
        />
      

      {/* ========== NUMERIC PRECISION EDGE CASES ========== */}

      {/* Floating point precision boundaries */}
      
        <Branch
          branch="precision"
          tiny={1e-324} // Smallest possible positive number
          almost_zero={4.9e-324} // Just above smallest subnormal
          epsilon={2.220446049250313e-16} // Machine epsilon
          almost_one={0.9999999999999999}
          not_quite_two={1.9999999999999998}
          close_to_pi={3.141592653589793}
        />
      

      {/* Scientific notation variations */}
      
        <Plural
          n={count}
          zero={1.0}
          one={1.0}
          two={1.0}
          few={5.0e10}
          many={5.0e10}
          other={5.0e-10}
        />
      

      {/* ========== WHITESPACE PATHOLOGICAL CASES ========== */}

      {/* Zero-width characters and unusual spaces */}
      
        <Branch
          branch="space"
          zero_width={<>word1​word2</> /* Zero-width space */}
          thin_space={<>word1 word2</> /* Thin space */}
          hair_space={<>word1 word2</> /* Hair space */}
          figure_space={<>word1 word2</> /* Figure space */}
          punctuation_space={<>word1 word2</> /* Punctuation space */}
          normal={<>word1 word2</>}
        />
      

      {/* Mixed line endings and tabs */}
      
        <Plural
          n={1}
          singular={<>Line1\nLine2</>} /* Unix LF */
          plural={<>Line1\r\nLine2</>} /* Windows CRLF */
          other={<>Line1\rLine2</>} /* Old Mac CR */
        />
      

      {/* ========== FRAGMENT PATHOLOGICAL NESTING ========== */}

      {/* Maximum fragment nesting with mixed empty/content */}
      
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
              <>Final</>
            </>
          }
          option2={
            <>
              <>
                <>
                  <>
                    <>Flat</>
                  </>
                  &nbsp;
                </>
              </>
            </>
          }
        />
      

      {/* Fragments with alternating empty/content patterns */}
      
        <Plural
          n={count}
          singular={
            <>
              <></>Content<></>More<></>End
            </>
          }
          plural={
            <>
              Start<></>Middle<></>End
            </>
          }
          other={
            <>
              <></>Text
              <>
                <></>
              </>
            </>
          }
        />
      

      {/* ========== VARIABLE COMPONENT STRESS TESTS ========== */}

      {/* Variables with extreme naming edge cases */}
      
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
      

      {/* Maximum variable density */}
      
        <Plural
          n={1}
          singular={
            <>
              <Var>v1</Var>
              <Num>1</Num>
              <Currency currency="USD">1</Currency>
              <DateTime>{new Date(2023)}</DateTime>
              <Var>v2</Var>
              <Num>2</Num>
              <Currency currency="EUR">2</Currency>
              <DateTime>{new Date(2023)}</DateTime>
              <Var>v3</Var>
              <Num>3</Num>
              <Currency currency="JPY">3</Currency>
              <DateTime>{new Date(2023)}</DateTime>
            </>
          }
          plural={
            <>
              <DateTime>{new Date(2023)}</DateTime>
              <Currency currency="JPY">3</Currency>
              <Num>3</Num>
              <Var>v3</Var>
              <DateTime>{new Date(2023)}</DateTime>
              <Currency currency="EUR">2</Currency>
              <Num>2</Num>
              <Var>v2</Var>
              <DateTime>{new Date(2023)}</DateTime>
              <Currency currency="USD">1</Currency>
              <Num>1</Num>
              <Var>v1</Var>
            </>
          }
        />
      

      {/* ========== SPECIAL IDENTIFIER EDGE CASES ========== */}

      {/* ========== UNICODE PATHOLOGICAL CASES ========== */}

      {/* Combining characters and normalization edge cases */}
      
        <Plural
          n={1}
          singular="é" /* Pre-composed */
          plural="é" /* Decomposed (e + combining acute) */
          other="ñ vs ñ" /* Different normalizations */
        />
      

      {/* Surrogate pairs and emoji variations */}
      
        <Branch
          branch="emoji"
          basic="👍"
          skin_tone="👍🏽"
          zwj_sequence="👨‍👩‍👧‍👦"
          flag="🇺🇸"
          text_vs_emoji="©️ vs ©"
        />
      

      {/* ========== MATHEMATICAL EXPRESSIONS IN NUMBERS ========== */}

      {/* ========== TEMPLATE LITERAL EDGE CASES ========== */}

      {/* Template literals with unusual escape sequences */}
      
        <Plural
          n={1}
          singular={`\\x41`} /* Hex escape */
          plural={`\\u0041`} /* Unicode escape */
          other={`\\101`} /* Octal escape */
        />
      

      {/* ========== BOUNDARY OVERFLOW CONDITIONS ========== */}

      {/* Maximum attribute count */}
      
        <Branch
          branch="many"
          a1="1"
          a2="2"
          a3="3"
          a4="4"
          a5="5"
          a6="6"
          a7="7"
          a8="8"
          a9="9"
          a10="10"
          b1="1"
          b2="2"
          b3="3"
          b4="4"
          b5="5"
          b6="6"
          b7="7"
          b8="8"
          b9="9"
          b10="10"
          c1="1"
          c2="2"
          c3="3"
          c4="4"
          c5="5"
          c6="6"
          c7="7"
          c8="8"
          c9="9"
          c10="10"
          d1="1"
          d2="2"
          d3="3"
          d4="4"
          d5="5"
          d6="6"
          d7="7"
          d8="8"
          d9="9"
          d10="10"
          e1="1"
          e2="2"
          e3="3"
          e4="4"
          e5="5"
          e6="6"
          e7="7"
          e8="8"
          e9="9"
          e10="10"
        />
      

      {/* ========== COUNTER SYNCHRONIZATION EDGE CASES ========== */}

      {/* Nested branches with identical variable patterns */}
      
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
      

      {/* ========== SERIALIZATION EDGE CASES ========== */}

      {/* Objects that might cause JSON serialization issues */}
      
        <Plural
          n={count}
          zero={0}
          one={1}
          two={-1}
          few={Infinity}
          other={NaN}
        />
      

      {/* String values that look like JSON */}
      
        <Branch
          branch="json"
          object='{"key": "value"}'
          array="[1, 2, 3]"
          nested='{"a": {"b": [1, {"c": true}]}}'
          escaped='{"quote": "He said \\"hello\\""}'
        />
      

      {/* ========== REGRESSION STRESS TESTS ========== */}

      {/* Pattern that previously caused issues */}
      
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
                <>
                  Deep fragment with{" "}
                  <Currency currency="USD">{amount}</Currency>
                </>
                {null}
                {undefined}
                {false}
                {}
              </span>
            </div>
          }
        />
      

      {/* Maximum complexity single component */}
      
        <Branch
          branch="complex"
          option1={
            <>
              Start {true} {false} {null} {undefined} {} <></>
              <Plural
                n={count}
                zero={
                  <>
                    Zero with <Var name="v1">var1</Var>
                  </>
                }
                one={
                  <>
                    One with <Num name="n1">{count}</Num> {NaN}
                  </>
                }
                two={
                  <>
                    Two with{" "}
                    <Currency currency="USD" name="c1">
                      {amount}
                    </Currency>{" "}
                    {Infinity}
                  </>
                }
                few={
                  <>
                    Few with <DateTime name="d1">{date}</DateTime>
                  </>
                }
                many={
                  <Branch
                    branch="nested"
                    c={
                      <>
                        {0xff} and {0o755} and {0b1111}
                      </>
                    }
                  />
                }
                other={
                  <>
                    Other {+0} vs {-0}
                    {+1} vs {-1}
                  </>
                }
              />
              End {} <></>
            </>
          }
          option2="Simple option for comparison"
        />
      
    </T>
  );
}
