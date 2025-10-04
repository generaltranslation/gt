import { T, Plural, Branch, Var, Num, Currency } from "gt-next";

export default function WhitespaceTestCases() {

  const count = 1;
  const amount = 100;
  return (
    <T>
      {/* Case 1: Trailing space issue - the main problem */}
        Normal text <div>and some nesting</div>

      {/* Case 2: Leading space preservation */}
        <div>content before</div> trailing text

      {/* Case 3: Multiple internal spaces should be normalized */}
        Text    with     multiple   spaces
        <>        Text   <div>yo    yo</div>   with  <span/>   multiple   spaces</>

      {/* Case 4: Mixed whitespace with newlines and indentation */}
        Hello
        
        World    with   spaces

      {/* Case 5: Empty string attributes - should be preserved */}
        <Plural n={1} singular="" plural="Files" />

      {/* Case 6: Padded string attributes - should preserve exact whitespace */}
        <Plural n={1} singular="   File   " plural={"   Files   "} />

      {/* Case 7: Branch with empty and padded attributes */}
        <Branch 
          branch={1}
          option1="" 
          option2="   Padded   " 
          option3={<span>JSX content</span>}
        />

      {/* Case 8: Complex whitespace between elements */}
        Start  
        <strong>Bold</strong>  
        <em>Italic</em>  
        End

      {/* Case 9: Whitespace only text nodes */}
        <div>Before</div>
        
        <div>After</div>

      {/* Case 10: Variable components with whitespace */}
        User:  
        <Var>userName</Var>  
        has  
        <Num>count</Num>  
        items

      {/* Case 11: Nested elements with preserved spacing */}
        Click <a href="#">here</a> to continue.

      {/* Case 12: Tab and newline combinations */}
        Line 1
		    Line 2 with tabs
            Line 3 with spaces

      {/* Case 13: Plural with complex whitespace in branches */}
        You have <Plural 
          n={5} 
          singular="  1 item  " 
          plural={`  2 items  `}
        />

      {/* Case 14: Expression containers with whitespace */}
        Total: <Currency currency="USD">{amount}</Currency> available

      {/* Case 15: Boolean and null literals with whitespace context */}
        Status: <Plural n={1} singular={true} plural={false} /> - <Plural n={0} singular={null} plural="Active" />

      {/* Case 16: Edge case - only whitespace text */}
        <div>Content</div>   <div>More content</div>

      {/* Case 17: Whitespace at boundaries */}
        Boundary whitespace test  

      {/* Case 18: Mixed JSX and text with careful spacing */}
        Hello <Var>name</Var>, you have <Num>5</Num> new messages.

      {/* Case 19: Template literals in attributes */}
        <Plural 
          n={count} 
          singular="1 file" 
          plural={`2 files`}
        />

      {/* Case 20: Complex nesting with whitespace preservation */}
        <div>
          Welcome <strong>user</strong>, 
          <br />
          You have <span>messages</span> waiting.
        </div>


         Text    with     multiple   spaces  
         Text    with     multiple   spaces   

      
        <Branch
          branch="mixed"
          short="Brief"
          long={`Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`}
          mixed={
            <>
              Very long text with <Var>embedded variables</Var> that continues
              for a very long time and includes multiple <Num>{9999999}</Num>{" "}
              numeric values and{" "}
              <Currency currency="USD">{1234567.89}</Currency> monetary amounts
              spread throughout the content to test how the algorithm handles
              very large content blocks with mixed variable types.
            </>
            // <>
            //   <div>hello there</div>
            //   test
            //   <div>hello there</div>
            //   something again
            //   something else 
            // </>
          }
        />

        Hello
        
        World    with   spaces

        {true}
        {true}


        <div/>
        <div/>

       {true}
      

         {true}
      
        <Plural n={1} singular={true} dual={<>{false}{true}</>} />
      

        <Plural n={1} singular={true} dual={<>{true}</>} />
      
      
        &nbsp;yo&nbsp; 
        &nbsp;yo&nbsp;
       

yo 
yo
      

        <div>
        {true}
        </div>
      

        <div>
        {}
        <div/>
        {}
        <div/>
        {}
        </div>

        Hello <div>
          there
        </div>
        <div>
          there
        </div>



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


      <>{true}</>


      <>{false}</>


      <>{true}{true}</>

      <span>{true}</span>


      <span>{false}</span>


      <span>{true}{true}</span>
     

      


      
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
              <div />
            </>
          }
        />


      &nbsp;yo&nbsp; &nbsp;yo&nbsp;

      
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
    </T>
  );
}