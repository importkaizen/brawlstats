/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Load Prisma from node_modules at runtime — avoids stale / wrong client
  // when the schema changes but Webpack’s server bundle still has old types.
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
