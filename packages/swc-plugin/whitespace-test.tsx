import { T, Plural, Branch, Var, Num, Currency, DateTime } from "gt-next";

export default function WhitespaceTestCases() {
  return (
    <>
      {/* Case 1: Trailing space issue - the main problem */}
      <T>
        Normal text <div>and some nesting</div>
      </T>

      {/* Case 2: Leading space preservation */}
      <T>
        <div>content before</div> trailing text
      </T>

      {/* Case 3: Multiple internal spaces should be normalized */}
      <T>
        Text    with     multiple   spaces
      </T>

      {/* Case 4: Mixed whitespace with newlines and indentation */}
      <T>
        Hello
        
        World    with   spaces
      </T>

      {/* Case 5: Empty string attributes - should be preserved */}
      <T>
        <Plural n={1} singular="" plural="Files" />
      </T>

      {/* Case 6: Padded string attributes - should preserve exact whitespace */}
      <T>
        <Plural n={1} singular="   File   " plural={"   Files   "} />
      </T>

      {/* Case 7: Branch with empty and padded attributes */}
      <T>
        <Branch 
          option1="" 
          option2="   Padded   " 
          option3={<span>JSX content</span>}
        />
      </T>

      {/* Case 8: Complex whitespace between elements */}
      <T>
        Start  
        <strong>Bold</strong>  
        <em>Italic</em>  
        End
      </T>

      {/* Case 9: Whitespace only text nodes */}
      <T>
        <div>Before</div>
        
        <div>After</div>
      </T>

      {/* Case 10: Variable components with whitespace */}
      <T>
        User:  
        <Var>userName</Var>  
        has  
        <Num>count</Num>  
        items
      </T>

      {/* Case 11: Nested elements with preserved spacing */}
      <T>
        Click <a href="#">here</a> to continue.
      </T>

      {/* Case 12: Tab and newline combinations */}
      <T>
        Line 1
		    Line 2 with tabs
            Line 3 with spaces
      </T>

      {/* Case 13: Plural with complex whitespace in branches */}
      <T>
        You have <Plural 
          n={5} 
          singular="  1 item  " 
          plural={`  ${5} items  `}
        />
      </T>

      {/* Case 14: Expression containers with whitespace */}
      <T>
        Total: <Currency currency="USD">{amount}</Currency> available
      </T>

      {/* Case 15: Boolean and null literals with whitespace context */}
      <T>
        Status: <Plural n={1} singular={true} plural={false} /> - <Plural n={0} singular={null} plural="Active" />
      </T>

      {/* Case 16: Edge case - only whitespace text */}
      <T>
        <div>Content</div>   <div>More content</div>
      </T>

      {/* Case 17: Whitespace at boundaries */}
      <T>  
        Boundary whitespace test  
      </T>

      {/* Case 18: Mixed JSX and text with careful spacing */}
      <T>
        Hello <Var>name</Var>, you have <Num>5</Num> new messages.
      </T>

      {/* Case 19: Template literals in attributes */}
      <T>
        <Plural 
          n={count} 
          singular="1 file" 
          plural={`${count} files`}
        />
      </T>

      {/* Case 20: Complex nesting with whitespace preservation */}
      <T>
        <div>
          Welcome <strong>user</strong>, 
          <br />
          You have <span>messages</span> waiting.
        </div>
      </T>
    </>
  );
}

/*
Expected Runtime vs Build-time behaviors:

1. "Normal text " (with space) should be preserved
2. " trailing text" (with leading space) should be preserved  
3. "Text with multiple spaces" (internal normalization OK)
4. Empty string attributes: singular="" should appear in JSON as "singular":""
5. Padded attributes: "   File   " should stay exactly as-is
6. Whitespace between inline elements should be preserved for layout
7. Pure whitespace nodes may be collapsed but significant spacing kept
8. Variable components should not be wrapped with {"c": ...}
9. Boolean/null literals should serialize as raw JSON types
10. Template literals in expressions should be handled appropriately

The key test is Case 1 - this is the main failing case from the logs.
*/