import withPWAInit from "next-pwa";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig = {
  reactCompiler: true,
  output: "standalone",
  webpack: (config) => {
    config.resolve.alias["@"] = path.resolve(__dirname, "./src");
    return config;
  },
  async rewrites() {
    const serverUrl = process.env.INTERNAL_SERVER_URL || "http://localhost:5001";
    return [
      {
        source: "/api/:path*",
        destination: `${serverUrl}/api/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${serverUrl}/uploads/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*\\.(jpg|jpeg|png|svg|webp|gif|ico|woff|woff2)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "5000",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "5000",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "5001",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "5001",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "cdn-icons-png.flaticon.com",
      },
      {
        protocol: "https",
        hostname: "**.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      {
        protocol: "https",
        hostname: "**.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "images.pexels.com",
      },
      {
        protocol: "https",
        hostname: "placehold.co",
      },
      {
        protocol: "https",
        hostname: "post.healthline.com",
      },
      {
        protocol: "https",
        hostname: "media.istockphoto.com",
      },
      {
        protocol: "https",
        hostname: "m.media-amazon.com",
      },
      {
        protocol: "https",
        hostname: "t3.ftcdn.net",
      },
      {
        protocol: "https",
        hostname: "product-images.metro.ca",
      },
      {
        protocol: "https",
        hostname: "**",
      }
    ]
  }
};

export default withPWA(nextConfig);
