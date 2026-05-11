// next.config.mjs
import withPWAInit from "next-pwa";
var nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com"
      }
    ]
  }
};
var withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*$/i,
      handler: "CacheFirst",
      options: {
        cacheName: "firebase-storage-cache",
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 * 24 * 30
          // 30 days
        }
      }
    },
    {
      urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*$/i,
      handler: "CacheFirst",
      options: {
        cacheName: "google-fonts-cache",
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 60 * 60 * 24 * 365
          // 1 year
        }
      }
    },
    {
      urlPattern: ({ url }) => {
        return url.pathname.startsWith("/roster") || url.pathname.startsWith("/stage");
      },
      handler: "NetworkFirst",
      options: {
        cacheName: "app-data-cache",
        networkTimeoutSeconds: 10,
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 * 24
          // 24 hours
        }
      }
    }
  ]
});
var next_config_default = withPWA(nextConfig);
export {
  next_config_default as default
};
