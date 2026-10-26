/** @type {import('next').NextConfig} */
const nextConfig = {
  // NEXT_DIST_DIR lets a verification build run beside a dev server without touching its .next.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  devIndicators: false,
  serverExternalPackages: ['@subham/database', '@prisma/client', 'prisma', 'exceljs'],
  outputFileTracingIncludes: {
    '/api/**/*': [
      './src/generated/client/**/*',
      '../../packages/database/src/generated/client/**/*',
      './node_modules/@subham/database/**/*',
    ],
  },
};

export default nextConfig;
