import type { NextConfig } from "next";

const tunnelOrigins = [
  "*.trycloudflare.com",
  "*.ngrok-free.app",
  "*.ngrok.app",
  "*.loca.lt",
];

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  allowedDevOrigins: tunnelOrigins,
  experimental: {
    serverActions: {
      allowedOrigins: tunnelOrigins,
      bodySizeLimit: "8mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.qrserver.com",
      },
    ],
  },
};

export default nextConfig;
