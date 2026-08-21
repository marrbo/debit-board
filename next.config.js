/** @type {import('next').NextConfig} */

import  { codecovWebpackPlugin } from "@codecov/webpack-plugin";

const nextConfig = {
  experimental: {
    // Permite que o Mongoose/MongoDB sejam executados no servidor Node.js
    serverComponentsExternalPackages: ['mongoose', 'mongodb'],
  },
  webpack: (config) => {
    // Ignora módulos Node.js que causam conflito no Edge/Middleware e no Webpack
    config.resolve.fallback = {
      ...config.resolve.fallback,
      net: false,
      tls: false,
      fs: false,
      'node:diagnostics_channel': false,
    };
    return config;
  },
  plugins: [
    // ...
    // Put the Codecov webpack plugin after all other plugins
    codecovWebpackPlugin({
      enableBundleAnalysis: process.env.CODECOV_TOKEN !== undefined,
      bundleName: "example-webpack-bundle",
      uploadToken: process.env.CODECOV_TOKEN,
    }),
  ],
};

module.exports = nextConfig;