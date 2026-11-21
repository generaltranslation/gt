import { T, Plural, Select, Var, Currency, DateTime } from "gt-next";
export default function Home() {
  const variable = "test";
  return (
    <T>
        <Plural n={1} _1="File" _2={"Files"} />
        <Select value="file" file={"file.svg"} directory={"public"} />
        <Plural n={1} _1="File" _2={42} />
        <Plural n={1} _1={true} _2={false} />
        <Plural n={1} _1={null} _2="Files" />
        <Plural n={1} _1={`File`} _2={`Files`} />
        <Plural n={1} _1="File" _2={42} />
        <Plural
          n={1}
          _1={<>Single file</>}
          _2={<>Multiple files</>}
        />
        <Plural
          n={1}
          _1={<span>Single file</span>}
          _2={<span>Multiple files</span>}
        />
        <Plural
          n={1}
          _1={<Var>{variable}</Var>}
          _2={
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
          _1={<Var>{variable}</Var>}
          _2={
            <div>
              <>
                Multiple <Var>{variable}</Var>s
              </>
            </div>
          }
        />
        <Plural
          n={1}
          _1={
            <Select
              value="type"
              file={
                <Plural
                  n={1}
                  _1={<>Single nested file</>}
                  _2={"Multiple nested files"}
                />
              }
              directory={<>Public directory</>}
            />
          }
          _2={"Multiple top-level items"}
        />
        <Plural n={1} _1="" _2="Files" />
        <Plural n={1} _1="File" _2={""} />
        <Plural n={1} _1="   File   " _2={"   Files   "} />
        <Plural
          n={1}
          _1={`
            Multiline
            File
          `}
          _2="Files"
        />
        <Plural
          n={1}
          _1="File with emoji 📁"
          _2={"Files with emoji 📁📂"}
        />
        <Select
          value="file"
          file="special-chars!@#$%^&*().svg"
          directory={"unicode-path-ñáéíóú"}
        />
        <div>hello</div>
        <Select
          value="level1"
          option1={
            <Select
              value="level2"
              option1={
                <Plural
                  n={1}
                  _1={
                    <Select
                      value="level3"
                      option1={<>Deep option 1</>}
                      option2={<Var>{variable}</Var>}
                    />
                  }
                  _2={
                    <Select
                      value="level3"
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