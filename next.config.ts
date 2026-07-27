import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root explicitly: a stray lockfile in a parent
  // directory can otherwise make Next.js infer the wrong root.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
