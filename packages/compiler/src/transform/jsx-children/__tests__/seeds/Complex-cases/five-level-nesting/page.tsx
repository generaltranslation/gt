import { T, Plural, Branch, Var } from "gt-next";
export default function Home() {
  return (<T>
    <Branch
      branch="level1"
      option1={
        <Plural
          n={1}
          singular={
            <Branch
              branch="level2"
              option1={
                <Plural
                  n={1}
                  singular={
                    <Branch
                      branch="level3"
                      option1={
                        <Plural
                          n={1}
                          singular={
                            <Var name="deep_var">
                              deeply nested variable
                            </Var>
                          }
                          plural="deep files"
                        />
                      }
                      option2="level3 option2"
                    />
                  }
                  plural="level2 plurals"
                />
              }
              option2="level2 option2"
            />
          }
          plural="level1 plurals"
        />
      }
      option2="level1 option2"
    />
  </T>
  );
}