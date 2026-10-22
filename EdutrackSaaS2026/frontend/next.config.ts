import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/timetable/:path*",
        destination: "http://localhost:3000/timetable/:path*",
      },
      {
        source: "/attendance/:path*",
        destination: "http://localhost:3000/attendance/:path*",
      },
      {
        source: "/auth/:path*",
        destination: "http://localhost:3000/auth/:path*",
      },
      {
        source: "/student/:path*",
        destination: "http://localhost:3000/student/:path*",
      },
      {
        source: "/teacher/:path*",
        destination: "http://localhost:3000/teacher/:path*",
      },
      {
        source: "/tenant/:path*",
        destination: "http://localhost:3000/tenant/:path*",
      },
    ];
  },
};

export default nextConfig;
