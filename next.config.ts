import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  devIndicators: false,
  // The schedule snapshot and zones are read from disk at runtime by the API.
  outputFileTracingIncludes: { "/**": ["./data/**/*"] },
};

export default config;
