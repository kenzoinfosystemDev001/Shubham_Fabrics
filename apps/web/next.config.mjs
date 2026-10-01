/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@subham/database', '@prisma/client', 'prisma'],
  outputFileTracingIncludes: {
    '/api/**/*': [
      '../../packages/database/dist/generated/client/**/*',
      '../../packages/database/src/generated/client/**/*',
      './node_modules/@subham/database/dist/generated/client/**/*',
    ],
  },
};

export default nextConfig;
