import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Cursor Cloud / Simple Browser / localhost variants to load
  // Turbopack HMR and other /_next/* assets during local preview.
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "*.cursor.sh",
    "*.cursor.com",
    "*.workos.cloud",
  ],
  turbopack: {
    // Pin Turbopack to this repo so local/dev does not pick a wrong workspace root.
    root: process.cwd(),
  },
  async headers() {
    // Production: block embedding. Development: allow any ancestor so Cursor
    // Cloud / Simple Browser / vscode-webview previews are not blanked out.
    if (process.env.NODE_ENV === "production") {
      return [
        {
          source: "/:path*",
          headers: [
            { key: "X-Frame-Options", value: "DENY" },
            { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
            { key: "X-Content-Type-Options", value: "nosniff" },
          ],
        },
      ];
    }

    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *",
          },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
