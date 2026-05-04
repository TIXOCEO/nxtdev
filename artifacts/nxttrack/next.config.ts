import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        "*.replit.dev",
        "*.replit.app",
        "nxttrack.nl",
        "*.nxttrack.nl",
      ],
    },
  },
  allowedDevOrigins: [
    "*.replit.dev",
    "*.replit.app",
    "nxttrack.nl",
    "*.nxttrack.nl",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "dgwebservices.nl",
      },
    ],
  },
};

export default nextConfig;
