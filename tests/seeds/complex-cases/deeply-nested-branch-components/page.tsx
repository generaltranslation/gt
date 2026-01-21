import { T, Branch, Var } from "gt-next";

export default function Home() {
  const location = "home";
  return (
<T >
        <Branch
          branch={location}
          home={
            <Branch
              branch="time"
              morning="Good morning at home"
              evening={
                <>
                  Good evening at <Var>home</Var> with{" "}
                  <Branch
                    branch="weather"
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