import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native/wasm DB drivers must stay as runtime node_modules, not be bundled.
  serverExternalPackages: ["pg", "@electric-sql/pglite"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
