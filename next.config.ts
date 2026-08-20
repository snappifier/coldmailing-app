import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Pin the workspace root to this app. On 2026-08-20 a stray package-lock.json in the
    // parent projects\ dir made Turbopack adopt it as the root and watch every sibling
    // project - dev hung at "Compiling ..." indefinitely. Explicit root prevents a repeat.
    root: path.join(__dirname),
  },
};

export default nextConfig;
