import { SupportedFrameworks } from "../types/index.js";
import { isPackageInstalled } from "../utils/packageJson.js";
import { searchForPackageJson } from "../utils/packageJson.js";
import fs from "node:fs";
import path from "node:path";

export type FrameworkType = 'react' | undefined;
export type FrameworkObject = {name: SupportedFrameworks | undefined, type?: FrameworkType};

// "next-app" | "next-pages" | "vite" | "gatsby" | "react" | "redwood"
export async function detectFramework(): Promise<FrameworkObject> {
  const packageJson = await searchForPackageJson();

  if (!packageJson) {
    return { name: undefined };
  }

  // Check for Next.js first
  if (isPackageInstalled("next", packageJson, false, true)) {
    // Determine if it's App Router or Pages Router
    const cwd = process.cwd();
    const hasAppDir = fs.existsSync(path.join(cwd, "app")) || fs.existsSync(path.join(cwd, "src", "app"));
    const hasPagesDir = fs.existsSync(path.join(cwd, "pages")) || fs.existsSync(path.join(cwd, "src", "pages"));

    // App Router takes precedence if both exist
    if (hasAppDir) {
      return { name: "next-app", type: "react" };
    }
    if (hasPagesDir) {
      return { name: "next-pages", type: "react" };
    }
    // Default to app router for new Next.js projects
    return { name: "next-app", type: "react" };
  }

  // Check for Gatsby
  if (isPackageInstalled("gatsby", packageJson, false, true)) {
    return { name: "gatsby", type: "react" };
  }

  // Check for RedwoodJS
  if (isPackageInstalled("@redwoodjs/core", packageJson, false, true)) {
    return { name: "redwood", type: "react" };
  }

  // Check for Vite
  if (isPackageInstalled("vite", packageJson, false, true)) {
    return { name: "vite", type: "react" };
  }

  // Check for React (generic)
  if (isPackageInstalled("react", packageJson, false, true)) {
    return { name: "react", type: "react" };
  }

  return { name: undefined };
}