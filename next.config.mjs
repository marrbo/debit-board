import { withSentryConfig } from '@sentry/nextjs';
import { codecovWebpackPlugin } from "@codecov/webpack-plugin";
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pkg = require('./package.json');


function sanitizeDeploymentId(value) {
  if (!value) return 'default-deployment';
  return value
    .replace(/[^a-zA-Z0-9_-]/g, '-') // substitui qualquer caractere inválido por '-'
    .replace(/-+/g, '-')              // remove hífens duplicados
    .replace(/^-|-$/g, '');           // remove hífens do início e fim
}

const versionFromPackage = pkg.version || '0.0.0';
const deploymentId = sanitizeDeploymentId(`v${versionFromPackage}`);

/** @type {import('next').NextConfig} */
const nextConfig = {
  
  deploymentId,

  // 🔹 Ative strict mode para detectar problemas de renderização
  reactStrictMode: true,

  // 🔹 Remova o header X-Powered-By (segurança)
  poweredByHeader: false,

  // 🔹 Otimização de builds standalone (recomendado para Docker)
  output: 'standalone',

  // Cache para arquivos estáticos (mantido)
  async headers() {
    if (process.env.NODE_ENV === 'production') {
      return [
        {
          source: '/_next/static/:path*',
          headers: [
            { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
          ],
        },
      ];
    }
    return [];
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ui-avatars.com',
      },
      // Adicione também o domínio do Azure DevOps se as imagens vierem de lá
      {
        protocol: 'https',
        hostname: 'dev.azure.com',
      },
    ],
  },

  webpack: (config, { dev }) => {
    // 🔹 NÃO sobrescreva o devtool em desenvolvimento – isso causa
    //    regressões de performance. O Next.js já usa 'eval-source-map'
    //    automaticamente para melhorar o HMR.

    // Se não estiver em modo de desenvolvimento, desativa o cache persistente
    if (!dev && config.cache) {
      config.cache = Object.freeze({
        type: 'memory',
      });
    }

    // 🔹 Mantenha o fallback de módulos apenas se realmente necessário
    //    (ex.: se você tiver problemas ao importar módulos Node no cliente)
    //    Caso não tenha problemas, pode remover esse bloco inteiro.
    // config.resolve.fallback = {
    //   ...config.resolve.fallback,
    //   net: false,
    //   tls: false,
    //   fs: false,
    //   'node:diagnostics_channel': false,
    // };

    // Plugin do Codecov (mantido)
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

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "marrbotecnologia",

  project: "debit-board",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  telemetry: false,

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },

  experimental: {
    // Desativa o cache de fetch entre atualizações HMR
    serverComponentsHmrCache: false, 
    serverComponentsExternalPackages: ['mongoose', 'mongodb'],
    optimizePackageImports: ['lucide-react', '@chakra-ui/react', '@mantine/core'],
  },
});
