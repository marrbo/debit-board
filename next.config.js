/** @type {import('next').NextConfig} */
import { codecovWebpackPlugin } from "@codecov/webpack-plugin";

const nextConfig = {
  experimental: {
    // Allows Mongoose/MongoDB to run on the Node.js server
    serverComponentsExternalPackages: ['mongoose', 'mongodb'],
  },
  webpack: (config) => {
    // Ignore Node.js modules that cause conflicts in Edge/Middleware
    config.resolve.fallback = {
      ...config.resolve.fallback,
      net: false,
      tls: false,
      fs: false,
      'node:diagnostics_channel': false,
    };

    // Add Codecov plugin
    config.plugins.push(
      codecovWebpackPlugin({
        enableBundleAnalysis: process.env.CODECOV_TOKEN !== undefined,
        bundleName: "example-webpack-bundle",
        uploadToken: process.env.CODECOV_TOKEN,
      })
    );

    return config;
  },
};

// Use ES module export (instead of module.exports)
export default nextConfig;