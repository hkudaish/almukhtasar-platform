/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 640, 750, 828, 1080, 1200, 1600],
    imageSizes: [64, 88, 96, 104, 120, 180, 240, 320, 480],
    localPatterns: [
      { pathname: "/api/media/source-image/**" },
      { pathname: "/api/media/category-fallback/**" }
    ]
  }
};
export default nextConfig;
