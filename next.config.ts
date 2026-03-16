import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ["**/node_modules/**", "**/.git/**", "**/../**"],
      };
    }
    return config;
  },
};

export default nextConfig;
