/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  serverExternalPackages: ['@subham/database', '@prisma/client', 'prisma'],
  outputFileTracingIncludes: {
    '/api/**/*': [
      './src/generated/client/**/*',
      '../../packages/database/src/generated/client/**/*',
      './node_modules/@subham/database/**/*',
    ],
  },
  // Retired QC department paths (QC1/QC2/QC3 naming) kept working for bookmarks and tabs opened before the rename.
  // Non-permanent (307) so browsers do not cache them and request methods/bodies are preserved.
  async redirects() {
    const retired = [
      ['/qc1', '/dyeing-qc'],
      ['/qc2', '/threadcut-qc'],
      ['/qcwashing', '/washing-qc'],
      ['/qc-washing', '/washing-qc'],
      ['/qc3', '/washing-qc'],
      ['/final-check', '/final-qc'],
      ['/api/qc1', '/api/dyeing-qc'],
      ['/api/qc2', '/api/threadcut-qc'],
      ['/api/qcwashing', '/api/washing-qc'],
      ['/api/qc3', '/api/washing-qc'],
      ['/api/final-check', '/api/final-qc'],
    ];
    return [
      ...retired.map(([source, destination]) => ({
        source: `${source}/:path*`,
        destination: `${destination}/:path*`,
        permanent: false,
      })),
      {
        source: '/api/dyeing/orders/:id/issue-qc1-challan',
        destination: '/api/dyeing/orders/:id/issue-dyeing-qc-challan',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
