import { T, Plural, Branch, Var } from "gt-next";
export default function Home() {
  return (<T>
    <Branch
      branch="level1"
      option1={
        <Plural
          n={1}
          _1={
            <Branch
              branch="level2"
              option1={
                <Plural
                  n={1}
                  _1={
                    <Branch
                      branch="level3"
                      option1={
                        <Plural
                          n={1}
                          _1={
                            <Var name="deep_var">
                              deeply nested variable
                            </Var>
                          }
                          _2="deep files"
                        />
                      }
                      option2="level3 option2"
                    />
                  }
                  _2="level2 plurals"
                />
              }
              option2="level2 option2"
            />
          }
          _2="level1 plurals"
        />
      }
      option2="level1 option2"
    />
  </T>
  );
}