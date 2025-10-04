import { T, Plural, Branch, Var, Num, Currency, DateTime } from "gt-next";

export default function ExtremeEdgeCases() {
  const count = 42;
  const price = 9.99;
  const timestamp = new Date();

  return (
    <T>
      {/* ========== EXTREME WHITESPACE SCENARIOS ========== */}

      {/* Only whitespace variations */}
      
        <Plural n={1} singular={<> </>} plural={<> </>} />
      

      
        <Plural n={1} singular={<>\t</>} plural={<>\n</>} />
      

      {/* Mixed whitespace preservation */}
      
        <span>start</span> <span>middle</span> <span>end</span>
      

      {/* Whitespace sandwich scenarios */}
      
        <div>surrounded by spaces</div>
      

      {/* Fragment whitespace edge cases */}
      
        <> leading spaces</>
        <>trailing spaces </>
        <> both sides </>
      

      {/* ========== FRAGMENT NESTING EXTREMES ========== */}

      {/* Deeply nested fragments */}
      
        <Plural
          n={1}
          singular={
            <>
              <>
                <>
                  <>deep fragment nesting</>
                </>
              </>
            </>
          }
          plural="files"
        />
      

      {/* Fragment with mixed content types */}
      
        <Branch
          branch="mixed"
          option1={
            <>
              text
              <span>element</span>
              {42}
              {true}
              {null}
              more text
            </>
          }
          option2="simple"
        />
      

      {/* Fragment boundaries with elements */}
      
        <>start</>
        <div>middle</div>
        <>end</>
      

      {/* ========== NUMERIC EDGE CASES ========== */}

      {/* Extreme number values */}
      
        <Plural
          n={1}
          zero={0.0}
          one={-0}
          two={999999999999}
          few={-999999999999}
          many={0.000000001}
          other={-0.000000001}
        />
      

      {/* Special float values */}
      
        <Branch
          branch="floats"
          tiny={0.1}
          precise={3.141592653589793}
          scientific={1.23e-10}
          big_scientific={1.23e10}
        />
      

      {/* Hexadecimal variations */}
      
        <Branch
          branch="hex"
          small={0x1}
          medium={0xabc}
          large={0xdeadbeef}
          mixed={0x123abc}
        />
      

      
        <Branch
          branch="mixed"
          option1={
            <>
              text
              <span>element</span>
              {42}
              {-1}
              {3.14159}
              {1e6}
              {0xff}
              {0xabc}
              {0xdeadbeef}
              {0xff}
              {0xabc}
              {NaN}
              {true}
              {}
              {false}
              {undefined}
              {Infinity}
              {null}
              {<></>}
              {<> </>}
              {+5}
              more text
            </>
          }
          option2="simple"
          option3={
            <>
              Hello <span>world</span>!
            </>
          }
        />
      

      {/* ========== STRING ESCAPING EXTREMES ========== */}

      {/* All escape sequences */}
      
        <Plural
          n={1}
          singular="Quotes: &quot; and '"
          plural="Backslashes: \\ and \\n and \\t"
          other={`Unicode: \\u0041 and \\x41`}
        />
      

      {/* Raw strings with problematic characters */}
      
        <Branch
          branch="raw"
          json={`{"key": "value", "array": [1,2,3]}`}
          regex={`/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/`}
          path={`C:\\Program Files\\App\\file.exe`}
        />
      

      {/* URLs and complex strings */}
      
        <Branch
          branch="complex"
          url="https://example.com:8080/path?param=value&other=123#section"
          email="user.name+tag@subdomain.example-site.co.uk"
          css="body { margin: 0; padding: 10px; font-family: Arial, sans-serif; }"
        />
      

      {/* ========== BOOLEAN AND NULL COMBINATIONS ========== */}

      {/* All boolean/null variations */}
      
        <Plural
          n={1}
          zero={false}
          one={true}
          two={null}
          few=""
          many={0}
          other="false"
        />
      

      {/* Mixed boolean contexts */}
      
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
      

      {/* ========== TEMPLATE LITERAL STRESS TESTS ========== */}

      {/* Complex template escaping */}
      
        <Plural
          n={1}
          singular={`Template with \${escaped} and \`backticks\``}
          plural={`Multi
            line
            template
            literal`}
          other={`Mixed "quotes" and 'apostrophes' in template`}
        />
      

      {/* Template with special characters */}
      
        <Branch
          branch="templates"
          code="function test() { return `Hello ${name}`; }"
          markdown={`# Title\n\n**Bold** and *italic* text.\n\n\`\`\`js\nconst x = 42;\n\`\`\``}
          xml={`<root><child attr="value">content</child></root>`}
        />
      

      {/* ========== COMPONENT ATTRIBUTE EXTREMES ========== */}

      {/* Attributes with every valid plural form */}
      
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
      

      {/* Branch with many options */}
      
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
      

      {/* ========== VARIABLE COMPONENT STRESS TESTS ========== */}

      {/* Variables with edge case names */}
      
        <Var name="_underscore">content</Var>
        <Var name="camelCase">content</Var>
        <Var name="kebab-case">content</Var>
        <Var name="snake_case">content</Var>
        <Var name="PascalCase">content</Var>
        <Var name="123numeric">content</Var>
        <Var name="special!@#$%">content</Var>
      

      {/* Variable content variations */}
      
        <Num name="n1">42</Num>
        <Num name="n2">{-42}</Num>
        <Num name="n3">3.14159</Num>
        <Num name="n4">{0}</Num>
        <Num name="n5">{0xff}</Num>
      

      {/* Currency with different formats */}
      
        <Currency currency="USD" name="usd1">
          {price}
        </Currency>
        <Currency currency="EUR" name="eur1">
          1234.56
        </Currency>
        <Currency currency="JPY" name="jpy1">
          1000
        </Currency>
        <Currency currency="BTC" name="btc1">
          0.00123456
        </Currency>
      

      {/* DateTime with different values */}
      
        <DateTime name="dt1">{timestamp}</DateTime>
        <DateTime name="dt2">{new Date(0)}</DateTime>
        <DateTime name="dt3">{new Date(0)}</DateTime>
        <DateTime name="dt4">{new Date(0)}</DateTime>
      

      {/* ========== MAXIMAL NESTING SCENARIOS ========== */}

      {/* 7-level component nesting */}
      
        <Branch
          branch="l1"
          option1={
            <Plural
              n={1}
              singular={
                <Branch
                  branch="l2"
                  option1={
                    <Plural
                      n={1}
                      singular={
                        <Branch
                          branch="l3"
                          option1={
                            <Plural
                              n={1}
                              singular={
                                <Branch
                                  branch="l4"
                                  option1={
                                    <Plural
                                      n={1}
                                      singular={
                                        <Branch
                                          branch="l5"
                                          option1={
                                            <Plural
                                              n={1}
                                              singular={
                                                <Branch
                                                  branch="l6"
                                                  option1={
                                                    <Var name="deep7">
                                                      maximum depth
                                                    </Var>
                                                  }
                                                  option2="l6 end"
                                                />
                                              }
                                              plural="l5 plural"
                                            />
                                          }
                                          option2="l5 end"
                                        />
                                      }
                                      plural="l4 plural"
                                    />
                                  }
                                  option2="l4 end"
                                />
                              }
                              plural="l3 plural"
                            />
                          }
                          option2="l3 end"
                        />
                      }
                      plural="l2 plural"
                    />
                  }
                  option2="l2 end"
                />
              }
              plural="l1 plural"
            />
          }
          option2="l1 end"
        />
      

      {/* Mixed nesting with all component types */}
      
        <div className="wrapper">
          <Branch
            branch="outer"
            option1={
              <>
                <span>Before plural</span>
                <Plural
                  n={count}
                  singular={
                    <div>
                      Single item: <Num name="single_count">{count}</Num>
                      costing{" "}
                      <Currency currency="USD" name="single_price">
                        {price}
                      </Currency>
                      at <DateTime name="single_time">{timestamp}</DateTime>
                      in{" "}
                      <Branch
                        branch="location"
                        home={
                          <>
                            home folder with <Var name="home_var">variable</Var>
                          </>
                        }
                        work="office"
                      />
                    </div>
                  }
                  plural={
                    <div>
                      Multiple items: <Num name="multi_count">{count}</Num>
                      costing{" "}
                      <Currency currency="USD" name="multi_price">
                        {price * count}
                      </Currency>
                      <>with fragments</> and <span>elements</span>
                    </div>
                  }
                />
                <span>After plural</span>
              </>
            }
            option2="simple option"
          />
        </div>
      

      {/* ========== BOUNDARY VIOLATION TESTS ========== */}

      {/* Empty everything */}
       

      {""}

       

      {/* 
        <Plural n={1} />
       */}
      {/* 
      
        <Branch branch="test" />
       */}

      
        <Var />
      

      {/* Only invalid attributes */}
      {/* 
        <Plural n={1} invalid="ignored" also_invalid="also ignored" />
       */}

      
        <Branch branch="test" invalid="ignored" also_invalid="also ignored" />
      

      {/* Missing required attributes DISREGARD, INVALID */}
      {/* 
        <Plural singular="file" plural="files" />
      

      
        <Branch option1="test" option2="test2" />
       */}

      {/* ========== UNICODE EXTREMES ========== */}

      {/* Every major unicode category */}
      
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
      

      {/* Mixed text directions */}
      
        <Plural
          n={1}
          singular="English left-to-right"
          plural="العربية من اليمين إلى اليسار"
          other="עברית מימין לשמאל"
        />
      

      {/* ========== REGRESSION PREVENTION TESTS ========== */}

      {/* Every known problematic pattern */}
      
        Normal text <div>and some nesting</div> with trailing space
      

      
        <Plural n={1} singular={<> </>} plural={<></>} />
      

      
        <Plural
          n={1}
          zero={0}
          one={1}
          two={-1}
          few={3.14159}
          many={1e6}
          other={0xff}
        />
      

      
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
      

      {/* Complex whitespace preservation scenario */}
      
        <span>word1</span> <span>word2</span> <span>word3</span>
      

      
        <>Fragment start</> middle text <>Fragment end</>
      

      {/* Variable key consistency across parallel branches */}
      
        <Branch
          branch="consistency"
          path_a={
            <div>
              <Var name="shared1">var1</Var>
              <Num name="shared2">42</Num>
              <Currency currency="USD" name="shared3">
                9.99
              </Currency>
            </div>
          }
          path_b={
            <>
              <Var name="shared1">var1</Var>
              <Num name="shared2">42</Num>
              <Currency currency="USD" name="shared3">
                9.99
              </Currency>
            </>
          }
        />
      
    </T>
  );
}
