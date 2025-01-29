import { RenderMethod } from "../../types/types";

// Apply an 8 second timeout for non dev/testign environments
function shouldApplyTimeout() {
  const NODE_ENV = typeof process !== "undefined" ? process.env.NODE_ENV : "";
  return !(NODE_ENV === "development" || NODE_ENV === "test");
}

export const defaultRenderSettings: {
  method: RenderMethod;
  timeout?: number;
} = {
  method: "default",
  ...(shouldApplyTimeout() ? { timeout: 8000 } : {}),
} as const;
