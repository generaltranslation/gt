/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Test cases for scoped variable tracking and function call shadowing
 *
 * This file contains TypeScript/React code snippets that test how the SWC plugin
 * handles variable scoping, shadowing, and translation function tracking across
 * different scope boundaries.
 *
 * Expected behavior:
 * - Translation functions (useGT, getGT) should get hash injection
 * - Non-translation functions with same name should NOT get hash injection
 * - Variable shadowing should work correctly across scopes
 * - Scope cleanup should happen on scope exit
 *
 * FALSE POSITIVE DETECTION:
 * - All mock/shadow functions check for unexpected $hash presence
 * - console.error is logged whenever $hash is detected in non-translation calls
 */

import React from "react";
import { useGT } from "gt-next";
import { getGT } from "gt-next/server";

/**
 * Helper function to detect false positive hash injections
 * Should be called by all mock/shadow translation functions
 */
function detectFalsePositive(functionName: string, options: any) {
  if (options && typeof options === 'object' && '$hash' in options) {
    console.error(`❌ FALSE POSITIVE DETECTED: $hash found in ${functionName}`, {
      functionName,
      options,
      stackTrace: new Error().stack
    });
    throw new Error(`False positive: $hash should not be injected into ${functionName}`);
  }
}

/**
 * Helper to create a mock translation function that detects false positives
 */
function createMockTranslator(name: string) {
  return (content: string, options?: Record<string, any>) => {
    detectFalsePositive(name, options);
    return `${name}(${content})`;
  };
}

export default function ScopingTestPage() {
  return (
    <div>
      <BasicShadowing />
      <BlockScopeShadowing />
      <NestedFunctionShadowing />
      <ArrowFunctionShadowing />
      <FunctionExpressionShadowing />
      <MultipleShadowingLevels />
      <SiblingFunctionIsolation />
      <ForLoopScoping />
      <TryCatchScoping />
      <SwitchCaseScoping />
      <ConditionalBlockScoping />
      <AsyncFunctionScoping />
      <GeneratorFunctionScoping />
      <DestructuredAssignmentScoping />
      <DifferentTranslationFunctions />
      <NonTranslationFunctionShadowing />
      <ParameterShadowing />
      <DestructuredParameterShadowing />
      <ParameterShadowingTest />
    </div>
  );
}

// Basic shadowing - translation function shadowed by arrow function
export const BasicShadowing: React.FC = () => {
  const translationFunction1 = useGT();
  {
    const translationFunction1 = createMockTranslator("BasicShadowing.translationFunction1");
    // This should NOT get hash injection (shadowed by regular function)
    return (
      <div>{translationFunction1("Hello world", { $context: "greeting" })}</div>
    );
  }
};

// Block scope shadowing with let/const
export const BlockScopeShadowing: React.FC = () => {
  const t = useGT();
  // This should get hash injection
  console.log(t("Outer scope"));

  if (true) {
    const t = createMockTranslator("BlockScopeShadowing.inner.t");
    // This should NOT get hash injection
    console.log(t("Inner scope"));
  }

  // This should get hash injection again (back to outer scope)
  return <div>{t("Back to outer", { $context: "test" })}</div>;
};

// Nested function shadowing
export const NestedFunctionShadowing: React.FC = () => {
  const translator = useGT();

  function outerFunction() {
    // This should get hash injection
    const result1 = translator("From outer function");

    function innerFunction() {
      const translator = createMockTranslator("NestedFunctionShadowing.innerFunction.translator");
      // This should NOT get hash injection
      const result2 = translator("From inner function");
      return result2;
    }

    return result1 + innerFunction();
  }

  return <div>{outerFunction()}</div>;
};

// Arrow function shadowing
export const ArrowFunctionShadowing: React.FC = async () => {
  const t = await getGT();

  const processText = () => {
    // This should get hash injection
    const original = t("Original text");

    const innerProcess = () => {
      const t = createMockTranslator("ArrowFunctionShadowing.innerProcess.t");
      // This should NOT get hash injection
      return t("Shadowed text");
    };

    return original + " - " + innerProcess();
  };

  return <div>{processText()}</div>;
};

// Function expression shadowing
export const FunctionExpressionShadowing: React.FC = () => {
  const translate = useGT();

  const handler = function () {
    // This should get hash injection
    const msg1 = translate("Before shadow");

    const nestedHandler = function () {
      const translate = createMockTranslator("FunctionExpressionShadowing.nestedHandler.translate");
      // This should NOT get hash injection
      return translate("After shadow");
    };

    return msg1 + " " + nestedHandler();
  };

  return <div>{handler()}</div>;
};

// Multiple levels of shadowing
export const MultipleShadowingLevels: React.FC = () => {
  const t = useGT();

  // Level 1: should get hash injection
  const level1 = t("Level 1");

  if (true) {
    const t = createMockTranslator("MultipleShadowingLevels.level2.t");
    // Level 2: should NOT get hash injection
    const level2 = t("Level 2");

    if (true) {
      const t = createMockTranslator("MultipleShadowingLevels.level3.t");
      // Level 3: should NOT get hash injection
      const level3 = t("Level 3");
      console.log(level2, level3);
    }
  }

  // Back to level 1: should get hash injection
  return <div>{t("Back to level 1") + level1}</div>;
};

// Sibling function isolation
export const SiblingFunctionIsolation: React.FC = () => {
  const globalT = useGT();

  function functionA() {
    const t = createMockTranslator("SiblingFunctionIsolation.functionA.t");
    // This should NOT get hash injection
    return t("From function A");
  }

  function functionB() {
    const t = createMockTranslator("SiblingFunctionIsolation.functionB.t");
    // This should NOT get hash injection
    return t("From function B");
  }

  // This should get hash injection
  return <div>{globalT("Global") + functionA() + functionB()}</div>;
};

// For loop scoping
export const ForLoopScoping: React.FC = () => {
  const t = useGT();
  const results: string[] = [];

  // This should get hash injection
  results.push(t("Before loop"));

  for (let i = 0; i < 2; i++) {
    const t = createMockTranslator(`ForLoopScoping.loop${i}.t`);
    // This should NOT get hash injection
    results.push(t("In loop"));
  }

  // This should get hash injection
  results.push(t("After loop"));

  return <div>{results.join(" | ")}</div>;
};

// Try-catch scoping
export const TryCatchScoping: React.FC = () => {
  const t = useGT();

  try {
    // This should get hash injection
    const tryMsg = t("In try block");
    throw new Error("Test error");
  } catch (e) {
    const t = createMockTranslator("TryCatchScoping.catch.t");
    // This should NOT get hash injection
    return <div>{t("In catch block")}</div>;
  }

  // This should get hash injection (but won't be reached)
  return <div>{t("After try-catch")}</div>;
};

// Switch case scoping
export const SwitchCaseScoping: React.FC = () => {
  const t = useGT();
  const value = "test";

  switch (value) {
    case "test": {
      const t = createMockTranslator("SwitchCaseScoping.case.t");
      // This should NOT get hash injection
      return <div>{t("In switch case")}</div>;
    }
    default: {
      // This should get hash injection
      return <div>{t("In default case")}</div>;
    }
  }
};

// Conditional block scoping
export const ConditionalBlockScoping: React.FC = () => {
  const t = useGT();
  const condition = true;

  if (condition) {
    const t = createMockTranslator("ConditionalBlockScoping.if.t");
    // This should NOT get hash injection
    return <div>{t("In if block")}</div>;
  } else {
    const t = createMockTranslator("ConditionalBlockScoping.else.t");
    // This should NOT get hash injection (but won't be reached)
    return <div>{t("In else block")}</div>;
  }
};

// Async function scoping
export const AsyncFunctionScoping: React.FC = () => {
  const t = useGT();

  const asyncProcess = async () => {
    // This should get hash injection
    const before = t("Before async shadow");

    const asyncInner = async () => {
      const t = createMockTranslator("AsyncFunctionScoping.asyncInner.t");
      // This should NOT get hash injection
      return await t("In async shadow");
    };

    return before + " " + (await asyncInner());
  };

  return <div>{asyncProcess()}</div>;
};

// Generator function scoping
export const GeneratorFunctionScoping: React.FC = () => {
  const t = useGT();

  function* generator() {
    // This should get hash injection
    yield t("From generator");

    function* innerGenerator() {
      const t = createMockTranslator("GeneratorFunctionScoping.innerGenerator.t");
      // This should NOT get hash injection  
      yield t("Inner generator");
    }

    yield* innerGenerator();
  }

  const results = Array.from(generator());
  return <div>{results.join(" | ")}</div>;
};

// Destructured assignment scoping
export const DestructuredAssignmentScoping: React.FC = () => {
  const t = useGT();

  const { handler } = {
    handler: () => {
      const t = createMockTranslator("DestructuredAssignmentScoping.handler.t");
      // This should NOT get hash injection
      return t("From destructured");
    },
  };

  // This should get hash injection
  return <div>{t("Main") + " " + handler()}</div>;
};

// Different translation functions
export const DifferentTranslationFunctions: React.FC = () => {
  const useGTInstance = useGT();
  const getGTInstance = getGT();

  {
    const useGTInstance = createMockTranslator("DifferentTranslationFunctions.shadow.useGTInstance");
    const getGTInstance = createMockTranslator("DifferentTranslationFunctions.shadow.getGTInstance");

    // These should NOT get hash injection
    return (
      <div>
        {useGTInstance("Shadowed useGT")} | {getGTInstance("Shadowed getGT")}
      </div>
    );
  }
};

// Non-translation function that shadows
export const NonTranslationFunctionShadowing: React.FC = () => {
  const translator = useGT();

  {
    // Shadow with a non-translation function call - with false positive detection
    const translator = (msg: string, options?: any) => {
      detectFalsePositive("NonTranslationFunctionShadowing.shadow.translator", options);
      console.log("This is console.log, not useGT:", msg);
      return `ConsoleLog(${msg})`;
    };

    // This should NOT get hash injection
    return <div>{translator("This is console.log, not useGT")}</div>;
  }
};

// Parameter shadowing - should NOT get hash injection
export const ParameterShadowing: React.FC = () => {
  const t = useGT();

  function processMessage(t: (msg: string, options?: any) => string) {
    return t("This should NOT get hash injection");
  }

  const mockTranslator = createMockTranslator("ParameterShadowing.mockTranslator");
  return <div>{processMessage(mockTranslator)}</div>;
};

// Destructured parameter shadowing
export const DestructuredParameterShadowing: React.FC = () => {
  const t = useGT();

  function handler({ t }: { t: (msg: string, options?: any) => string }) {
    return t("This should NOT get hash injection");
  }

  return <div>{handler({ t: createMockTranslator("DestructuredParameterShadowing.handler.param.t") })}</div>;
};

export const ParameterShadowingTest: React.FC = () => {
  const translationFunction1 = useGT(); // Should be tracked as translation function

  // Test 1: Regular function parameter shadowing
  function processWithRegularParam(translationFunction1: (msg: string, options?: any) => string) {
    // This should NOT get hash injection (parameter shadows hook)
    return translationFunction1("Regular param test");
  }

  // Test 2: Arrow function parameter shadowing
  const processWithArrowParam = (translationFunction1: (msg: string, options?: any) => string) => {
    // This should NOT get hash injection (parameter shadows hook)
    return translationFunction1("Arrow param test");
  };

  const mockFunction = createMockTranslator("ParameterShadowingTest.mockFunction");

  return (
    <div>
      {/* Outside functions: should get hash injection */}
      <div>{translationFunction1("Direct call")}</div>

      {/* Inside functions with shadowing parameters: should NOT get hash injection */}
      <div>{processWithRegularParam(mockFunction)}</div>
      <div>{processWithArrowParam(mockFunction)}</div>
    </div>
  );
};

// Additional edge cases for comprehensive false positive detection

// Method calls on objects
export const MethodCallShadowing: React.FC = () => {
  const t = useGT();

  const obj = {
    t: createMockTranslator("MethodCallShadowing.obj.t"),
    process() {
      // This should NOT get hash injection (method call)
      return this.t("Method call");
    }
  };

  return (
    <div>
      {/* Should get hash injection */}
      <div>{t("Direct call")}</div>
      {/* Should NOT get hash injection */}
      <div>{obj.process()}</div>
    </div>
  );
};

// Computed property access
export const ComputedPropertyShadowing: React.FC = () => {
  const t = useGT();
  const key = 't';

  const obj = {
    [key]: createMockTranslator("ComputedPropertyShadowing.obj.computed.t")
  };

  return (
    <div>
      {/* Should get hash injection */}
      <div>{t("Direct call")}</div>
      {/* Should NOT get hash injection */}
      <div>{obj[key]("Computed property")}</div>
    </div>
  );
};

// Import alias shadowing
export const ImportAliasShadowing: React.FC = () => {
  const useGT_alias = useGT();

  {
    const useGT_alias = createMockTranslator("ImportAliasShadowing.shadow.useGT_alias");
    // Should NOT get hash injection
    return <div>{useGT_alias("Shadowed import alias")}</div>;
  }
};

// Template function calls (should be caught by existing string literal checks)
export const TemplateFunctionCalls: React.FC = () => {
  const t = useGT();
  const mockT = createMockTranslator("TemplateFunctionCalls.mockT");

  const value = "world";
  
  return (
    <div>
      {/* Should get hash injection */}
      <div>{t("Hello template")}</div>
      {/* Should NOT get hash injection */}
      <div>{mockT("Hello template")}</div>
    </div>
  );
};