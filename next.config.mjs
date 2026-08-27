// next.config.mjs
import { codecovWebpackPlugin } from "@codecov/webpack-plugin";

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Permite Mongoose/MongoDB rodar no servidor Node.js (Next.js 15+ recomenda 'serverExternalPackages')
    serverComponentsExternalPackages: ['mongoose', 'mongodb'],
  },
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.devtool = 'source-map'; // garante source maps detalhados
    }
    // Ignora módulos Node.js que causam conflitos no Edge/Middleware
    config.resolve.fallback = {
      ...config.resolve.fallback,
      net: false,
      tls: false,
      fs: false,
      'node:diagnostics_channel': false,
    };

    // Adiciona plugin do Codecov
    config.plugins.push(
      codecovWebpackPlugin({
        enableBundleAnalysis: process.env.CODECOV_TOKEN !== undefined,
        bundleName: "debit-board-webpack-bundle",
        uploadToken: process.env.CODECOV_TOKEN,
        telemetry: false,
      })
    );

    return config;
  },
};

// Exportação ES Module
export default nextConfig;