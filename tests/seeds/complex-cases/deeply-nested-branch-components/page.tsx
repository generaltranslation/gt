import { T, Select, Var } from "gt-next";

export default function Home() {
  const location = "home";
  return (
<T >
        <Select
          value={location}
          home={
            <Select
              value="time"
              morning="Good morning at home"
              evening={
                <>
                  Good evening at <Var>home</Var> with{" "}
                  <Select
                    value="weather"
                    sunny="sunny skies"
                    rainy="rainy weather"
                  />
                </>
              }
            />
          }
          work="At the office"
        />
      </T>
  );
}