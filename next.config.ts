import path from "node:path";
import type { NextConfig } from "next";
import { BASE_PATH } from "./src/lib/basePath";

const nextConfig: NextConfig = {
  basePath: BASE_PATH,
  // Native canvas bindings and pdf.js's worker must be loaded from
  // node_modules at runtime rather than bundled.
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
  // Pin the workspace root explicitly: a stray lockfile in a parent
  // directory can otherwise make Next.js infer the wrong root.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
