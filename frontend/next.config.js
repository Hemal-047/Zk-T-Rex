/** @type {import('next').NextConfig} */
const nextConfig = {
  // RainbowKit/wagmi/snarkjs pull in optional Node-only or RN-only deps that
  // we don't actually use in the browser bundle. Stub them so webpack stops
  // complaining and Vercel produces a clean build.
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      readline: false,
      net: false,
      tls: false,
      crypto: false,
    };

    // Optional deps that are safe to alias to false in our environment.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@react-native-async-storage/async-storage": false,
      "pino-pretty": false,
    };

    // snarkjs uses ffjavascript which dynamically requires `web-worker`.
    // The module exists; webpack's "Critical dependency" warning is noise.
    config.module = config.module || {};
    config.module.exprContextCritical = false;

    return config;
  },
};

module.exports = nextConfig;
