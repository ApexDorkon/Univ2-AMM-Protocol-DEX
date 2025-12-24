import type { NextConfig } from "next";
import type { Configuration } from "webpack";

const nextConfig: NextConfig = {
  webpack: (config: Configuration) => {
    // Ensure externals is always an array
    if (Array.isArray(config.externals)) {
      config.externals.push("pino-pretty", "lokijs", "encoding");
    } else {
      config.externals = [
        ...(typeof config.externals === "undefined" ? [] : [config.externals]),
        "pino-pretty",
        "lokijs",
        "encoding",
      ];
    }
    return config;
  },
};

export default nextConfig;
