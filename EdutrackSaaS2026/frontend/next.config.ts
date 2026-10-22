import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  output: "standalone",

  experimental: {
    optimizePackageImports: ["lucide-react"],
  },

  images: {
    domains: ["localhost", "edutrack-saas-media.s3.amazonaws.com"],
  },

  env: {
    BACKEND_INTERNAL_URL:
      process.env.BACKEND_INTERNAL_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      (process.env.NODE_ENV === "production"
        ? "https://api.edutrackapplication.covenantsynergy.in"
        : "http://localhost:3001"),
  },
};

export default nextConfig;
