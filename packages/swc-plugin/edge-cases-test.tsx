import {
  Branch,
  Currency,
  DateTime,
  LocaleSelector,
  Num,
  Plural,
  T,
  Var,
} from "gt-next";

export default function EdgeCasesTest() {
  const variable = "variable content";
  const count = 5;
  const pluralText = "files";
  const messages = { files: "Files", file: "File" };

  return (
    <>
      <LocaleSelector />
      
      {/* ========== ORIGINAL WORKING CASES ========== */}
      <T>Normal text</T>
      <T>
        Normal text <div>and some nesting</div>
      </T>

      {/* ========== STRING LITERAL EXPRESSIONS (FIXED) ========== */}
      <T>
        <Plural n={1} singular="File" plural={"Files"} />
      </T>
      <T>
        <Branch branch="file" file={"file.svg"} directory={"public"} />
      </T>

      {/* ========== LITERAL TYPES IN EXPRESSIONS ========== */}
      <T>
        <Plural n={1} singular="File" plural={42} />
      </T>
      <T>
        <Plural n={1} singular={true} plural={false} />
      </T>
      <T>
        <Plural n={1} singular={null} plural="Files" />
      </T>

      {/* ========== TEMPLATE LITERALS ========== */}
      {/* Simple template literals (should work) */}
      <T>
        <Plural n={1} singular={`File`} plural={`Files`} />
      </T>
      
      {/* Complex template literals (build-time can't evaluate, should skip) */}
      <T>
        <Plural n={1} singular="File" plural={`${count} files`} />
      </T>
      <T>
        <Branch branch="file" file={`file-${count}.svg`} directory="public" />
      </T>

      {/* ========== CONDITIONAL EXPRESSIONS ========== */}
      {/* Simple conditional (build-time can't evaluate condition, should skip) */}
      <T>
        <Plural n={1} singular="File" plural={count > 1 ? "files" : "file"} />
      </T>
      
      {/* Nested conditionals */}
      <T>
        <Branch 
          branch="file" 
          file={count > 10 ? "many-files.svg" : count > 1 ? "files.svg" : "file.svg"} 
          directory="public" 
        />
      </T>

      {/* ========== VARIABLE REFERENCES ========== */}
      {/* Should skip - can't evaluate at build-time */}
      <T>
        <Plural n={1} singular="File" plural={pluralText} />
      </T>
      <T>
        <Branch branch="file" file={variable} directory="public" />
      </T>

      {/* ========== MEMBER EXPRESSIONS ========== */}
      {/* Should skip - can't evaluate at build-time */}
      <T>
        <Plural n={1} singular={messages.file} plural={messages.files} />
      </T>

      {/* ========== BINARY EXPRESSIONS ========== */}
      {/* String concatenation (could potentially be supported) */}
      <T>
        <Plural n={1} singular="File" plural={"File" + "s"} />
      </T>
      
      {/* Numeric operations */}
      <T>
        <Plural n={1} singular="File" plural={40 + 2} />
      </T>

      {/* ========== FUNCTION CALLS ========== */}
      {/* Should skip - can't evaluate at build-time */}
      <T>
        <Plural n={1} singular="File" plural={String(count)} />
      </T>
      <T>
        <Branch branch="file" file={variable.toUpperCase()} directory="public" />
      </T>

      {/* ========== ARRAY AND OBJECT EXPRESSIONS ========== */}
      {/* Uncommon but possible */}
      <T>
        <Branch branch="file" file={["file", "svg"].join(".")} directory="public" />
      </T>

      {/* ========== MIXED COMPLEX EXPRESSIONS ========== */}
      {/* Combinations that might appear in real code */}
      <T>
        <Plural 
          n={count}
          singular={count === 1 ? "single file" : "file"}
          plural={count > 100 ? `${count} many files` : `${count} files`}
        />
      </T>

      {/* ========== NESTED JSX IN ATTRIBUTES ========== */}
      {/* JSX fragments in attributes (should work) */}
      <T>
        <Plural 
          n={1}
          singular={<>Single file</>}
          plural={<>Multiple files</>}
        />
      </T>

      {/* JSX elements in attributes (should work) */}
      <T>
        <Plural 
          n={1}
          singular={<span>Single file</span>}
          plural={<span>Multiple files</span>}
        />
      </T>

      {/* Nested components in attributes (should work) */}
      <T>
        <Plural 
          n={1}
          singular={<Var>{variable}</Var>}
          plural={<>Multiple <Var>{variable}</Var>s</>}
        />
      </T>

      {/* ========== DEEPLY NESTED SCENARIOS ========== */}
      <T>
        <Plural
          n={1}
          singular={
            <Branch
              branch="type"
              file={
                <Plural
                  n={1}
                  singular={<>Single nested file</>}
                  plural={"Multiple nested files"}
                />
              }
              directory={<>Public directory</>}
            />
          }
          plural={"Multiple top-level items"}
        />
      </T>

      {/* ========== EDGE CASE: EMPTY VALUES ========== */}
      <T>
        <Plural n={1} singular="" plural="Files" />
      </T>
      <T>
        <Plural n={1} singular="File" plural={""} />
      </T>

      {/* ========== EDGE CASE: WHITESPACE HANDLING ========== */}
      <T>
        <Plural 
          n={1} 
          singular="   File   " 
          plural={"   Files   "} 
        />
      </T>
      <T>
        <Plural 
          n={1} 
          singular={`
            Multiline
            File
          `} 
          plural="Files" 
        />
      </T>

      {/* ========== EDGE CASE: SPECIAL CHARACTERS ========== */}
      <T>
        <Plural 
          n={1} 
          singular="File with emoji 📁" 
          plural={"Files with emoji 📁📂"} 
        />
      </T>
      <T>
        <Branch 
          branch="file" 
          file="special-chars!@#$%^&*().svg" 
          directory={"unicode-path-ñáéíóú"} 
        />
      </T>

      {/* ========== EDGE CASE: ALL PLURAL FORMS ========== */}
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
          plural={count > 10 ? "Lots of files" : "Some files"}
        />
      </T>

      {/* ========== STRESS TEST: MAXIMUM NESTING ========== */}
      <T>
        <Branch
          branch="level1"
          option1={
            <Branch
              branch="level2" 
              option1={
                <Plural
                  n={1}
                  singular={
                    <Branch
                      branch="level3"
                      option1={<>Deep option 1</>}
                      option2={<Var>{variable}</Var>}
                    />
                  }
                  plural={
                    <Branch
                      branch="level3"
                      option1={<Currency currency="USD">100</Currency>}
                      option2={<DateTime>{new Date()}</DateTime>}
                    />
                  }
                />
              }
              option2="Level 2 option 2"
            />
          }
          option2="Level 1 option 2"
        />
      </T>

      {/* ========== PERFORMANCE TEST: MANY SIBLINGS ========== */}
      <T>
        <div>Item 1</div>
        <div>Item 2</div>
        <div>Item 3</div>
        <Var>{variable}</Var>
        <Num>{count}</Num>
        <Currency currency="USD">100</Currency>
        <DateTime>{new Date()}</DateTime>
        <Plural n={1} singular="File" plural="Files" />
        <Branch branch="file" file="test.svg" directory="public" />
        <div>Item 4</div>
        <div>Item 5</div>
        <Plural n={2} singular="Item" plural={"Items"} />
        <Branch branch="type" image="icon.png" text="Text" />
      </T>

      {/* ========== REGRESSION TEST: ORIGINAL FAILING CASES ========== */}
      <T>
        change
        <Plural
          n={1}
          singular={<>Here is some translatable static content cha ge</>}
          plural={"Files"}
        />
      </T>

      <T>
        <Plural
          n={1}
          singular={
            <Plural
              n={1}
              singular={
                <Branch branch="file" file="file.svg" directory="public" />
              }
              plural="Files"
            />
          }
          plural={"Files change"}
        />
      </T>

    </>
  );
}