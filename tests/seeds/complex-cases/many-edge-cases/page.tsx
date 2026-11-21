import { T, Plural, Select, Var, Num, Currency, DateTime } from "gt-next";

export default function ExtremeEdgeCases() {
  const count = 42;
  const price = 9.99;
  const timestamp = new Date();

  return (
    <T>
      {/* ========== EXTREME WHITESPACE SCENARIOS ========== */}

      {/* Only whitespace variations */}
      
        <Plural n={1} _1={<> </>} _2={<> </>} />
      

      
        <Plural n={1} _1={<>\t</>} _2={<>\n</>} />
      

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
          _1={
            <>
              <>
                <>
                  <>deep fragment nesting</>
                </>
              </>
            </>
          }
          _2="files"
        />
      

      {/* Fragment with mixed content types */}
      
        <Select
          value="mixed"
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
        >{-0.000000001}</Plural>
      

      {/* Special float values */}
      
        <Select
          value="floats"
          tiny={0.1}
          precise={3.141592653589793}
          scientific={1.23e-10}
          big_scientific={1.23e10}
        />
      

      {/* Hexadecimal variations */}
      
        <Select
          value="hex"
          small={0x1}
          medium={0xabc}
          large={0xdeadbeef}
          mixed={0x123abc}
        />
      

      
        <Select
          value="mixed"
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
          _1="Quotes: &quot; and '"
          _2="Backslashes: \\ and \\n and \\t"
        >{`Unicode: \\u0041 and \\x41`}</Plural>
      

      {/* Raw strings with problematic characters */}
      
        <Select
          value="raw"
          json={`{"key": "value", "array": [1,2,3]}`}
          regex={`/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/`}
          path={`C:\\Program Files\\App\\file.exe`}
        />
      

      {/* URLs and complex strings */}
      
        <Select
          value="complex"
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
        >false</Plural>
      

      {/* Mixed boolean contexts */}
      
        <Select
          value="booleans"
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
          _1={`Template with \${escaped} and \`backticks\``}
          _2={`Multi
            line
            template
            literal`}
        >{`Mixed "quotes" and 'apostrophes' in template`}</Plural>
      

      {/* Template with special characters */}
      
        <Select
          value="templates"
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
          _1="sing"
          _2="plur"
        >other</Plural>
      

      {/* Select with many options */}
      
        <Select
          value="many_options"
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
      
        <Select
          value="l1"
          option1={
            <Plural
              n={1}
              _1={
                <Select
                  value="l2"
                  option1={
                    <Plural
                      n={1}
                      _1={
                        <Select
                          value="l3"
                          option1={
                            <Plural
                              n={1}
                              _1={
                                <Select
                                  value="l4"
                                  option1={
                                    <Plural
                                      n={1}
                                      _1={
                                        <Select
                                          value="l5"
                                          option1={
                                            <Plural
                                              n={1}
                                              _1={
                                                <Select
                                                  value="l6"
                                                  option1={
                                                    <Var name="deep7">
                                                      maximum depth
                                                    </Var>
                                                  }
                                                  option2="l6 end"
                                                />
                                              }
                                              _2="l5 plural"
                                            />
                                          }
                                          option2="l5 end"
                                        />
                                      }
                                      _2="l4 plural"
                                    />
                                  }
                                  option2="l4 end"
                                />
                              }
                              _2="l3 plural"
                            />
                          }
                          option2="l3 end"
                        />
                      }
                      _2="l2 plural"
                    />
                  }
                  option2="l2 end"
                />
              }
              _2="l1 plural"
            />
          }
          option2="l1 end"
        />
      

      {/* Mixed nesting with all component types */}
      
        <div className="wrapper">
          <Select
            value="outer"
            option1={
              <>
                <span>Before plural</span>
                <Plural
                  n={count}
                  _1={
                    <div>
                      Single item: <Num name="single_count">{count}</Num>
                      costing{" "}
                      <Currency currency="USD" name="single_price">
                        {price}
                      </Currency>
                      at <DateTime name="single_time">{timestamp}</DateTime>
                      in{" "}
                      <Select
                        value="location"
                        home={
                          <>
                            home folder with <Var name="home_var">variable</Var>
                          </>
                        }
                        work="office"
                      />
                    </div>
                  }
                  _2={
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
      
        <Select value="test" />
       */}

      
        <Var />
      

      {/* Only invalid attributes */}
      {/* 
        <Plural n={1} invalid="ignored" also_invalid="also ignored" />
       */}

      
        <Select value="test" invalid="ignored" also_invalid="also ignored" />
      

      {/* Missing required attributes DISREGARD, INVALID */}
      {/* 
        <Plural _1="file" _2="files" />
      

      
        <Select option1="test" option2="test2" />
       */}

      {/* ========== UNICODE EXTREMES ========== */}

      {/* Every major unicode category */}
      
        <Select
          value="unicode"
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
          _1="English left-to-right"
          _2="العربية من اليمين إلى اليسار"
        >עברית מימין לשמאל</Plural>
      

      {/* ========== REGRESSION PREVENTION TESTS ========== */}

      {/* Every known problematic pattern */}
      
        Normal text <div>and some nesting</div> with trailing space
      

      
        <Plural n={1} _1={<> </>} _2={<></>} />
      

      
        <Plural
          n={1}
          zero={0}
          one={1}
          two={-1}
          few={3.14159}
          many={1e6}
        >{0xff}</Plural>
      

      
        <Select
          value="test"
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
      
        <Select
          value="consistency"
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
