import { T, Plural, Branch, Var, Currency, DateTime } from "gt-next";
export default function Home() {
  const variable = "test";
  return (
    <T>
        <Plural n={1} singular="File" plural={"Files"} />
        <Branch branch="file" file={"file.svg"} directory={"public"} />
        <Plural n={1} singular="File" plural={42} />
        <Plural n={1} singular={true} plural={false} />
        <Plural n={1} singular={null} plural="Files" />
        <Plural n={1} singular={`File`} plural={`Files`} />
        <Plural n={1} singular="File" plural={42} />
        <Plural
          n={1}
          singular={<>Single file</>}
          plural={<>Multiple files</>}
        />
        <Plural
          n={1}
          singular={<span>Single file</span>}
          plural={<span>Multiple files</span>}
        />
        <Plural
          n={1}
          singular={<Var>{variable}</Var>}
          plural={
            <>
              Multiple <Var>{variable}</Var>s
            </>
          }
        />
        <div>
          <>Yo</>
          <Var>test</Var>
        </div>
        <Plural
          n={1}
          singular={<Var>{variable}</Var>}
          plural={
            <div>
              <>
                Multiple <Var>{variable}</Var>s
              </>
            </div>
          }
        />
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
        <Plural n={1} singular="" plural="Files" />
        <Plural n={1} singular="File" plural={""} />
        <Plural n={1} singular="   File   " plural={"   Files   "} />
        <Plural
          n={1}
          singular={`
            Multiline
            File
          `}
          plural="Files"
        />
        <Plural
          n={1}
          singular="File with emoji 📁"
          plural={"Files with emoji 📁📂"}
        />
        <Branch
          branch="file"
          file="special-chars!@#$%^&*().svg"
          directory={"unicode-path-ñáéíóú"}
        />
        <div>hello</div>
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
  );
}