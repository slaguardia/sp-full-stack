/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["better-sqlite3", "pdf-parse"],
  experimental: {
    optimizePackageImports: ["@heroui/react"],
  },
};

export default nextConfig;
