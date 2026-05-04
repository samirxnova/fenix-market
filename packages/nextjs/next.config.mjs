/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.fallback = {
      fs: false,
      net: false,
      tls: false,
      "pino-pretty": false,
      "@react-native-async-storage/async-storage": false,
      bs58: false,
      encoding: false,
    };
    // Stub the entire coinbase CDP chain — we don't use it
    config.resolve.alias = {
      ...config.resolve.alias,
      "@coinbase/cdp-sdk": false,
      "@base-org/account": false,
    };
    config.ignoreWarnings = [/Circular dependency/];
    return config;
  },
};

export default nextConfig;
