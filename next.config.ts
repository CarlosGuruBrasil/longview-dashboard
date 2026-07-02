import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingIncludes: {
    '/*': ['./data/**/*'],
  },
  // firebase-admin é Node.js puro — não pode ser bundado pelo Turbopack/Webpack
  // Isso faz o Next.js usar o require() nativo em vez de fazer bundle
  serverExternalPackages: ['firebase-admin'],
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '**.vercel-storage.com', // Vercel Blob (futuro)
      },
    ],
  },
  // TypeScript strict habilitado — erros de tipo bloqueiam o build
  typescript: {
    ignoreBuildErrors: false,
  },
  // Cabeçalhos de segurança padrão
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
