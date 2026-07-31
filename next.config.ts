import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Pin Turbopack to this repo so local/dev does not pick a wrong workspace root.
    root: process.cwd(),
  },
  async headers() {
    // Allow Cursor / local iframe previews in development. Keep DENY in production.
    const frameOption = process.env.NODE_ENV === "production" ? "DENY" : "SAMEORIGIN";
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: frameOption },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
