import React from 'react';
import { useGT } from 'gt-next';
import { getGT } from 'gt-next/server';

// ===== BASIC FUNCTIONALITY =====
function BasicUsageClient() {
  const t = useGT();
  
  return (
    <div>
      {/* Simple string */}
      {t("Hello world")}
      
      {/* With options */}
      {t("With ID", { id: "greeting" })}
      {t("With context", { context: "navigation" })}
      {t("With both", { id: "btn", context: "form" })}
    </div>
  );
}

// ===== ALIASING & RENAMING =====
function AliasingCases() {
  const translator = useGT();
  const myTranslate = useGT();
  const customT = useGT();
  
  return (
    <div>
      {translator("Aliased useGT 1")}
      {myTranslate("Aliased useGT 2")}
      {customT("Custom alias")}
    </div>
  );
}

// ===== SCOPING EDGE CASES =====
function ScopingCases() {
  const globalT = useGT();
  
  function NestedFunction() {
    const nestedT = useGT();
    
    return (
      <div>
        {globalT("From global scope")}
        {nestedT("From nested scope")}
      </div>
    );
  }
  
  // Arrow function scoping
  const ArrowComponent = () => {
    const arrowT = useGT();
    return <span>{arrowT("Arrow function translation")}</span>;
  };
  
  return (
    <div>
      {globalT("Global translation")}
      <NestedFunction />
      <ArrowComponent />
    </div>
  );
}

// ===== VARIABLE SHADOWING =====
function ShadowingCases() {
  const t = useGT();
  
  function OuterScope() {
    const t = useGT(); // Shadows outer t
    
    function InnerScope() {
      const t = useGT(); // Shadows both outer t's
      return <div>{t("Inner shadowed translation")}</div>;
    }
    
    return (
      <div>
        {t("Outer shadowed translation")}
        <InnerScope />
      </div>
    );
  }
  
  return (
    <div>
      {t("Original translation")}
      <OuterScope />
    </div>
  );
}

// ===== MULTIPLE CALLS PER FUNCTION =====
function MultipleCalls() {
  const t1 = useGT();
  const t2 = useGT();
  const t3 = useGT();
  
  return (
    <div>
      {/* Multiple calls to same function */}
      {t1("First call to t1")}
      {t1("Second call to t1")}
      {t1("Third call to t1")}
      
      {/* Different functions */}
      {t2("First call to t2")}
      {t3("First call to t3")}
      {t2("Second call to t2")}
    </div>
  );
}

// ===== COMPLEX NESTING =====
function ComplexNesting() {
  const outerT = useGT();
  
  function Level1() {
    const level1T = useGT();
    
    function Level2() {
      const level2T = useGT();
      
      function Level3() {
        const level3T = useGT();
        return <div>{level3T("Level 3 translation")}</div>;
      }
      
      return (
        <div>
          {level2T("Level 2 translation")}
          <Level3 />
        </div>
      );
    }
    
    return (
      <div>
        {level1T("Level 1 translation")}
        <Level2 />
      </div>
    );
  }
  
  return (
    <div>
      {outerT("Outer translation")}
      <Level1 />
    </div>
  );
}

// ===== CONDITIONAL USAGE =====
function ConditionalUsage() {
  const t = useGT();
  const condition = true;
  
  return (
    <div>
      {/* Conditional rendering */}
      {condition && t("Conditional translation")}
      {condition ? t("Ternary true") : t("Ternary false")}
      
      {/* Inside JSX expressions */}
      <div title={t("Title attribute")}>
        {t("Content translation")}
      </div>
    </div>
  );
}

// ===== LOOPS AND MAPPING =====
function LoopsAndMapping() {
  const t = useGT();
  const items = ['item1', 'item2', 'item3'];
  
  return (
    <div>
      {/* Map function */}
      {items.map((item, index) => (
        <div key={index}>
          {t(`Translation for ${item}`)}
        </div>
      ))}
      
      {/* For loop equivalent */}
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i}>{t(`Loop translation ${i}`)}</div>
      ))}
    </div>
  );
}

// ===== HOOKS USAGE =====
function HooksUsage() {
  const [count, setCount] = React.useState(0);
  const t = useGT();
  
  React.useEffect(() => {
    console.log("Effect running");
  }, []);
  
  const handleClick = React.useCallback(() => {
    console.log("Button clicked");
    setCount(c => c + 1);
  }, []);
  
  return (
    <div>
      {t("Hooks component translation")}
      <button onClick={handleClick}>
        {t(`Count: ${count}`)}
      </button>
    </div>
  );
}

// ===== EDGE CASES & ERROR CONDITIONS =====
function EdgeCases() {
  const t = useGT();
  
  return (
    <div>
      {/* Empty or unusual strings */}
      {t("")}
      {t("   ")}
      {t("\n\t")}
      
      {/* Special characters */}
      {t("Hello \"quoted\" text")}
      {t("Line 1\nLine 2")}
      {t("Emoji: 🎉")}
      
      {/* Complex options */}
      {t("Complex", { 
        id: "complex-id", 
        context: "special", 
        someOtherProp: "ignored" 
      })}
    </div>
  );
}

// ===== SERVER COMPONENTS (async functions using getGT) =====
async function ServerBasicUsage() {
  const staticT = await getGT();
  return staticT("Static server greeting");
}

async function ServerAliasing() {
  const translator = await getGT();
  const myTranslate = await getGT();
  
  return (
    <div>
      <div>{translator("Server aliased 1")}</div>
      <div>{myTranslate("Server aliased 2")}</div>
    </div>
  );
}

async function ServerNested() {
  const outerT = await getGT();
  
  async function NestedServerFunction() {
    const nestedT = await getGT();
    return nestedT("Nested server translation");
  }
  
  const nestedResult = await NestedServerFunction();
  
  return (
    <div>
      <div>{outerT("Outer server translation")}</div>
      <div>{nestedResult}</div>
    </div>
  );
}

// ===== MAIN TEST COMPONENT (DEFAULT EXPORT) =====
export default async function TestSuite() {
  // Get server translations
  const serverBasic = await ServerBasicUsage();
  const serverAliasing = await ServerAliasing();
  const serverNested = await ServerNested();
  
  return (
    <div>
      <h1>SWC Plugin Test Suite</h1>
      
      <section>
        <h2>Basic Client Functionality</h2>
        <BasicUsageClient />
      </section>
      
      <section>
        <h2>Server Basic</h2>
        <div>{serverBasic}</div>
      </section>
      
      <section>
        <h2>Aliasing Cases</h2>
        <AliasingCases />
      </section>
      
      <section>
        <h2>Server Aliasing</h2>
        <div>{serverAliasing}</div>
      </section>
      
      <section>
        <h2>Scoping Cases</h2>
        <ScopingCases />
      </section>
      
      <section>
        <h2>Shadowing Cases</h2>
        <ShadowingCases />
      </section>
      
      <section>
        <h2>Multiple Calls</h2>
        <MultipleCalls />
      </section>
      
      <section>
        <h2>Complex Nesting</h2>
        <ComplexNesting />
      </section>
      
      <section>
        <h2>Server Nesting</h2>
        <div>{serverNested}</div>
      </section>
      
      <section>
        <h2>Conditional Usage</h2>
        <ConditionalUsage />
      </section>
      
      <section>
        <h2>Loops and Mapping</h2>
        <LoopsAndMapping />
      </section>
      
      <section>
        <h2>Hooks Usage</h2>
        <HooksUsage />
      </section>
      
      <section>
        <h2>Edge Cases</h2>
        <EdgeCases />
      </section>
    </div>
  );
}