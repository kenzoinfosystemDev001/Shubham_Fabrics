const path = require('path');
const fs = require('fs');

// Attempt to load .env from workspace root if it exists
const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

// Fallback environment variables for CI/CD runners where .env is not checked in
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_AwabUI89igpN@ep-red-bread-b4ddqxah-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'SubhamFabricsEnterpriseMESSecretKey2026SuperSecure_NoLeaks';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    // Only compile .ts files to eliminate ts-jest warnings on workspace package .js files
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  testTimeout: 300000,
};
