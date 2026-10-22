import type { NextConfig } from "next";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/timetable/:path*",
        destination: `${API_URL}/timetable/:path*`,
      },
      {
        source: "/attendance/:path*",
        destination: `${API_URL}/attendance/:path*`,
      },
      {
        source: "/auth/:path*",
        destination: `${API_URL}/auth/:path*`,
      },
      {
        source: "/student/:path*",
        destination: `${API_URL}/student/:path*`,
      },
      {
        source: "/teacher/:path*",
        destination: `${API_URL}/teacher/:path*`,
      },
      {
        source: "/tenant/:path*",
        destination: `${API_URL}/tenant/:path*`,
      },
    ];
  },
};

export default nextConfig;
