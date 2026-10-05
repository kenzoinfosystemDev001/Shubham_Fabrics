/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@subham/database', '@prisma/client', 'prisma'],
  outputFileTracingIncludes: {
    '/api/**/*': [
      './src/generated/client/**/*',
      '../../packages/database/src/generated/client/**/*',
      './node_modules/@subham/database/**/*',
    ],
  },
};

export default nextConfig;
