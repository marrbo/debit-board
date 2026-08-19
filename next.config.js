/** @type {import('next').NextConfig} */
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
};

module.exports = nextConfig;