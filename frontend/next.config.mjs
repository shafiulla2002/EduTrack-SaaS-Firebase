/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  output: 'standalone',

  images: {
    domains: ['localhost', 'edutrack-saas-media.s3.amazonaws.com'],
  },

  env: {
    BACKEND_INTERNAL_URL:
      process.env.BACKEND_INTERNAL_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:3001',
  },
};

export default nextConfig;