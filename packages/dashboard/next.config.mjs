/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@arbiter/shared-types'],
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
