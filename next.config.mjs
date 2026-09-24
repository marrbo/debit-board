import { withSentryConfig } from "@sentry/nextjs/config";
import { codecovWebpackPlugin } from "@codecov/webpack-plugin";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pkg = require("./package.json");

const isCI = Boolean(process.env.CI);
const hasCodecov = Boolean(process.env.CODECOV_TOKEN);

function sanitizeDeploymentId(value) {
  if (!value) return "default-deployment";
  return value
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const deploymentId = sanitizeDeploymentId(`v${pkg.version || "0.0.0"}`);

/** @type {import('next').NextConfig} */
const nextConfig = {
  deploymentId,

  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",

  // ✅ Next 15+: pacotes que NÃO devem passar pelo bundler no server.
  //    mongoose/mongodb usam binários nativos e dependem de módulos Node
  //    que quebram quando empacotados. Antes, isso vivia em
  //    `experimental.serverComponentsExternalPackages` — depreciado.
  serverExternalPackages: [
    "mongoose",
    "mongodb",
    "fsevents",
    "nextjs-auto-swagger-gen",
  ],

  experimental: {
    // HMR cache do React Server Components causava o bug dos source maps
    // duplicados no DevTools (chunks velhos apontando para /app e novos
    // para /src). Desligar elimina o cache entre recompilações.
    serverComponentsHmrCache: false,

    optimizePackageImports: [
      "lucide-react",
      "@chakra-ui/react",
      "@mantine/core",
    ],
  },

  async headers() {
    if (process.env.NODE_ENV !== "production") return [];
    return [
      {
        source: "/_next/static/:path*",
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
      { protocol: "https", hostname: "ui-avatars.com" },
      { protocol: "https", hostname: "dev.azure.com" },
    ],
  },

  webpack: (config, { dev }) => {
    // Não sobrescreve devtool — o Next já escolhe `eval-source-map` em dev
    // e um mapa de produção adequado em build.
    if (dev) {
      // 🔥 Troca `eval-source-map` (embutido em eval) por `source-map`
      //    (arquivo .map separado). Custa ~30% mais lento no rebuild,
      //    mas é o ÚNICO devtool que o VSCode consegue mapear sem falhas.
      config.devtool = "source-map";
    }

    // Em produção, cache em memória (evita ~GB de .cache em monorepos
    // dentro do Docker).
    if (!dev && config.cache) {
      config.cache = Object.freeze({ type: "memory" });
    }

    // Codecov só roda em CI. Em dev, `bundle analysis` e `upload`
    // adicionam latência a cada HMR sem trazer benefício.
    if (!dev && hasCodecov) {
      config.plugins.push(
        codecovWebpackPlugin({
          enableBundleAnalysis: true,
          bundleName: "debit-board-webpack-bundle",
          uploadToken: process.env.CODECOV_TOKEN,
          telemetry: false,
        }),
      );
    }

    return config;
  },
};

export default withSentryConfig(nextConfig, {
  org: "marrbotecnologia",
  project: "debit-board",

  // Silencia em dev, mostra upload de source maps em CI.
  silent: !isCI,

  // ⚠️ '/monitoring' é uma página real da sua app. O Sentry interceptava
  //    essa rota e quebrava a página. '/__sentry' não colide com nada.
  tunnelRoute: "/__sentry",

  // Upload completo de source maps custa tempo de build. Só em CI.
  widenClientFileUpload: isCI,

  telemetry: false,

  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
