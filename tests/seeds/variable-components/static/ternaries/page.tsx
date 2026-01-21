"use client";
import { T, Static, LocaleSelector } from "gt-next";
import { useState } from "react";
const getSubjectName = (condition: boolean) => condition ? (<>The boy</>) : (<>The girl</>)


export default function Page() {
  const [state, setState] = useState(false);
  const toggleState = () => setState(!state);

  return (
    <>
    <LocaleSelector />
      <T><Static>{getSubjectName(state)}</Static> is beautiful</T>

      <div>
        <button onClick={toggleState}>Toggle</button>
        {state ? "True" : "False"}
      </div>
    </>
  )
}